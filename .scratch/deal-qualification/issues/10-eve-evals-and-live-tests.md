# 10: Testing the eve Agent in Isolation — Fixture Unit Tests + Live Evals

**What to build:**
A test strategy with two tiers. Fixtures are allowed only in unit tests of pure logic; every behavior must also be covered by a live test against the real AI Gateway (Jev + System 2) and a real Postgres (Neon test branch). No runtime code reads fixtures.

**Blocked by:** 09

**Status:** ready-for-agent

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

- [ ] Every Tier 1 behavior also has a Tier 2 live assertion.
- [ ] `pnpm eval` passes against a Neon test branch with real Gateway credentials.
- [ ] Old fallback-dependent tests removed or rewritten.

## Comments

**2026-09-25 — test database findings (Vercel CLI):**
- `vercel-sam-demo` has no database attached. Its env vars are only `AI_GATEWAY_API_KEY`, `SYSTEM2_MODEL_ID`, `AUTH_SECRET`, and `APP_PASSWORD`, with no `POSTGRES_URL`. The app has therefore been running on the in-memory CRM fallback.
- The team's only store is Neon `neon-amber-door`, connected solely to `topic-tracking-web-app`. Do not reuse it.
- Recommended setup: create a dedicated Neon store for `vercel-sam-demo` via the Vercel Marketplace, and connect it to Production, Preview and Development with Preview branching on. Then create a long-lived `test` branch off `main` for `eve eval`, reset by `evals.config.ts` `setup`, with `schema.sql` plus scenario seeds applied. Put its URL in `.env.test.local`.
