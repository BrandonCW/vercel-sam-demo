# 13: Typed Assessment Session results in the eve stream

**Status:** resolved

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

## Answer

- **Root tool results.**
  - `score_deal` returns `{ interactionId, jevResult, opportunity }` and `analyze_deal` returns `{ interactionId, system2Result, opportunity }`, as the root `action.result` output.
  - `requireDelegatedResult` (a step) now also loads the Opportunity. The shaping (`scoreDealResult`, `analyzeDealResult` in `lib/agents/delegation.ts`) is pure and runs in the workflow body. So a model mismatch (`System 2 ran with X, not the requested model Y`) fails the tool at once, not after 3 step retries.
  - The subagent's prose `report` is no longer returned on success. That keeps the root model's context smaller; the report still appears in the failure message.
- **`lib/assessment-results.ts`.** `assessmentReducer` is an `EveAgentReducer<AssessmentView>` that projects the stream into:
  - `phase`: `ready`, `assessing`, `awaiting_feedback`, `submitting_feedback`, `closed` or `failed`;
  - `turn`, `runningTool`, `opportunity`, `jevResult`, `system2Result` (form, `modelUsed`), `feedback`, `writeback`, `outcome` and `error`.

  Each root tool has a zod projector.
- **What fails the view:**
  - a failed action, with the error verbatim; the first error wins;
  - a failed or missing outcome;
  - `turn.failed`, `session.failed` or `client.message.failed`;
  - an unreadable result, or a completed result with no tool name;
  - turn 1 ending without a form, or turn 2 ending without a writeback;
  - any turn on an already-closed session.
- **`saFeedbackKey`** is async and uses Web Crypto. `tests/feedback-key.test.ts` pins it against an independent `shasum` literal.
- **`TurnOutcomeSchema`, `TurnOutcome` and `TURN_OUTCOME_JSON_SCHEMA`** now live in `lib/assessment-turns.ts`.

**Deviation to flag:** the root agent now carries the full System 1 and System 2 results in its context, which costs more tokens per turn. The UI needs those results on the stream.
