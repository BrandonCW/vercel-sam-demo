# 14: Workbench runs the Assessment Session through useEveAgent

**Status:** ready-for-agent

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
