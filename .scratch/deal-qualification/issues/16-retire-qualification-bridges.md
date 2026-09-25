# 16: Retire the /api/qualification bridges and the server-side eve client

**Status:** ready-for-agent

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
