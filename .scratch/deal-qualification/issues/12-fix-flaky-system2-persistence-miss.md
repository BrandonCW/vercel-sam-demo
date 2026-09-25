# 12: Diagnose and fix the flaky System 2 "did not persist" failure

**Status:** resolved

**Type:** task

**Blocked by:** none

## Context

In issue 10, one `pnpm eval` run failed the acme eval. `analyze_deal` threw `playbook_generator did not persist a run_system2_analysis result for opp_acme_corp_001 in this turn`, and a retry passed. Nobody explained it. The durable trace of that run is still in `.eve/.workflow-data` (root `wrun_01M3B01DYNGMJXV6HKK6ZK0ZWE`, child `wrun_01M3B023RBFZY17RQPS9SDVD5D`).

### Findings from replaying the trace (diagnosing-bugs)

The zstd and devalue step outputs were decoded offline.

- **The subagent did its job.** The child called `run_system2_analysis` exactly once, and the tool returned a full `system2Result`. So `recordSystem2Analysis` ran to completion: the `questions_generated` row was inserted.
- **The lineage stamp was correct.** The child's `eve.parentSession` is `{ rootSessionId: wrun_01M3B01D…ZWE, turn: { id: "turn_0" } }`, which is the root's session and turn. The root check read with the same pair.
- **No agent reset anything.** Across all three concurrent eval sessions in that window, no session called `reset_crm_data`.
- **So the row existed and then vanished.** The only code that deletes `deal_interactions` rows is the reset functions: `resetCrmDatabase` and `resetAllScenarios`.
- **Something outside the agent is the likely cause.** `pnpm test` runs live-Postgres test files (`seed.test.ts`, `e2e-workflow.test.ts`, `delegation.test.ts`, …) that reset or full-reset the same Neon `test` branch the evals use. Nothing prevents `pnpm test` and `pnpm eval` from overlapping. The timing fits a reset between acme's System 2 write (~00:40:43) and its check (00:41:08). Globex and soylent wrote *after* that window, and both passed.
- **The same failure is reachable from the UI.** Pressing Reset while an assessment is in flight deletes the session's rows mid-turn.

The DB was full-reset since that run, so the deletion itself cannot be observed directly. The hypothesis is the only one consistent with the trace. The fix therefore does two things: it makes the failure impossible between test and eval runs, and it makes the failure self-explaining anywhere else.

## Acceptance criteria

- [ ] **Loud diagnosis.** When `requireDelegatedResult` finds no row and the Opportunity was reset after the delegation started, it fails with a message that names the reset and its time. It does not blame the subagent.
- [ ] **Live-run lease.** A lease in Postgres (`live_run_lease`) serialises the destructive users of the Neon `test` branch.
  - `pnpm eval` setup acquires it and teardown releases it.
  - The live vitest files acquire it in a global setup and release it in teardown.
  - A holder that finds another live lease fails loudly and names the holder. An expired lease can be taken over.
- [ ] **UI guard.** The workbench's Reset is disabled while an assessment turn is in flight (delivered with 14).
- [ ] **Regression test.** A test at the `requireDelegatedResult` seam writes the row, resets the Opportunity, and asserts the reset-specific error.

## Answer

**Root cause (best supported):** a CRM reset from outside the agent deleted the Assessment Session's rows between the subagent's write and the root's check.
- The durable trace proves three things: the tool ran once and succeeded, the lineage stamp was right, and no agent reset anything.
- Only the reset functions delete `deal_interactions`, and nothing stopped `pnpm test` (live resets) from overlapping `pnpm eval` on the same Neon `test` branch.
- The deletion itself can't be observed anymore: the DB was full-reset since.

**Fix:**
- **Loud diagnosis.** `requireDelegatedResult` takes `delegatedAt`, the database time captured by the `delegationStartedAt` workflow step, so a replay reuses it. If a `reset` event is newer than that, the error names the reset and its time instead of blaming the subagent. Reset events are now stamped with DB `NOW()`, so both sides use one clock.
- **Live-run lease.** `lib/db/live-run-lease.ts` adds a `live_run_lease` table (in `db/schema.sql`), taken atomically with `ON CONFLICT … WHERE expires_at < NOW()`.
  - The TTL is 5 minutes, renewed every third of it while held.
  - An expired lease (from a crashed run) can be taken over.
  - A busy lease fails loudly and names the holder.
  - `evals/evals.config.ts` setup acquires it and teardown releases it.
  - `tests/global-setup.ts` holds it for the whole vitest run. It now also fails loudly without `POSTGRES_URL`.
- **UI guard.** Reset is disabled while a turn is in flight; that ships with issue 14.

**Tests:**
- `tests/delegation.test.ts` has a reset-mid-turn regression test and a "reset before the delegation is not blamed" test.
- `tests/live-run-lease.test.ts` covers four cases: a busy lease, re-acquire, crashed takeover, and a late release that doesn't drop the new holder.
- Verified by hand: `vitest` refuses to start while a probe lease is held.

**Residual:** `pnpm eval` is two eve processes. The lease is released and re-taken between them, so a `pnpm test` that starts in that gap makes the failure eval fail loudly. It does not corrupt anything silently.

## Comments

- 2026-09-25 (issue 18): superseded in part. The `qualification_assessor` and `playbook_generator` subagents and the `score_deal` / `analyze_deal` delegation tools are removed; the root agent calls `run_jev_scoring` and `run_system2_analysis` directly, and the workbench projects their results (and `action.partial` snapshots) under those names. See `18-direct-root-tools-progressive-results-haiku.md`.
