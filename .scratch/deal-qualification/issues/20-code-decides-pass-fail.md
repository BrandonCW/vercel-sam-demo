# 20: Code decides pass or fail from the `run_assessment` action

**Status:** claimed

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

- [ ] `TurnOutcomeSchema`, `TURN_OUTCOME_JSON_SCHEMA`, `outputSchema`, `parseTurnRequest`, `completedOutcome` and `outcomeOf` are gone.
- [ ] Pass or fail is decided only by the `run_assessment` action status plus the result schema.
- [ ] The final result is typed and includes `writebackId`.
- [ ] The workbench reads the model and the writeback flag from the action input.
- [ ] Every eval asserts that `run_assessment` was called exactly once, and checks its result.
- [ ] `npx eve info` reports 0 errors, and `tsc` and `pnpm test` are clean.
- [ ] `pnpm eval` passes once (at most 2 billed runs).
- [ ] CONTEXT.md, the README and the spec amendment are updated.

## Risks

- **The action input may be missing from the stream.** If `actions.requested` lacks the input in the live stream, the model check would have nothing to compare against. The input is present in the eve 0.64 protocol type (`tool-call` action `input`).
- **The root's reply is no longer checked.** A root that replies in prose after the tool succeeded is fine now. A root that never calls the tool still fails, because the turn ends without a result.
