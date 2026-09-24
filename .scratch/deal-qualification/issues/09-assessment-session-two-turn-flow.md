# 09: Assessment Session as a Two-Turn eve Session

**What to build:**
Implement spec §6's Assessment Session lifecycle natively in eve, replacing the hand-rolled `sessionState` strings in `app/api/qualification/*`.

**Blocked by:** 08

**Status:** ready-for-agent

## Design

- **Turn 1 (assess)**: `reset?` → `crm_read_deal` → `run_jev_scoring` (via `qualification_assessor`) → `run_system2_analysis` (via `playbook_generator`) → persist checkpoint to `deal_interactions` (`questions_generated`). The JSON Render form is returned as a typed tool result. Turn ends.
- **Paused**: the eve session idles durably. No workflow is running, so no compute or token cost (spec §6 "zero-cost").
- **Turn 2 (feedback)**: SA form responses arrive as the next message on the same session (structured payload). The agent appends timestamped notes to `sa_notes`, runs Jev delta re-scoring, evaluates the gate, synthesizes Suggested Next Steps (in code), and calls `crm_update_next_steps`. Session marked `closed` in telemetry.
- The existing `/api/qualification/*` routes and UI are **not** changed in this ticket (UI migration to `useEveAgent` is a later ticket).

## Acceptance criteria

- [ ] Full lifecycle drivable from `npx eve dev` TUI and via `curl` against `/eve/v1/session`.
- [ ] Session ID from turn 1 accepts turn 2 hours later (durable).
- [ ] `deal_interactions` shows `initial_scoring`, `questions_generated`, `sa_feedback`, `writeback` rows.
- [ ] `ae_notes` unchanged after writeback.
