# 16: Retire the /api/qualification bridges and the server-side eve client

**Status:** resolved

**Type:** task

**Blocked by:** 14

## Context

Once the UI talks to eve directly, the server-to-server bridge is dead code. The bridge is `app/api/qualification/{assess,feedback}`, `lib/eve-session.ts`, `EVE_AGENT_ORIGIN` / `getEveAgentOrigin`, and the `x-vercel-protection-bypass` header.

**Deployment protection.** The bypass header existed only because a deployment called its own `https://$VERCEL_URL/eve/v1` server-to-server. A browser that loaded the page has already passed Vercel Authentication, so its same-origin `/eve/v1` requests carry the Vercel SSO cookie. With the bridge gone, the bypass secret is no longer needed by the app.

**The other endpoints.** Each was checked against "every agent lives inside eve".

| Endpoint | Decision | Why |
|---|---|---|
| `/eve/v1/*` | eve | Every agent turn goes through it. |
| `POST /api/crm/reset` | Stays a Next.js data route | It runs no model. It is deterministic demo-data CRUD, used by the Reset button. Sending it through an agent turn would add a billed, non-deterministic model call to a button that must always work. The agent keeps `reset_crm_data` for the TUI and evals. |
| `GET /api/crm/opportunity` | Stays a Next.js data route | A plain read with no model, for scenario switching. |
| `/api/auth/*` | Stays | The app password gate that issues the cookie eve's channel auth accepts. |

## Acceptance criteria

- [ ] **Removed:**
  - `app/api/qualification/assess` and `app/api/qualification/feedback`;
  - `lib/eve-session.ts`;
  - `getEveAgentOrigin`, `EVE_AGENT_ORIGIN` and `eveClientHeaders`;
  - their tests: `assess.test.ts`, `feedback.test.ts`, `qualification-routes-eve.test.ts`, `eve-client-headers.test.ts`, the `env.test.ts` origin cases and `assessment-session.live.test.ts`.

  Session-scoped DB helpers used only by the routes (`requireFreshSessionInteractions`, `snapshotSessionInteractions`, `requireRecordedSaFeedback`, `findOpenAssessmentSession`, `OpenSessionError`) are removed if they have no other caller.
- [ ] **Docs:** the README and `.env.example` no longer mention the bridge, `EVE_AGENT_ORIGIN` or the bypass secret. The README explains how the UI reaches eve.
- [ ] **Unchanged:** the middleware keeps guarding `/eve/v1` with the cookie. Tests reference only live routes.
- [ ] **Checks:** `pnpm test`, `tsc` and `npx eve info` are clean.

## Answer

**Removed.**
- The bridge itself: `app/api/qualification/{assess,feedback}`, `lib/eve-session.ts` (including `eveClientHeaders` and the bypass header), and `getEveAgentOrigin` with its origin and `VERCEL_URL` schemas.
- The route-only DB helpers: `requireFreshSessionInteractions`, `snapshotSessionInteractions`, `requireRecordedSaFeedback`, `findOpenAssessmentSession` and `OpenSessionError`.
- The route tests: `assess`, `feedback`, `qualification-routes-eve`, `eve-client-headers`, `assessment-session.live` and the `env.test.ts` origin cases.

The two pure `formatSaDiscoveryDelta` cases moved to `tests/feedback-schema.test.ts`, together with the key tests. Model-mismatch coverage now lives in `tests/delegation.test.ts` (agent) and `tests/assessment-results.test.ts` (UI).

**Guard.** `tests/eve-only-surface.test.ts` fails if any of these come back in source or docs: the routes, `lib/eve-session.ts`, `EVE_AGENT_ORIGIN`, the bypass secret, or a server-side `eve/client` in `app/` or `components/`.

**Middleware bug found and fixed.** Unauthenticated `/eve/*` requests were redirected to `/login` (307). A `useEveAgent` fetch would follow the redirect and get HTML. They now get 401 JSON, like `/api/*`, which is tested.

**Endpoints.** The table in Context above is implemented as written. `/api/crm/reset` and `/api/crm/opportunity` stay as model-free data routes, and `/api/auth/*` stays.

**Deployment protection.** The app no longer needs `VERCEL_AUTOMATION_BYPASS_SECRET`: nothing calls its own deployment server-to-server any more. The browser's same-origin `/eve/v1` requests carry the Vercel Authentication cookie.

**Docs.**
- The README has a new "How the UI reaches the agent" section, and its Deployment-protection section is rewritten.
- The `.env.example` entries for `EVE_AGENT_ORIGIN` and the protection bypass are removed.
- `spec.md` §Testing Seams is amended.

**Pre-existing, not changed:** the middleware also gates eve's public `/eve/v1/health` behind the app cookie when `APP_PASSWORD` is set.
