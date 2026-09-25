# 10: Testing the eve Agent in Isolation — Fixture Unit Tests + Live Evals

**What to build:**
A test strategy with two tiers. Fixtures are allowed only in unit tests of pure logic; every behavior must also be covered by a live test against the real AI Gateway (Jev + System 2) and a real Postgres (Neon test branch). No runtime code reads fixtures.

**Blocked by:** 09

**Status:** resolved

## Tier 1 — Unit (vitest, fixtures allowed)

- Fixture Jev `answers` objects → `computeComposite`, `evaluateStageGate`, status mapping, qualification-status decision, Suggested Next Steps formatter.
- `DynamicFormRenderer` component contract (existing).
- Fixtures live under `tests/fixtures/` only and are never imported from `lib/`, `agent/`, or `app/`. Enforced by a test asserting no such imports.

## Tier 2 — Live eve evals (`eve eval`, no mocks)

- `evals/evals.config.ts`: `setup` resets the Neon test branch; fails fast if `AI_GATEWAY_API_KEY` / `POSTGRES_URL` missing. Judge defaults to `typesafe-ai/jev`.
- `evals/acme/assess-then-qualify.eval.ts`: two turns; `t.noFailedActions()`; `t.toolOrder([...])`; baseline composite 50–58, Netlify `high`, Gate 2 blocked; after feedback, composite ≥ 70, `qualified`, `[QUALIFIED]` next-steps string.
- `evals/globex/…`: AWS Amplify detected; writeback `[IN REVIEW]`.
- `evals/soylent/…`: headless / Q4-freeze scenario path.
- `evals/failure/…`: a failing Gateway call (e.g. an invalid model ID via env override) produces a failed action and **no** CRM writeback.
- `t.judge(...)` grades System 2 playbook and citation quality.
- Tag live evals `live`; scripts: `pnpm test` (unit), `pnpm eval` (`eve eval`), `pnpm eval:preview` (`eve eval --url $PREVIEW_URL`).

## How to run in isolation (documented in README)

1. `npx eve info` — compile check, no model calls.
2. `npx eve dev` — interactive TUI against the agent.
3. `curl -X POST http://127.0.0.1:2000/eve/v1/session -d '{"message":"Assess opp_acme_corp_001"}'`
4. `npx eve eval` — full live suite.

## Acceptance criteria

- [x] Every Tier 1 behavior also has a Tier 2 live assertion.
- [x] `pnpm eval` passes against a Neon test branch with real Gateway credentials.
- [x] Old fallback-dependent tests removed or rewritten.

## Comments

**2026-09-25 — test database findings (Vercel CLI):**
- `vercel-sam-demo` has no database attached. Its env vars are only `AI_GATEWAY_API_KEY`, `SYSTEM2_MODEL_ID`, `AUTH_SECRET`, and `APP_PASSWORD`, with no `POSTGRES_URL`. The app has therefore been running on the in-memory CRM fallback.
- The team's only store is Neon `neon-amber-door`, connected solely to `topic-tracking-web-app`. Do not reuse it.
- Recommended setup: create a dedicated Neon store for `vercel-sam-demo` via the Vercel Marketplace, and connect it to Production, Preview and Development with Preview branching on. Then create a long-lived `test` branch off `main` for `eve eval`, reset by `evals.config.ts` `setup`, with `schema.sql` plus scenario seeds applied. Put its URL in `.env.test.local`.

## Answer

Resolved on `claude/eve-mvp-tickets-06-10-d52656`. The README has sections on the Database, running the agent in isolation, Tests, and Deployment protection.

### Seed data and resets

- **Seed data in Postgres:** `lib/db/fixtures.ts` is now `lib/db/scenarios.ts` (`DEMO_SCENARIOS`), because it holds demo seed data, not test fixtures.
  - `pnpm db:seed` (`scripts/db-seed.ts` → `lib/db/seed.ts`) is idempotent. It applies `db/schema.sql`, upserts the scenarios into `deal_scenarios`, and restores each baseline Opportunity.
  - `--full-reset` first deletes every Opportunity and interaction. `--eval-target` marks the Neon branch that evals may wipe.
  - `pnpm db:seed:test` runs with both options.
- **Resets read `deal_scenarios`:** runtime resets (`resetCrmDatabase`, `getScenarios`, `getOpportunityByScenario`) read `deal_scenarios` and throw if it is not seeded.
- **Full reset:** `resetAllScenarios`, reachable through `POST /api/crm/reset {"full":true}`, `reset_crm_data {full:true}` and `--full-reset`.

### Database state

| Branch | State |
|---|---|
| `main` | Current `schema.sql` applied, including `idx_interactions_session`. The 3 scenarios are seeded at baseline with the rewritten Acme notes. Not an eval target. |
| `test` | Seeded, full-reset to baseline and marked as the eval target (`eval_target` holds its `neon.branch_id`). |

### Tier 1: unit tests

- Fixtures are still only in `tests/fixtures/`.
- `tests/fixture-boundary.test.ts` fails if `lib/`, `agent/`, `app/`, `components/` or `evals/` imports them.
- New tests:
  - `tests/seed.test.ts` (live Postgres): seed, idempotency, full reset, loud not-seeded errors, the eval-target guard, and the reset route/tool.
  - `tests/assessment-turns.test.ts`
  - `tests/eve-client-headers.test.ts`
  - `resolveJevModel` tests.

### Tier 2: `pnpm eval`

`pnpm eval` loads `.env.test.local` itself.

- **`evals.config.ts`:**
  - fails fast when the Gateway key or `POSTGRES_URL` is missing;
  - runs `requireEvalTarget()`, so any database but the marked `test` branch is refused;
  - then does a full reset;
  - the judge is `typesafe-ai/jev`.
- **Evals:**
  - `acme/assess-then-qualify`
  - `globex/amplify-in-review`
  - `soylent/q4-freeze-headless`
  - `failure/gateway-failure-no-writeback`
- **Tags and passes:** all evals are tagged `live`, and the failure eval is also tagged `failure`. The failure eval runs in a second `eve eval` process with `JEV_MODEL_ID=typesafe-ai/jev-nonexistent`. `resolveJevModel` is a validated override, and the default is `typesafe-ai/jev`.
- **Shared turn messages:** `lib/assessment-turns.ts` holds the turn messages, shared by the routes and the evals. The evals request the routes' structured `{outcome, error}`.

### Tier 1 behaviours with a Tier 2 assertion (acme eval)

| Tier 1 behaviour | Live assertion |
|---|---|
| composite | persisted composite = weighted scores |
| status mapping | dimension status follows the score bands |
| stage gate | Gate 2 blocked on Economic Buyer |
| qualification decision | `qualified` / `in_review` |
| next-steps formatter | standard-format regex, `[QUALIFIED]` / `[IN REVIEW]` |
| `DynamicFormRenderer` contract | the live form matches `JsonRenderFormSchema` |

### Live results (final run, all green)

| Eval | Gates | Result |
|---|---|---|
| acme | 26/26 | Baseline 56 (50–58), Identify Pain ≥ 8, Netlify `high`, Gate 2 blocked only on Economic Buyer. After feedback, 89 (+33), `qualified`, `[QUALIFIED] …`. Judges: citationsGrounded 0.90, playbookQuality 0.99. |
| globex | 9/9 | AWS Amplify detected, `[IN REVIEW]`. |
| soylent | 9/9 | No high-threat competitor, no fatal blocker. Q4-freeze judge 0.94. |
| failure | 7/7 | `score_deal` is a **failed** action, no `crm_update_next_steps`, no writeback row. `t.noFailedActions()` scored **0%** there, so eve tool errors surface as failed actions (the item ticket 06 deferred). |

### Ticket 09 fixes verified live

`tests/assessment-session.live.test.ts` ran against `pnpm dev` with the `.env.test.local` values in session `wrun_01M3B0JF2AQ1AGZ913BP76XKYP`. The score went 56 → 67 and the next step was `[QUALIFIED]`. The session had one `sa_feedback` and one `writeback`, and `ae_notes` was unchanged. That covers the feedbackKey guard, the writeback-once guard and the turn-1 `crm_read_deal`.

### Deployment protection

- **Finding:** the project has Vercel Authentication (`ssoProtection: all_except_custom_domains`) and no Protection Bypass for Automation secret. A deployment calling its own `https://$VERCEL_URL/eve/v1` would be blocked.
- **Fix in code:** `eveClientHeaders` sends `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET`, and fails loudly on Vercel (`VERCEL=1`) when that is unset.
- **User action:** create a Protection Bypass for Automation secret (Project Settings → Deployment Protection), then redeploy. Until then, assess and feedback fail on Vercel with a clear error.

### Deviations

- **`pnpm eval:preview`:** its setup still requires the marked `test` database, so it cannot run against previews on the shared `main` branch. That is deliberate: setup refuses to wipe shared data.
- **Failure eval in a second process:** a Jev model override applies to the whole server, so the failure eval can't share a process with the other evals. It skips itself when run without the override.
- **Four billed runs:** `pnpm eval` ×3 (the first surfaced a flaky System 2 persistence miss in acme, and the retry passed) plus the live session test ×1.
