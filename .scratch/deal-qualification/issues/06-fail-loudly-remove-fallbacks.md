# 06: Fail Loudly — Remove All Mock/Fallback Data Paths

**What to build:**
Remove every runtime path that substitutes canned, regex-derived, or in-memory data for real model or database output. Missing configuration or an upstream failure (AI Gateway, Jev, Postgres) must throw and surface as an error — in API routes, in eve tool calls (as a failed action), and in the UI. No mocked data may ever reach a user or the CRM.

**Blocked by:** none

**Status:** resolved

## Scope

| Location | Current behavior | Required change |
|---|---|---|
| `lib/agents/jev-scorer.ts` | `scoreOpportunityWithJevAI` falls back to regex `scoreOpportunityWithJev` when no key | Delete the regex scorer and the fallback branch (Jev replacement lands in 07) |
| `lib/agents/system2-runner.ts` | No key or Gateway error → `executeSystem2Pipeline` canned output (`deterministic_fallback`); `forceDeterministicFallback` option | Delete fallback branches and the option; propagate errors |
| `lib/agents/system2.ts` | ~600-line scenario-hardcoded pipeline | Delete canned generation; keep only schemas/types still in use |
| `lib/db/crm.ts` | Postgres failure → in-memory store with `console.warn` | Delete in-memory store; missing `POSTGRES_URL` or query failure throws |
| `executionMode` / `fallbackReason` fields | Surfaced in API responses and UI badges | Remove fields, types, and fallback UI indicators |
| Startup | No validation | New `lib/env.ts`: Zod-validate `AI_GATEWAY_API_KEY`, `POSTGRES_URL` (and auth vars in non-dev) on first import; throw with a clear message |

## Acceptance criteria

- [ ] `grep -riE "fallback|in-memory|deterministic_fallback"` over `lib/ app/ agent/ components/` returns no runtime fallback code.
- [ ] Unsetting `AI_GATEWAY_API_KEY` or `POSTGRES_URL` causes a thrown, descriptive error — never a successful response.
- [ ] A Gateway/Jev error inside an eve tool surfaces as a failed tool action (verified in 10 via `t.noFailedActions()` failing).
- [ ] `.env.example` documents all required vars as required, not optional.
- [ ] Existing tests that relied on offline fallbacks are rewritten per 10 (fixtures for unit tests, live for integration).

## Answer

Resolved on `claude/eve-mvp-tickets-06-10-d52656`.

- **`lib/env.ts` (new):** Zod-validated accessors `getAiGatewayApiKey`/`assertAiGatewayConfigured`, `getPostgresUrl` (must be a `postgres(ql)://` URL) and `getAuthEnv` (`APP_PASSWORD` + `AUTH_SECRET`). A missing or invalid value throws a descriptive error. Validation happens on first use, not at module import (deviation; see below).
- **System 1:** deleted the regex scorer (`scoreOpportunityWithJev`, `scanCompetitiveMentions`, sentence helpers). `scoreOpportunityWithJevAI` now throws when the key is missing and lets Gateway errors propagate. `computeCompositeScore`, `evaluateStageGate` and `getDimensionStatus` are kept as pure logic for 07. The interim `gpt-4o-mini` prompt is still there until 07 replaces it.
- **System 2:** `system2.ts` now holds only the types (about 550 lines of canned pipeline deleted). The runner removes `forceDeterministicFallback`, `hasProviderKey` and every fallback branch. A missing key, a Gateway error, a missing `phase3Form` or an invalid form all throw.
- **CRM:** the in-memory store and runtime `CREATE TABLE`/auto-seed are deleted. All queries use Postgres, with no catch-and-continue. A missing `POSTGRES_URL` or a query failure throws. The reset runs in a single `sql.transaction`, and an unknown `scenarioId` throws instead of resetting the default scenario.
- **Auth:** the `'default-dev-secret…'` secret is removed, along with the login route's "no APP_PASSWORD → dev session" bypass.
- **API/UI:** removed `executionMode`/`fallbackReason` from responses, types, the ActionStage banner, the TopNavBar DB/Gateway "Fallback/In-Memory" pills and the ContextColumn client-side gate fallback. Competitor badges now come from the persisted `competitive_flags`. `app/page.tsx` throws at render when the Gateway is unconfigured or the default scenario is not seeded.
- **eve:** tools have no try/catch, so errors surface as failed tool actions. `agent/instructions.md` gained a "Failures" rule.
- **Tests:** fallback-dependent tests are deleted or rewritten. Pure-logic tests remain (composite, gates, env, formatters, renderer). CRM, writeback, reset and tool tests now run live against the Neon `test` branch (`.env.test.local`, gitignored, loaded by `vitest.config.ts`, files run serially). New fail-loud tests cover env, CRM, Jev, System 2, the assess and feedback routes, and the eve tools. Live Gateway happy paths are left to issue 10.

Acceptance: the grep only matches React `<Suspense fallback>`; a missing key or URL throws; `.env.example` marks the vars as required. The eve `t.noFailedActions()` check is deferred to 10 as specified.

Deviations and open items: env validation runs on first use, not on import, so modules and tests can load without every var. `resetCrmDatabase` still upserts `SCENARIO_FIXTURES` rows as demo seed data, and needs an explicit decision in 10. The feedback route's regex `hasFatalBlocker` and `next-steps-synthesizer` are still runtime regex logic (for 08/09). `SYSTEM2_MODEL_ID` still defaults to a retired model id (for 08).
