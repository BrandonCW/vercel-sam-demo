# 18: Direct root tools, UI before DB writes, Haiku 4.5 default

**Status:** resolved

**Type:** task

**Blocked by:** 17

## Context

One Acme assess turn took about 110–122s (measured from `.eve/.workflow-data`):

- **System 1:** Jev itself takes about 0.6s, but `score_deal` took about 14s. It went root → `score_deal` → the `qualification_assessor` Claude subagent. The subagent spent 1.7s deciding to call `run_jev_scoring`, and 5.0s writing an 887-character summary that nobody read. The tool made three sequential Neon calls from Sydney, and the scores reached the UI only after all of them.
- **System 2:** `analyze_deal` → the `playbook_generator` subagent took about 80–91s. That was a 59s non-streamed `generateText` call, then a 27.5s, 8.5k-character report (about $0.046) that nobody read.
- **Root:** about 17s over 4 model steps, at 38k input tokens, because full tool results entered the root model's history.

## User decisions (binding)

1. The root agent calls `run_jev_scoring` and `run_system2_analysis` directly. The subagents and the `score_deal` / `analyze_deal` wrappers go. Everything stays in `agent/`, and no model calls happen outside it.
2. No subagent summaries. The UI renders from typed tool results.
3. The UI shows the Jev scores no later than the Postgres writes, and System 2 output as it streams, using eve's supported mechanism. Fail loudly still holds.
4. The default model is `anthropic/claude-haiku-4.5` (checked against `https://ai-gateway.vercel.sh/v1/models`) for the root agent and System 2. Sonnet 5 stays selectable.
5. The database region is unchanged.

## Acceptance criteria

- [ ] `agent/subagents/`, `score_deal` and `analyze_deal` are gone. `run_jev_scoring` and `run_system2_analysis` are root tools. `npx eve info` shows 0 subagents and 0 errors.
- [ ] `run_jev_scoring` yields the Jev scores (`action.partial`) before its CRM write, and yields the persisted result afterwards. A failed write fails the action.
- [ ] `run_system2_analysis` streams (`streamText` + `Output.object`) and yields throttled display-only drafts: citations, and the renderable part of the form. The final result is validated in full and persisted.
- [ ] Each step's Opportunity update and audit row are one atomic statement, with no read-modify-write.
- [ ] The workbench rubric shows the Jev scores from the partial. Citations and a read-only form preview fill in while System 2 streams.
- [ ] Haiku 4.5 is the default in `lib/models.ts`, `.env.example`, the docs and the tests.
- [ ] Live: one Acme assess and feedback cycle with before/after timings, and one `pnpm eval`.

## Answer

**Structure.** `agent/subagents/` is gone, and so are `score_deal`, `analyze_deal` and `lib/agents/delegation.ts`. `run_jev_scoring` and `run_system2_analysis` are now root tools (`defineTool`, default execution), so the root turn waits for them inline. In every live session the turn settled only after the tools finished, and there were no background wake-ups. `npx eve info` reports 0 errors, 12 tools and 0 subagents. No subagent earned its place, since both steps are a single deterministic tool call. `toModelOutput` gives the root a compact summary; the full result still streams to the UI.

**UI before DB (eve `action.partial`).**
- Both tools are async generators.
- `run_jev_scoring` yields `{ jevResult }` right after Jev answers, then does one atomic write, then yields the persisted result. `recordAssessmentStep` is a single CTE (UPDATE … RETURNING plus INSERT … SELECT) and replaces the earlier read → update → insert.
- `run_system2_analysis` uses `streamText` with `Output.object`. It yields throttled `{ draft }` snapshots (at most one per 750 ms, and only when the draft changed), built by `toSystem2Draft`: citations so far and the renderable form sections. The final object is fully validated before the write.
- The reducer applies Jev snapshots to the rubric (`withJevScores`) and draft citations to the breakdown (`withDraftFindings`). It also shows a read-only form preview and a "System 2 analysis running…" indicator.
- A failed write fails the `action.result`, and so the view. An unreadable System 2 draft is skipped, because drafts are display-only.

**Models.** These deviate from the requested defaults and need a decision.
- Root: `anthropic/claude-sonnet-5`. Through the Gateway, Haiku 4.5 ended every turn with prose instead of the structured turn outcome (`OUTPUT_SCHEMA_NOT_FULFILLED`) in 6 of 6 sessions.
- System 2 default: `google/gemini-3.8-flash`. Its probe finished in 21.5 s, was schema-valid, and produced 11 citations and 4 questions. Haiku 4.5 returned only `dimensionFindings` and stopped in 5 of 5 calls, including with `structuredOutputMode` `jsonTool`, a key-order prompt, and with `outputFormat`, which returned a 400.
- The dropdown offers Gemini 3.8 Flash (default), Haiku 4.5, Sonnet 5 and GPT-5.5.

**Timings (Acme turn 1, from `.eve/.workflow-data`).**

| | Before (Sonnet 5 + subagents, `wrun_01M3B8E9…`) | After (eval `wrun_01M3BJTVSP…`) |
|---|---|---|
| First Jev score in the stream | 19.8 s | 6.8 s (partial; persisted at 7.1 s) |
| System 2 duration | 80.6 s | 55.6 s (21.5 s standalone probe) |
| Turn 1 total | 109.7 s | 69.8 s |
| Turn 2 Jev re-score | 8.5 s | failed: Jev 503 at the Gateway (external) |

**Evals (final `pnpm eval`, HEAD 36a112f).**
- globex: 9/9.
- soylent: 9/9, judge 93%.
- acme: 12/13, citationsGrounded 88%, playbookQuality 99%. Its only failed gate was turn 2, where `typesafe-ai/jev` returned 503 "Service temporarily unavailable" after 3 retries, and the turn correctly reported `failed`.
- The failure-tag pass did not run, because the live pass exited non-zero.
