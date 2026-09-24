# 11: Migrate web UI to useEveAgent and retire /api/qualification routes

**Status:** needs-triage

**Blocked by:** 09

## Context

Since issue 08 every agent (System 1 Jev scoring, System 2 analysis with citations and gap callouts, next-steps writeback, the playbook generator) lives in the eve agent under `agent/`. The Next.js UI still calls `POST /api/qualification/assess` and `POST /api/qualification/feedback`. Those routes are now thin bridges: `lib/eve-session.ts` opens a fresh eve session through `eve/client` (same-origin `/eve/v1/*`, forwarding the `deal_qual_session` cookie), waits for a structured `{ outcome, error }` turn result, then reads the persisted results from Postgres to rebuild the old response shape.

That bridge was a deliberate stopgap so 08 could move the agents without a UI change. The UI should talk to eve directly with `useEveAgent` from `eve/react`, and the Assessment Session should be one durable eve session across both turns (issue 09) instead of one throwaway session per route call.

## Scope

- Replace the `fetch('/api/qualification/*')` calls in `components/workbench/*` with `useEveAgent` (same-origin, cookie auth already accepted by `agent/channels/eve.ts`).
- Render System 1 / System 2 progress and the discovery form from typed tool results in the eve stream, not from a route response.
- Persist the session ID per opportunity so a reload resumes the paused Assessment Session (`resume: true`).
- Delete `app/api/qualification/assess`, `app/api/qualification/feedback` and `lib/eve-session.ts`, plus their tests.

## Acceptance criteria

- [ ] The workbench runs assess and feedback through `useEveAgent` only; no code calls `/api/qualification/*`.
- [ ] One eve session spans assess and feedback for an opportunity, and survives a page reload.
- [ ] `ContextColumn` still shows Jev scores and System 2 evidence/gaps per dimension.
- [ ] The System 2 model dropdown still selects the model used by `run_system2_analysis`.
- [ ] `/api/qualification/*` routes and `lib/eve-session.ts` are removed; `pnpm test`, `tsc` and `npx eve info` are clean.
