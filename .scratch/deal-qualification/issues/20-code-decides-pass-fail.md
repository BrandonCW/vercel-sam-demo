# 20: Code decides pass or fail from the `run_assessment` action

**Status:** resolved

**Type:** task

**Blocked by:** 19

## Context

After issue 19, `run_assessment` sequences the Assessment Session in code, but three things still involve the model or fragile parsing:

- **The root model reports the outcome.** Every turn sends `outputSchema` (`TURN_OUTCOME_JSON_SCHEMA`), and the root model has to return `{ outcome, error }`.
  - The workbench fails when that object is missing: "The eve agent returned no structured turn outcome".
  - The evals gate on it with `completedOutcome`.
  - A model that answers in prose fails the session even when the tool succeeded. That is how Haiku 4.5 failed in issue 18.
- **The workbench reads the request by regex.** It gets the requested model and the writeback flag from the user's message text (`parseTurnRequest`).
- **The final result is not typed as the verdict.** The return value carries the writeback, but it has no status, and no id for the writeback row.

## User decision (binding)

Drop the structured turn outcome. Code decides pass or fail from the `run_assessment` action itself, and everything stays in eve:

- the tool's final return value, or the error it throws;
- the eve stream events the client reads.

Add no Next.js route and no other side path.

## Design

**`run_assessment` returns a typed, code-built result.** A shared schema, `AssessmentResultSchema`, defines it:

```ts
{
  status: "written_back",
  opportunityId,
  qualificationStatus,
  baselineScore,
  finalScore,
  delta,
  nextSteps,
  writebackId,
  feedback: "recorded" | "skipped",
  opportunity,
}
```

- `writebackId` is the id of the `writeback` audit row, returned by the atomic writeback statement.
- Any failure throws, so eve marks the action failed with the real error.

**The workbench.**
- Success means the `run_assessment` `action.result` is `completed` and parses against `AssessmentResultSchema`. Failure means the action is not `completed`, and the error is shown verbatim.
- No `outputSchema` is sent, and there is no `result.completed` handling.
- The requested model and the writeback flag come from the `run_assessment` input in `actions.requested`. `parseTurnRequest` goes.
- These fail-loud checks stay:
  - the requested-model check against `modelUsed`, where a missing model fails;
  - the `feedbackKey` check;
  - the check that the session did not end without a result;
  - a second `run_assessment` call in one session fails.

**The root instructions** say only this: call `run_assessment` once with `opportunityId`, `model` and `writebackWithoutFeedback`; if it fails, do not call it again; reply in one short line; do not summarise.

**The evals.**
- `completedOutcome` is replaced by a gate that `run_assessment` completed exactly once, plus checks on its typed result.
- The failure eval checks that the action failed with the tool's error, and that there is no writeback.
- `t.noFailedActions()` stays where it applies.

## Acceptance criteria

- [x] `TurnOutcomeSchema`, `TURN_OUTCOME_JSON_SCHEMA`, `outputSchema`, `parseTurnRequest`, `completedOutcome` and `outcomeOf` are gone.
- [x] Pass or fail is decided only by the `run_assessment` action status plus the result schema.
- [x] The final result is typed and includes `writebackId`.
- [x] The workbench reads the model and the writeback flag from the action input.
- [x] Every eval asserts that `run_assessment` was called exactly once, and checks its result.
- [x] `npx eve info` reports 0 errors, and `tsc` and `pnpm test` are clean.
- [x] `pnpm eval` passes once (at most 2 billed runs).
- [x] CONTEXT.md, the README and the spec amendment are updated.

## Risks

- **The action input may be missing from the stream.** If `actions.requested` lacks the input in the live stream, the model check would have nothing to compare against. The input is present in the eve 0.64 protocol type (`tool-call` action `input`).
- **The root's reply is no longer checked.** A root that replies in prose after the tool succeeded is fine now. A root that never calls the tool still fails, because the turn ends without a result.

## Answer

**Commits:**

| SHA | Change |
|---|---|
| `c5d7fc7` | The plan. |
| `893efd7` | Code decides pass or fail. |
| `ebb1964` | Review fixes. |

### Where pass or fail is decided

- **In the tool.**
  - Every step throws on failure and has `maxRetries = 0` (`agent/lib/assessment-steps.ts:45,56,123,169,194`).
  - A malformed SA answer throws in the body (`agent/tools/run_assessment.ts:63`).
  - Otherwise the body returns `writeBack(...)` (`run_assessment.ts:72`). That builds the verdict in code and validates it with `AssessmentResultSchema.parse` (`assessment-steps.ts:181`, schema at `lib/assessment-progress.ts:43`).
  - `writebackId` is the audit row's id, returned by the atomic writeback statement (`lib/db/crm.ts:135-148`).
- **In the workbench.**
  - An `action.result` that is not `completed` fails the view with eve's error (`lib/assessment-results.ts:192-196`).
  - A completed result must parse (`applyResult`, `:122`).
  - The session closes only when a result exists; otherwise it fails with "ended without a CRM writeback" (`:201-206`).
  - The call itself is checked (`applyCall`, `:131-135`): a second call fails, and so does a missing model.
  - Two fail-loud checks stay: the model check (`:110`) and the `feedbackKey` check (`:115`).
- **In the evals.** `assessmentAction` and `assessmentWrittenBack` (`evals/shared.ts:19,33`) read the same `action.result`. Every eval also asserts `calledTool("run_assessment", { count: 1 })`.

### Live check

`pnpm eval` ran once, in a temporary worktree on port 4125, which was deleted afterwards. The root ran on Gemini 3.8 Flash.

| Eval | Gates | Judges |
|---|---|---|
| globex | 15/15 | |
| soylent | 15/15 | 95% |
| acme | 28/28 | citationsGrounded 81%, playbookQuality 94% |
| failure | 7/7 | the action failed; no result and no writeback |

Root cost per session was $0.0019–0.0043. Acme cost $0.0019, with 2,163 input and 85 output tokens.
