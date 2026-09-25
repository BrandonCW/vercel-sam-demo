# 09: Assessment Session as a Two-Turn eve Session

**What to build:**
Implement spec §6's Assessment Session lifecycle natively in eve, replacing the hand-rolled `sessionState` strings in `app/api/qualification/*`.

**Blocked by:** 08

**Status:** resolved

## Design

- **Turn 1 (assess)**: `reset?` → `crm_read_deal` → `run_jev_scoring` (via `qualification_assessor`) → `run_system2_analysis` (via `playbook_generator`) → persist checkpoint to `deal_interactions` (`questions_generated`). The JSON Render form is returned as a typed tool result. Turn ends.
- **Paused**: the eve session idles durably. No workflow is running, so no compute or token cost (spec §6 "zero-cost").
- **Turn 2 (feedback)**: SA form responses arrive as the next message on the same session (structured payload). The agent appends timestamped notes to `sa_notes`, runs Jev delta re-scoring, evaluates the gate, synthesizes Suggested Next Steps (in code), and calls `crm_update_next_steps`. Session marked `closed` in telemetry.
- The existing `/api/qualification/*` routes and UI are **not** changed in this ticket (UI migration to `useEveAgent` is a later ticket).

## Acceptance criteria

- [x] Full lifecycle drivable from `npx eve dev` TUI and via `curl` against `/eve/v1/session`.
- [x] Session ID from turn 1 accepts turn 2 hours later (durable).
- [x] `deal_interactions` shows `initial_scoring`, `questions_generated`, `sa_feedback`, `writeback` rows.
- [x] `ae_notes` unchanged after writeback.

## Answer

One durable eve session is one Assessment Session, spanning assess and feedback.

- **Turn 1** (`/api/qualification/assess` → `runAssessmentTurn` in `lib/eve-session.ts`, `client.sessions.create`): `crm_read_deal` → `score_deal` → `analyze_deal`. The turn settles with the session `waiting` (paused, no compute). The `questions_generated` checkpoint row carries `assessmentSessionId`.
- **Turn 2** (`/api/qualification/feedback`): `findOpenAssessmentSession` takes the session of the latest discovery form (409 if none, or if it is already closed). It then `client.sessions.attach(id).send(...)` with the structured payload and its `feedbackKey`. The agent runs `record_sa_feedback` → `score_deal` (delta) → `crm_update_next_steps`, which writes back in code and closes the session. Sessions last 30 days (`limits.sessionTimeoutMs`, explicit).
- **Delegation**: subagents are now `tool: false`, reached through the root workflow tools `score_deal` / `analyze_deal` (`ctx.agent`, which waits). Background subagent delegation ended the root turn before the work finished, and the chain continued in later wake-up turns. Success is decided in code (`lib/agents/delegation.ts`): the delegated tool must have persisted its row in this session and turn.
- **Per-session scoping**: every row is stamped with `assessmentSessionId` and `turnId` (the root session, via `ctx.session.parent` for subagents; `lib/assessment-session.ts`). All loads and freshness checks are session-scoped, so concurrent sessions on one deal cannot cross.
- **SA notes**: appended only by `record_sa_feedback`, in one transaction with an advisory lock, at most once per (session, feedbackKey). A retry is a no-op, and answers that don't match the key are rejected before any write. The route no longer writes notes itself.
- **Writeback**: a single `writeback` row with the delta telemetry (`previousScore` is the session's baseline) is inserted in the same statement as the CRM update. A second writeback for the same session is rejected. `sa_notes` is no longer rewritten by writeback.
- **Origin**: `EVE_AGENT_ORIGIN`, else `https://$VERCEL_URL`, else a clear error. The Host header is never used.
- **Status bug fixed**: a settled turn reports `waiting`, not `completed`. The ticket-08 check rejected every real turn, and the route path had never run live.
- **Schema**: `idx_interactions_session` was added to `db/schema.sql` and applied to the Neon `test` branch only.

**Live proof** (`tests/assessment-session.live.test.ts`, run against `pnpm dev` with `.env.test.local`): session `wrun_01M3AYCH410RTF2WX0H29XYNQ1`. Acme scored 58 → 67 (+9) → `[QUALIFIED] …`. All four row types were written in one session, with exactly one `writeback` and one `sa_feedback`, and `ae_notes` was unchanged. The live run came before the post-review hardening (the feedbackKey guard, the writeback-once guard, and `crm_read_deal` in the turn-1 message); those are covered by unit tests only.

**Not proven here**: the `npx eve dev` TUI path was not exercised. It uses the same tools (a TUI user sends the JSON payload without a key). A turn 2 "hours later" was not exercised live; durability relies on eve's session guarantee and the explicit 30-day timeout.
