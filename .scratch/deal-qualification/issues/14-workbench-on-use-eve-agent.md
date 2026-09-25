# 14: Workbench runs the Assessment Session through useEveAgent

**Status:** resolved

**Type:** task

**Blocked by:** 13

## Context

`WorkbenchShell` calls `fetch('/api/qualification/assess' | '/feedback')`. Replace that with `useEveAgent` from `eve/react`.

- **Routing and auth:** same-origin `/eve/v1`, mounted by `withEve`. The `deal_qual_session` cookie rides along automatically, and `agent/channels/eve.ts` already accepts it.
- **Messages:** the hook sends the same turn messages the evals send (`assessTurnMessage`, `feedbackTurnMessage`) with `outputSchema: TURN_OUTCOME_JSON_SCHEMA`.
- **Rendering:** the view comes from the 13 projection, set up as the hook's `reducer`.

### Model dropdown

The selected model is written into turn 1's message (`analyze_deal … with model X`). `analyze_deal` enforces it (13), and the projection checks that `modelUsed` equals the model the UI asked for. Changing the dropdown affects the next assessment only. A paused session keeps the model it was assessed with.

## Acceptance criteria

- [ ] **Turns go through the hook.**
  - Start / Re-run / Re-evaluate send turn 1 on a **new** session (`reset()` then `send`).
  - Submitting the discovery form sends turn 2 to the **same** session.
  - No code calls `/api/qualification/*`.
- [ ] **Same screens and information.**
  - The ready, analyzing, paused-with-form, evaluating and completed stages are all shown.
  - Toasts appear for success and failure, and failures show the eve error verbatim.
  - `ContextColumn` shows the Jev scores and System 2 evidence and gaps from the latest tool-result Opportunity.
- [ ] **Model dropdown.** It selects the System 2 model, and a mismatch is surfaced as an error.
- [ ] **Reset guard.** Reset and scenario switch are disabled while a turn is in flight (12's UI guard).
- [ ] **Tests.** A component test renders the shell with a stubbed `eve/react` hook and asserts:
  - the messages and `outputSchema` it sends;
  - the stages it renders for projected states.

## Answer

- **`WorkbenchShell`**
  - Holds the scenario, the model dropdown and the demo reset.
  - `AssessmentWorkbench`, keyed by `opportunityId:resetGeneration`, owns `useEveAgent({ reducer: assessmentReducer })` against same-origin `/eve/v1`, with cookie auth.
  - Start, Re-run and Re-evaluate call `agent.reset()` and then send `assessTurnMessage(id, selectedModel)` on a new session. eve's store clears the session synchronously on reset, so the send creates a new one.
  - The discovery form sends `feedbackTurnMessage(payload, await saFeedbackKey(...))` to the same session.
  - Every turn requests `TURN_OUTCOME_JSON_SCHEMA`.
- **Rendering**
  - The stages and runtime status map from `view.phase`, plus RESUMING.
  - `ContextColumn` and the header show the latest tool-result Opportunity, so scores, evidence and gaps come from the stream.
  - A failed feedback turn keeps the paused form, so the SA can resubmit to the same session. The eve error shows verbatim in a toast and an `role="alert"` banner. The banner is new; the old UI only toasted.
  - A send that never reaches the stream (network, 401, a turn already running) is caught and shown the same way.
- **Model dropdown and answer check.** The reducer reads back what each turn asked for (`parseTurnRequest` in `lib/assessment-turns.ts`):
  - it fails when `analyze_deal` reports a `modelUsed` different from the model in the turn-1 message;
  - it fails when `record_sa_feedback` records a `feedbackKey` different from the one sent.

  Both checks run on top of the agent's own enforcement. A paused session shows the model it was assessed with; the dropdown applies to the next assessment.
- **Reset guard (from 12).** Reset, the scenario switch and Start are disabled while a turn is submitted, streaming or resuming.
- **Tests.** `tests/workbench-shell.test.tsx` has 10 tests. It stubs `eve/react`, and `fetch` throws. They cover:
  - the messages and `outputSchema` sent;
  - the paused form with evidence and gaps;
  - the closed writeback;
  - failures, including a rejected send;
  - the control locks.

## Comments

- 2026-09-25 (issue 18): superseded in part. The `qualification_assessor` and `playbook_generator` subagents and the `score_deal` / `analyze_deal` delegation tools are removed; the root agent calls `run_jev_scoring` and `run_system2_analysis` directly, and the workbench projects their results (and `action.partial` snapshots) under those names. See `18-direct-root-tools-progressive-results-haiku.md`.
