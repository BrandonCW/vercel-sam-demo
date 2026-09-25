# Deal Qualification System

A Next.js workbench plus an eve agent (`agent/`) that qualifies enterprise deals against MEDDPICC. System 1 is `typesafe-ai/jev` and System 2 is a Gateway language model, both called through Vercel AI Gateway. The CRM is simulated in Postgres (Neon). Every failure is loud: there are no fallbacks. Configuration is described in `.env.example`.

## Database

All environments share the Neon project `restless-lab-19763125`:

| Branch | Used by | Seed command |
|---|---|---|
| `main` | dev, preview and production | `POSTGRES_URL="$(npx neonctl connection-string main --project-id restless-lab-19763125)" pnpm db:seed` |
| `test` | `pnpm test` and `pnpm eval` (URL in the gitignored `.env.test.local`) | `pnpm db:seed:test` |

`pnpm db:seed` is idempotent. It does three things:
1. applies `db/schema.sql`;
2. upserts the three demo scenarios, including the rewritten Acme notes, into `deal_scenarios`;
3. restores each scenario Opportunity to its unqualified baseline.

Options:
- `--full-reset` first deletes every Opportunity and interaction.
- `--eval-target` marks the current Neon branch as the only one `eve eval` may wipe. Use it on `test` only.

`pnpm db:seed:test` runs with both options.

Runtime resets read the scenarios from `deal_scenarios`, and they fail loudly if the data is not seeded. There are two kinds of reset:
- **One scenario:** the UI Reset button, or `POST /api/crm/reset {"scenarioId": "…"}`, or `reset_crm_data`.
- **Full reset:** `POST /api/crm/reset {"full": true}`, or `reset_crm_data {"full": true}`, or `pnpm db:seed --full-reset`.

## Running the agent in isolation

1. `npx eve info`: a compile check that makes no model calls.
2. `npx eve dev`: an interactive TUI against the agent.
3. `curl -X POST http://127.0.0.1:2000/eve/v1/session -H 'content-type: application/json' -d '{"message":"Assess opp_acme_corp_001"}'`
4. `pnpm eval`: the full live eval suite (see below).

## Tests

**Tier 1, `pnpm test` (vitest).** Unit tests of pure logic may use fixtures, but only from `tests/fixtures/`. `tests/fixture-boundary.test.ts` fails if `lib/`, `agent/`, `app/`, `components/` or `evals/` imports them. Database tests run live against the Neon `test` branch. Billed live tests are opt-in with `JEV_LIVE=1`, and `EVE_LIVE_SESSION=1` as well for the two-turn route test. That test also needs `pnpm dev` running with the `.env.test.local` values.

**Tier 2, `pnpm eval` (`eve eval`, no mocks).** The suite is billed. It runs against the real AI Gateway and the Neon `test` branch, loading `.env.test.local` itself.

`evals/evals.config.ts` `setup` works as follows:
- it fails fast when `AI_GATEWAY_API_KEY` or `POSTGRES_URL` is missing;
- it refuses any database that is not the marked eval target;
- it then full-resets the database.

| Eval | Proves |
|---|---|
| `acme/assess-then-qualify` | One two-turn session, with `t.toolOrder` and `t.noFailedActions()`. The baseline composite is 50–58, Identify Pain is ≥ 8, Netlify is `high` and Gate 2 is blocked on Economic Buyer. The persisted composite and dimension statuses are consistent, and the form matches the render schema. After SA feedback the composite is ≥ 70, the status is `qualified`, the next step reads `[QUALIFIED] …`, there is exactly one writeback and `ae_notes` is unchanged. Judges grade citations and playbook. |
| `globex/amplify-in-review` | AWS Amplify is detected, and the writeback is `[IN REVIEW]` in the standard format. |
| `soylent/q4-freeze-headless` | The headless / Q4-freeze path: no high-threat competitor, no fatal blocker, and a standardized writeback. A judge checks that the Nov 1 freeze is addressed. |
| `failure/gateway-failure-no-writeback` | An unknown Jev model (`JEV_MODEL_ID`) produces a **failed** `score_deal` action and no CRM writeback. `t.noFailedActions()` is recorded tracked-only here, and scores 0 in the artifact. |

`pnpm eval` runs in two passes:
1. `eve eval --exclude-tag failure`;
2. `JEV_MODEL_ID=typesafe-ai/jev-nonexistent eve eval --tag failure`. The failure eval needs a broken model for the whole server, so it runs in its own process. It skips itself when run without the override.

Artifacts are written to `.eve/evals/<timestamp>/`.

`pnpm eval:preview` (`eve eval --url $PREVIEW_URL`) targets a deployment. Its setup still requires `POSTGRES_URL` to be the marked `test` branch. It therefore works only for a deployment that uses that branch, not for previews on the shared `main` branch, where setup refuses to wipe data.

## Deployment protection

Vercel Authentication protects every `*.vercel.app` deployment URL. That includes the URL a deployment's `/api/qualification/*` routes call for their own `/eve/v1`.

The routes send `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET`, and on Vercel they fail loudly when that variable is absent. To provide it, create a **Protection Bypass for Automation** secret under Project Settings → Deployment Protection, then redeploy. Vercel then exposes the variable automatically.
