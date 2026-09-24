# 06: Fail Loudly — Remove All Mock/Fallback Data Paths

**What to build:**
Remove every runtime path that substitutes canned, regex-derived, or in-memory data for real model or database output. Missing configuration or an upstream failure (AI Gateway, Jev, Postgres) must throw and surface as an error — in API routes, in eve tool calls (as a failed action), and in the UI. No mocked data may ever reach a user or the CRM.

**Blocked by:** none

**Status:** ready-for-agent

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
