# 19: One `run_assessment` workflow tool sequences the Assessment Session

**Status:** resolved

**Type:** task

**Blocked by:** 18

## Context

After issue 18, the root model runs the whole Assessment Session. Turn 1 calls `crm_read_deal`, `run_jev_scoring` and `run_system2_analysis`. Turn 2 calls `record_sa_feedback`, `run_jev_scoring` and `crm_update_next_steps`. Each turn then returns a structured outcome.

- That is about 8 root model steps per session. They cost about $0.10 on Sonnet 5, out of about $0.07–0.12 per cycle in total.
- The model owns the ordering, so it can misorder steps or skip them.
- Haiku 4.5 could not be the root, because it never returned the structured outcome (issue 18).

## Goal

One eve workflow tool, `run_assessment`, sequences the whole session in code. The root model makes about 2 short steps per session: it calls the tool, then reports the outcome. That cuts the root cost by about 80–90%, removes misordering, and makes a cheap root model viable.

## Design

`agent/tools/run_assessment.ts` uses `defineWorkflowTool` with `"use workflow"`. Its steps are `"use step"` functions:

1. Load the Opportunity and score it with Jev. Yield the scores, then persist them atomically.
2. Run System 2 on the selected model, streamed. Yield throttled drafts, validate the final result, and persist it.
3. Pause durably at zero compute for the SA's discovery answers. Use `ctx.ask` with `display: "text"`, and have the workbench send the answers as JSON text.
4. When the answers arrive:
   - record the SA feedback idempotently;
   - re-score with Jev (yield, then persist);
   - write back through the `crm_update_next_steps` logic;
   - return the final result, with pass or fail decided in code.

The workbench renders the form from the System 2 result the tool yielded. It answers the pending `input.requested` question with `agent.respond([{ requestId, text }])`.

## Acceptance criteria

- [x] `run_assessment` is the only sequencer of the Assessment Session, and `agent/instructions.md` says only to call it.
- [x] The Jev scores are visible before the write, and the "System 2 analysis running…" indicator shows until the System 2 result yields (option 1: no drafts).
- [x] The pause is durable (hours or days at zero compute), and resume after a reload still renders the form and accepts answers.
- [x] There is one `sa_feedback` row and one `writeback` row per session, and `ae_notes` stays immutable. A failed step fails the action.
- [x] `npx eve info` reports 0 errors, `pnpm test` passes and `tsc` is clean.
- [x] One live Acme cycle and one `pnpm eval` are run, with timings and cost (at most 6 billed runs).
- [x] The root is tried on Gemini 3.8 Flash, then on Haiku 4.5.

## Risks

- The workflow body replays deterministically, so all I/O has to be in steps.
- Every `yield` is a durable `resumeHookStep` report.
- `ctx.ask` carries only `prompt`, `display`, `options` and `allowFreeform`.

## Prototype finding (before the build)

eve 0.64.1 cannot stream from inside a `"use step"` function to the workbench.

**Evidence** (`node_modules/eve/dist/src/execution/tools/workflow/body.js` and `step-execution.js`, and `docs/tools/workflows.mdx`):

- **Only the body's yields become `action.partial`.** `executeWorkflowBody` iterates the body's async generator. It forwards each yielded value to the owner inbox as `{ kind: "report" }`, and that inbox produces `action.partial`.
- **A step cannot report progress.** A `"use step"` function returns a single serialisable value, and its context has no progress or report capability. `ctx.ask` and `ctx.agent` throw inside steps.
- **The body cannot do the streaming either.** The body replays deterministically, so it cannot run `streamText` or read a stream itself.
- **Consequence:** System 2 inside a step can yield only "running" before the call and the validated result after it. It cannot yield the token-level drafts that issue 18 added. The Workflow SDK's `getWritable()` streams from a step, but eve does not forward that stream to `useEveAgent`.

**The rest of the design is supported:**

- The workflow body's yields reach `useEveAgent` as `action.partial` in the default (blocking) execution mode.
- `ctx.ask` parks the run durably. The question arrives as `input.requested` and is answered with `respond([{ requestId, text }])`.
- `ctx.ask` cannot carry a JSON Render form, but the form can come from the yielded System 2 result, with the answers sent back as JSON `text`.

**Options:**

1. **One workflow tool, with System 2 not streamed.** This is the design as written, minus the drafts. The indicator stays, and the full form appears when System 2 finishes (about 20–55 s on Gemini 3.8 Flash). It is fully supported and gives the biggest root saving.
2. **An ordinary streaming tool plus a workflow tool.** `assess_deal` is an ordinary async-generator tool that runs Jev and the streamed System 2, with drafts exactly as today. `await_sa_feedback` is a workflow tool that runs `ctx.ask`, records the feedback, re-scores and writes back.
   - The root calls both in one turn: about 3 steps instead of 8.
   - Streaming stays, and the sequencing is two fixed calls.
3. **Rejected: reporting from inside a step.** Calling eve's internal owner-inbox hook, or a custom `getWritable()` side channel, would depend on undocumented internals. That is the hack the brief rules out.

**User decision: option 1.** System 2 is not streamed. The running indicator shows until the validated result yields, and then the form renders.

## Answer

**Commits:**

| SHA | Change |
|---|---|
| `ba03134` | The plan and the prototype finding. |
| `c17d500` | `run_assessment`. |
| `0a34abd` | Live event-order fix. |
| `91b54a8` | Review fixes; the root moves to Gemini 3.8 Flash. |

### What shipped

- **The tool.** `agent/tools/run_assessment.ts` is a `defineWorkflowTool` with `"use workflow"`. Its `"use step"` functions are in `agent/lib/assessment-steps.ts`: `scoreWithJev`, `saveJevScoring`, `analyzeWithSystem2`, `recordFeedback` and `writeBack`. Every step has `maxRetries = 0`, so it fails loudly.
- **What the body yields.** In order:
  1. `jev_scored`: the Jev scores, before the CRM write;
  2. `jev_saved`: the persisted scores;
  3. `system2_saved`: the persisted System 2 result;
  4. `ctx.ask` (display `text`): the durable pause;
  5. `feedback_recorded`, then `jev_scored` and `jev_saved` for the rescore round;
  6. the return value `closed`: the writeback, with the status decided in code.
- **Writeback without feedback.** `writebackWithoutFeedback` skips the pause. It keeps the Globex, Soylent and failure evals working.
- **Retired.** `run_jev_scoring`, `run_system2_analysis`, `record_sa_feedback` and `crm_update_next_steps` are gone, and so is all the System 2 draft code. `crm_read_deal` and `reset_crm_data` stay for chat and TUI use. `agent/instructions.md` now says only: call `run_assessment` once, and do not summarise.
- **Workbench.**
  - `lib/assessment-progress.ts` holds one schema for both sides.
  - `lib/assessment-results.ts` projects the yields and tracks `pendingInput` from `input.requested`.
  - The form renders from `system2_saved`.
  - The SA answers go out through `agent.respond([{ requestId, text: saAnswerText(...) }])`, and the tool checks the `feedbackKey`. Malformed answers fail the action.
- **Old sessions.** A session that shows the issue-18 tool names, or eve's "not registered as a workflow" error, is marked `legacySession`. The workbench shows "start a new assessment" and clears the saved session from `localStorage`.

### eve 0.64 behaviour found live

- **A parked question ends the turn.** When the workflow parks on `ctx.ask`, eve emits `turn.completed` and then `session.waiting`. The reducer keeps the pause open across it.
- **Answering sends no resolution events.** After `respond()`, eve sends no `input.resolved` and no `turn.started`. The `feedback_recorded` yield settles the pause instead.
- **The final outcome arrives on the respond stream.** `result.completed` comes there, so the evals' outcome gate works.
- **The answering turn finishes quickly.** It took 3.9 s, all of it the root's final step.
- **Yields are cheap.** Every yield is a durable `resumeHookStep` of about 20 ms.

### Live checks

Five billed runs of the six-run budget were used:

- **One Acme cycle on a Gemini root.** It ran through eve's client, which uses the same protocol as `useEveAgent`, with every event fed through `assessmentReducer`.
  - The first attempt parked correctly, but the view failed because of the `turn.completed` behaviour above.
  - After the fix, the same parked session was reattached. The replay from index 0 rebuilt the `awaiting_feedback` state, with its 4 form fields and score 58.
  - The session was answered, written back `[QUALIFIED]` with delta +29, and produced exactly one `sa_feedback` row and one `writeback` row. `ae_notes` was unchanged.
- **`pnpm eval` once, on a Gemini root.**

| Eval | Result |
|---|---|
| globex | 11/11 |
| acme | 23/23, citationsGrounded 86%, playbookQuality 95% |
| soylent | 11/11, judge 95% |
| failure | 6/6, with `run_assessment` failed and no writeback |

### Per-step timings (from `.eve/.workflow-data`)

**Acme live cycle:**

| Step | Time |
|---|---|
| Root decides to call the tool | 3.6 s |
| Jev (System 1) | 1.6 s; the scores appear 5.4 s after the session starts |
| Jev persisted | 0.24 s |
| System 2 (Gemini 3.8 Flash, not streamed) | 30.5 s |
| Paused on the question | 36.3 s after start (issue 18's turn 1 took 69.8 s) |
| Record feedback | 1.3 s |
| Jev re-score | 1.0 s |
| Save | 0.24 s |
| Writeback | 2.7 s |
| Root's final step | 3.9 s |
| Feedback leg, total | 9.5 s |

**Across the eval runs:**

| Step | Range |
|---|---|
| `scoreWithJev` | 0.9–1.6 s |
| `saveJevScoring` | 0.2–0.7 s |
| `analyzeWithSystem2` | 20.6–30.5 s |
| `writeBack` | 1.8–2.7 s |

### Cost per cycle

**Root (`$eve.cost_usd`), all on Gemini 3.8 Flash:**

| Session | Tokens (input / output) | Root cost |
|---|---|---|
| Acme live | 2,473 / 142 | $0.0024 |
| Acme eval | 2,466 / 167 | $0.0025 |
| Globex | 4,636 / 460 | $0.0052 |
| Globex (failure eval) | 4,679 / 626 | $0.0059 |
| Soylent | 4,628 / 386 | $0.0049 |

- **Before:** about 8 root steps and about $0.10 on Sonnet 5.
- **After:** about 2 root steps and about $0.0025 for Acme, which cuts the root cost by about 97%. The same tokens on Sonnet 5 would cost about $0.0064.
- **System 2 (estimate).** Its step output is encrypted in the workflow store, so its token usage cannot be read. The persisted result is about 12.6k characters, or about 3.2k output tokens. The prompt and schema come to about 3k input tokens. On Gemini 3.8 Flash that is about $0.014, excluding any hidden reasoning tokens. The same tokens would cost about $0.038 on Sonnet 5 and about $0.019 on Haiku 4.5.
- **Total per Acme cycle:** about $0.017, plus the two Jev calls, which the workflow data does not price. Before, the total was about $0.07–0.12.

### Root model

- **Chosen: `google/gemini-3.8-flash`.** It is now `DEFAULT_AGENT_MODEL`. It called `run_assessment` once and returned the structured outcome in 5 of 5 live sessions. That includes the failure eval, where it reported `failed` with the error.
- **Not retried: Haiku 4.5.** Gemini met the 3-of-3 bar, and there was no budget left to try Haiku.

### Code review

- **Standards:** no hard breaches. I fixed the duplicated progress types and the unused usage return.
- **Spec:** I fixed the masking of the old-session message by an earlier error. The findings I left open are below.

### Flag for review

- **Reload window.** A reload after `respond()` but before `feedback_recorded` (about 1.3 s) replays the form as open again. eve does not replay the answer. A second submit would be rejected by eve, and the database is protected by the idempotent `sa_feedback` write.
- **A rejected answer ends the session.** The run ends when the answer is malformed or its `feedbackKey` does not match, so the SA must start a new assessment. There is no re-ask.
- **Old-session detection is fragile.** It relies on the issue-18 tool names and on eve's error text ("is not registered as a workflow"). A paused run whose step shape changed shows "Unreadable run_assessment progress" rather than the legacy message.
- **No browser check of the UI.** I did not type the app password. The React workbench is covered by unit tests at the `useEveAgent` seam, and the live check used eve's client and the real reducer.
- **Model override in `.env.local`.** `.env.local` may still set `AGENT_MODEL_ID=anthropic/claude-sonnet-5` from the old `.env.example`. It was not touched.
- **Jev cost not counted.** The Jev calls are not priced in the workflow data, so they are missing from the cost figures.
- **Old wording in the System 2 prompt.** The prompt moved over unchanged still says "Reasoning Engine", which CONTEXT.md lists as a term to avoid. Changing it would change the prompt.
