# 15: Resume the Assessment Session per Opportunity after a reload

**Status:** resolved

**Type:** task

**Blocked by:** 14

## Context

One durable eve session is one Assessment Session (09). A page reload must reattach to it rather than lose the paused form.

### How it works

- **Where the session ID lives.** `onSessionChange` saves `{ sessionId, streamIndex: 0 }` to `localStorage` under a per-Opportunity key.
- **What happens on mount.** The keyed workbench reads that value and calls `useEveAgent({ initialSession, resume: true })`. eve replays the durable stream, and the reducer rebuilds the whole view from events: scores, form, writeback.
- **Why the full stream.** We replay from index 0 and keep no event log. That avoids persisting large event arrays, and a session is at most two turns.
- **What clears the key.** Reset, and any new assessment (a new session replaces the key).
- **Why `localStorage` and not Postgres.** The session ID exists from the moment the session is created, before any row is written. So a reload during turn 1 still resumes the in-flight turn.

### Stale IDs

- **Retired or expired session:** the resume error is shown, the key is cleared, and the workbench returns to Ready.
- **CRM reset elsewhere:** the next turn fails loudly with the tool's "no System 2 result in this session" error. No fallback.

## Acceptance criteria

- [ ] Reloading during the paused state shows the same form, scores and model for the same session. No new session is created.
- [ ] Reloading mid-turn resumes streaming (`status: resuming → streaming`), and submission is disabled while resuming.
- [ ] Switching scenario remounts the hook for that Opportunity's own saved session.
- [ ] Reset and re-assess clear or replace the key. A resume failure is surfaced and clears the key.
- [ ] Unit tests cover the storage helper: key per opportunity, save, clear, and malformed values ignored loudly (console error, then treated as absent).

## Answer

- **`lib/ui/saved-assessment-session.ts`.** Holds one `localStorage` entry per Opportunity, `{ sessionId, resetMarker }`. On load it returns `{ sessionId, streamIndex: 0 }`, so the resumed session always replays in full.
  - **Stale after a reset.** The entry records the Opportunity's `last_reset_at` from when it was saved. `getOpportunity` now returns that marker, and `resetCrmDatabase` re-reads it after the reset. If the marker no longer matches, the Opportunity was reset somewhere (another browser, the agent, a test run) and the session's results were deleted. The entry is then dropped with a `console.warn` instead of resumed. This goes beyond the spec, which only covered resets from this browser.
  - **Bad entries and blocked storage.** A malformed entry is logged with `console.error` and dropped. Blocked storage (private mode) is logged, and the workbench runs without resume.
- **`AssessmentWorkbench`.** This is the component keyed by Opportunity and reset generation.
  - It reads the saved session once and passes `initialSession` with `resume: true`.
  - `onSessionChange` saves the session as soon as eve creates it, and clears it on `reset()`, which is how re-assess replaces it.
  - While resuming it shows RESUMING, and Start, the form, Reset and the scenario switch are locked.
  - The workbench mounts after hydration, because the server has no saved session. A "Loading workbench…" placeholder shows for one frame.
- **Resume failure.** The error is shown as "Could not resume the saved Assessment Session: …". The entry is cleared only when eve reports the session gone (`session_not_active` / `session_not_found`, 404 or 410). Other errors, such as network failures, keep it so a reload can retry. Start Assessment resets to a fresh session.
- **Reset** clears the entry and remounts the workbench.
- **Tests:**
  - `tests/saved-assessment-session.test.ts` (5): per-Opportunity keys, clear, a stale reset marker, malformed entries, blocked storage.
  - `tests/workbench-shell.test.tsx` (8 new): no session saved, resuming a saved one, save and clear on session change, locked while resuming, session-gone versus network resume failures, reset, and a scenario switch picking up the other Opportunity's session.
  - `tests/crm.test.ts`: the reset marker.

**Not proven here:** a live reload was not tested at this step; that is done in 17. According to eve's store source, the status stays `resuming` through catch-up and then goes to `ready` or `streaming`.
