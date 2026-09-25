# 11: Migrate web UI to useEveAgent and retire /api/qualification routes

**Status:** resolved (triaged: split into 12–17)

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

- [x] The workbench runs assess and feedback through `useEveAgent` only; no code calls `/api/qualification/*`.
- [x] One eve session spans assess and feedback for an opportunity, and survives a page reload.
- [x] `ContextColumn` still shows Jev scores and System 2 evidence/gaps per dimension.
- [x] The System 2 model dropdown still selects the model used by `run_system2_analysis`.
- [x] `/api/qualification/*` routes and `lib/eve-session.ts` are removed; `pnpm test`, `tsc` and `npx eve info` are clean.

## Comments

Triaged 2026-09-25: split into vertical slices 12–17. This file stays as the umbrella; each acceptance criterion above is owned by one slice:

- workbench on `useEveAgent`, no `/api/qualification/*` callers → 14
- one session across assess and feedback, surviving reload → 15
- `ContextColumn` scores and evidence/gaps from stream results → 13 (typed results) + 14 (render)
- model dropdown selects the System 2 model → 13 (enforced in the agent) + 14 (sent from the UI)
- bridge routes and `lib/eve-session.ts` removed, checks clean → 16

Added by triage: 12 (flaky System 2 persistence miss from issue 10) and 17 (live UI verification and final `pnpm eval`).
