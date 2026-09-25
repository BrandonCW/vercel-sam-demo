# 18: Direct root tools, UI before DB writes, Haiku 4.5 default

**Status:** claimed

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
