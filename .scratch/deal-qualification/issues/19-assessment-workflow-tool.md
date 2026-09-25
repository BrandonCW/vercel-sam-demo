# 19: One `run_assessment` workflow tool sequences the Assessment Session

**Status:** needs-info

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

- [ ] `run_assessment` is the only sequencer of the Assessment Session, and `agent/instructions.md` says only to call it.
- [ ] The Jev scores are visible before the write, System 2 streams drafts, and the "System 2 analysis running…" indicator stays.
- [ ] The pause is durable (hours or days at zero compute), and resume after a reload still renders the form and accepts answers.
- [ ] There is one `sa_feedback` row and one `writeback` row per session, and `ae_notes` stays immutable. A failed step fails the action.
- [ ] `npx eve info` reports 0 errors, `pnpm test` passes and `tsc` is clean.
- [ ] One live Acme cycle and one `pnpm eval` are run, with timings and cost (at most 6 billed runs).
- [ ] The root is tried on Gemini 3.8 Flash, then on Haiku 4.5.

## Risks

- The workflow body replays deterministically, so all I/O has to be in steps.
- Every `yield` is a durable `resumeHookStep` report.
- `ctx.ask` carries only `prompt`, `display`, `options` and `allowFreeform`.

## Answer (prototype finding: blocked on a design decision)

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

Build is paused pending the choice between options 1 and 2.
