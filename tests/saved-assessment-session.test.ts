// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearSavedSession, loadSavedSession, saveSession } from '@/lib/ui/saved-assessment-session';

// One Assessment Session per Opportunity, remembered in this browser so a reload resumes it.
const oppA = { id: 'opp_a', last_reset_at: '2026-09-25T01:00:00.000Z' };
const oppB = { id: 'opp_b', last_reset_at: null };

describe('saved Assessment Session per Opportunity', () => {
  beforeEach(() => localStorage.clear());

  it('saves and loads the session per opportunity, always replaying from the start of the stream', () => {
    saveSession(oppA, { sessionId: 'wrun_A', streamIndex: 42 });
    saveSession(oppB, { sessionId: 'wrun_B', streamIndex: 3 });
    expect(loadSavedSession(oppA)).toEqual({ sessionId: 'wrun_A', streamIndex: 0 });
    expect(loadSavedSession(oppB)).toEqual({ sessionId: 'wrun_B', streamIndex: 0 });
    expect(loadSavedSession({ id: 'opp_c', last_reset_at: null })).toBeUndefined();
  });

  it('clears one opportunity without touching the others', () => {
    saveSession(oppA, { sessionId: 'wrun_A', streamIndex: 0 });
    saveSession(oppB, { sessionId: 'wrun_B', streamIndex: 0 });
    clearSavedSession(oppA.id);
    expect(loadSavedSession(oppA)).toBeUndefined();
    expect(loadSavedSession(oppB)?.sessionId).toBe('wrun_B');
  });

  it('drops a session saved before the Opportunity was reset (anywhere), since the reset deleted its results', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveSession(oppA, { sessionId: 'wrun_A', streamIndex: 0 });
    expect(loadSavedSession({ ...oppA, last_reset_at: '2026-09-25T02:00:00.000Z' })).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/opp_a was reset .* not resuming wrun_A/));
    expect(loadSavedSession(oppA)).toBeUndefined();
    warn.mockRestore();
  });

  it('reports a malformed saved value loudly, drops it and treats it as absent', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('deal-qual:assessment-session:opp_a', '{"sessionId": 7}');
    expect(loadSavedSession(oppA)).toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/Ignoring a malformed saved Assessment Session for opp_a/));
    expect(localStorage.getItem('deal-qual:assessment-session:opp_a')).toBeNull();
    error.mockRestore();
  });

  it('reports blocked browser storage loudly instead of crashing the workbench', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });
    expect(loadSavedSession(oppA)).toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/cannot resume Assessment Sessions.*storage disabled/));
    getItem.mockRestore();
    error.mockRestore();
  });
});
