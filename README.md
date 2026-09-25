# Deal Qualification System

A Next.js workbench plus an eve agent (`agent/`) that qualifies enterprise deals against MEDDPICC. System 1 is `typesafe-ai/jev` and System 2 is a Gateway language model, both called through Vercel AI Gateway. Both run as steps of one `run_assessment` workflow tool, which sequences the whole Assessment Session in code (no subagents). The root agent only starts it, so it runs on the cheap `google/gemini-3.8-flash` (`AGENT_MODEL_ID`; issue 19). System 2 defaults to the fast `google/gemini-3.8-flash` (`SYSTEM2_MODEL_ID`). Haiku 4.5 and Sonnet 5 are still selectable for System 2. Through the Gateway, Haiku 4.5 stops after the first property of the System 2 object, so it fails loudly if chosen (issue 18). The CRM is simulated in Postgres (Neon). Every failure is loud: there are no fallbacks. Configuration is described in `.env.example`.

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

**Tier 1, `pnpm test` (vitest).** Unit tests of pure logic may use fixtures, but only from `tests/fixtures/`. `tests/fixture-boundary.test.ts` fails if `lib/`, `agent/`, `app/`, `components/` or `evals/` imports them. Database tests run live against the Neon `test` branch. Billed live tests are opt-in with `JEV_LIVE=1`. The two-turn Assessment Session is covered live by `pnpm eval` (acme) and by driving the workbench. A run holds a live-run lease on the test database, so `pnpm test` and `pnpm eval` cannot reset each other's data mid-run.

**Tier 2, `pnpm eval` (`eve eval`, no mocks).** The suite is billed. It runs against the real AI Gateway and the Neon `test` branch, loading `.env.test.local` itself.

`evals/evals.config.ts` `setup` works as follows:
- it fails fast when `AI_GATEWAY_API_KEY` or `POSTGRES_URL` is missing;
- it refuses any database that is not the marked eval target;
- it then full-resets the database.

| Eval | Proves |
|---|---|
| `acme/assess-then-qualify` | One session and one `run_assessment` call, answered through its discovery pause (`requireInputRequest` + `respond`), with `t.toolOrder` and `t.noFailedActions()`. The baseline composite is 50–58, Identify Pain is ≥ 8, Netlify is `high` and Gate 2 is blocked on Economic Buyer. The persisted composite and dimension statuses are consistent, and the form matches the render schema. After SA feedback the composite is ≥ 70, the status is `qualified`, the next step reads `[QUALIFIED] …`, there is exactly one writeback and `ae_notes` is unchanged. Judges grade citations and playbook. |
| `globex/amplify-in-review` | AWS Amplify is detected, and the writeback is `[IN REVIEW]` in the standard format. |
| `soylent/q4-freeze-headless` | The headless / Q4-freeze path: no high-threat competitor, no fatal blocker, and a standardized writeback. A judge checks that the Nov 1 freeze is addressed. |
| `failure/gateway-failure-no-writeback` | An unknown Jev model (`JEV_MODEL_ID`) produces a **failed** `run_assessment` action and no CRM writeback. `t.noFailedActions()` is recorded tracked-only here, and scores 0 in the artifact. |

`pnpm eval` runs in two passes:
1. `eve eval --exclude-tag failure`;
2. `JEV_MODEL_ID=typesafe-ai/jev-nonexistent eve eval --tag failure`. The failure eval needs a broken model for the whole server, so it runs in its own process. It skips itself when run without the override.

Artifacts are written to `.eve/evals/<timestamp>/`.

`pnpm eval:preview` (`eve eval --url $PREVIEW_URL`) targets a deployment. Its setup still requires `POSTGRES_URL` to be the marked `test` branch. It therefore works only for a deployment that uses that branch, not for previews on the shared `main` branch, where setup refuses to wipe data.

## How the UI reaches the agent

The workbench (`components/workbench/WorkbenchShell.tsx`) talks to the eve agent directly with `useEveAgent` from `eve/react`, on the same origin `withEve` mounts (`/eve/v1/*`). There is no server-side bridge.

- **Auth.** The browser sends the app's `deal_qual_session` cookie, which `agent/channels/eve.ts` accepts. The middleware also guards `/eve/v1` with it.
- **One tool, sequenced in code.** Each Assessment Session is one durable eve session and one call to the `run_assessment` workflow tool (`agent/tools/run_assessment.ts`, `"use workflow"`). Its `"use step"` functions (`agent/lib/assessment-steps.ts`) score with Jev, run System 2, record the SA answers, re-score and write back. The root model only starts it (`assessTurnMessage`, with the structured `{ outcome, error }` result) and reports the outcome.
- **The SA pause.** After System 2, the tool calls `ctx.ask`, which parks the run durably at zero compute (`input.requested`). The workbench renders the discovery form from the System 2 result the tool already yielded, and answers the question with `agent.respond([{ requestId, text }])`. The text is `saAnswerText`: the answers plus their `feedbackKey`, which the tool checks. A malformed or altered answer fails the action, and the session ends.
- **What the UI renders.** `lib/assessment-results.ts` projects the stream into the view. The tool's yields arrive as `action.partial` events: the Jev scores before their CRM write, then each persisted result. `action.result` carries the writeback. Failures show verbatim.
- **No System 2 streaming.** A workflow step returns one value, and only the workflow body's yields reach `useEveAgent`, so System 2 cannot stream drafts (issue 19). The "System 2 analysis running…" indicator shows until the validated result arrives with its form.
- **Old sessions.** A session started by the per-step tools of issue 18, or by a deployment without its workflow, cannot resume. The workbench says so, forgets the saved session and offers a new assessment.
- **Reloads.** The session ID is saved per Opportunity in `localStorage` and resumed with `resume: true`, so a reload reattaches to a paused or running session. A session saved before the Opportunity was reset is dropped.
- **Data routes.** `/api/crm/reset` and `/api/crm/opportunity` stay as plain Next.js data routes. They call no model: they are the deterministic demo reset and a CRM read. The agent keeps its own `reset_crm_data` tool.

## Deployment protection

The browser has already passed Vercel Authentication when it loads the page, so its same-origin `/eve/v1` requests carry the Vercel Authentication (SSO) cookie. No server calls its own deployment URL, so no Protection Bypass for Automation secret is needed.

Scripts that call a protected deployment from outside a browser, such as `pnpm eval:preview`, still need their own way past Deployment Protection and the eve channel auth.
