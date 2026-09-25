# 13: Typed Assessment Session results in the eve stream

**Status:** ready-for-agent

**Type:** task

**Blocked by:** none

## Context

Today the UI never sees results from the eve stream. `score_deal` and `analyze_deal` return `{ interactionId, report }`, and the `/api/qualification/*` bridge re-reads Postgres to rebuild its response. It also checks in the route that System 2 used the selected model.

For the UI to use `useEveAgent` directly, those facts must come as **typed tool results** in the root session's stream, `action.result` for the root tools. They also have to be enforced **in the agent**, not in a route.

## Acceptance criteria

- [ ] **`score_deal`** returns the persisted row for this session and turn, `{ interactionId, jevResult, opportunity }`, parsed with `JevScoringResultSchema`.
- [ ] **`analyze_deal`** returns `{ interactionId, system2Result, opportunity }`. The form and `modelUsed` are inside `system2Result`. When a model was requested and `modelUsed` differs, it fails loudly.
- [ ] **`record_sa_feedback`** and **`crm_update_next_steps`** keep returning their typed results.
- [ ] **One client-safe module** (`lib/assessment-results.ts`) owns zod schemas for these tool outputs, plus a pure projection from eve stream events to the workbench view. That view carries phase, Jev result, System 2 result, form, writeback, latest Opportunity, outcome and error. The module fails loudly on unparseable results and on a failed action or outcome.
- [ ] **`saFeedbackKey`** is browser-safe (Web Crypto, async), so the UI can compute the key it sends.
- [ ] **`TurnOutcomeSchema` / `TURN_OUTCOME_JSON_SCHEMA`** move to `lib/assessment-turns.ts`. The evals and the UI share them.
- [ ] **Tests:**
  - unit tests for the projection, driven by captured event shapes;
  - the delegation tests assert the typed return;
  - the model-mismatch rejection is tested.
