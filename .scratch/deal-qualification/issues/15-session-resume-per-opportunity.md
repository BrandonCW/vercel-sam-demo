# 15: Resume the Assessment Session per Opportunity after a reload

**Status:** ready-for-agent

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
