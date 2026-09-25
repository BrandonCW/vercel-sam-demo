// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { assessmentReducer, type AssessmentView } from '@/lib/assessment-results';
import { TURN_OUTCOME_JSON_SCHEMA, assessTurnMessage } from '@/lib/assessment-turns';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';
import { LEGACY_SESSION_ERROR } from '@/lib/assessment-results';
import { loadSavedSession, saveSession } from '@/lib/ui/saved-assessment-session';
import { jev, opportunity, system2 } from './fixtures/qualification';

// The workbench drives the Assessment Session through useEveAgent only. The hook is stubbed at
// the eve/react seam: tests set the projected view and status, and inspect what the UI sends.
const hook = vi.hoisted(() => ({
  options: undefined as any,
  state: { data: undefined as any, status: 'ready' as string, error: undefined as any, session: undefined as any },
  send: vi.fn(async () => {}),
  respond: vi.fn(async () => {}),
  reset: vi.fn(),
}));
vi.mock('eve/react', () => ({
  useEveAgent: (options: any) => {
    hook.options = options;
    return { ...hook.state, data: hook.state.data ?? options.reducer.initial(), send: hook.send, respond: hook.respond, reset: hook.reset };
  },
}));

const { WorkbenchShell } = await import('@/components/workbench/WorkbenchShell');

const base = opportunity({ meddpicc_score: null, qualification_status: 'unqualified' });
const view = (patch: Partial<AssessmentView>): AssessmentView => ({ ...assessmentReducer.initial(), ...patch });
const renderShell = () => render(<WorkbenchShell initialOpportunity={base} initialScenarioId="scenario_acme_netlify" />);

describe('WorkbenchShell on useEveAgent', () => {
  beforeEach(() => {
    hook.state = { data: undefined, status: 'ready', error: undefined, session: undefined };
    hook.send.mockClear();
    hook.respond.mockClear();
    hook.reset.mockClear();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('the workbench must not call fetch for assessments'); }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uses the Assessment Session reducer against the same-origin eve routes', () => {
    renderShell();
    expect(hook.options.reducer).toBe(assessmentReducer);
    expect(hook.options.host).toBeUndefined();
  });

  it('starts the Assessment Session on a fresh session with the selected System 2 model and the structured outcome', async () => {
    renderShell();
    fireEvent.change(screen.getByLabelText('Select System 2 Model'), { target: { value: 'openai/gpt-5.5' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start Assessment/ })));
    expect(hook.reset).toHaveBeenCalled();
    expect(hook.send).toHaveBeenCalledWith(assessTurnMessage(base.id, 'openai/gpt-5.5'), { outputSchema: TURN_OUTCOME_JSON_SCHEMA });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the running step while System 1 / System 2 run, and locks Reset and scenario switching', () => {
    hook.state.status = 'streaming';
    hook.state.data = view({ phase: 'assessing', runningTool: 'run_assessment' });
    renderShell();
    expect(screen.getAllByText(/ANALYZING/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Reset Demo/ })).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Select Scenario')).toHaveProperty('disabled', true);
  });

  it('shows the Jev scores and the System 2 running indicator, and no form, until System 2 finishes', () => {
    hook.state.status = 'streaming';
    const scored = opportunity({
      meddpicc_score: 56,
      meddpicc_breakdown: { economicBuyer: { label: 'Economic Buyer', score: 3, status: 'unaddressed', confidence: 0.8, evidence: [], gaps: [] } },
    });
    hook.state.data = view({ phase: 'assessing', runningTool: 'run_assessment', jevResult: jev({ overallScore: 56 }), system2Running: true, opportunity: scored });
    renderShell();
    expect(screen.getByRole('status').textContent).toMatch(/System 2 analysis running/);
    expect(screen.getByText('56')).toBeTruthy();
    expect(screen.queryByText('Who signs?')).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit Discovery Findings/ })).toBeNull();
  });

  it('shows no System 2 running indicator before Jev scores arrive or once the assessment settles', () => {
    hook.state.status = 'streaming';
    hook.state.data = view({ phase: 'assessing', runningTool: 'run_assessment' });
    const { unmount } = renderShell();
    expect(screen.queryByText(/System 2 analysis running/)).toBeNull();
    unmount();
    hook.state.status = 'ready';
    hook.state.data = view({ phase: 'failed', jevResult: jev(), error: 'System 2 model failed' });
    renderShell();
    expect(screen.queryByText(/System 2 analysis running/)).toBeNull();
  });

  it('renders the paused session: discovery form, score and evidence from the stream results', () => {
    const scored = opportunity({
      meddpicc_score: 56,
      meddpicc_breakdown: { economicBuyer: { label: 'Economic Buyer', score: 3, status: 'unaddressed', confidence: 0.8, evidence: ['VP of E-Commerce mentioned budget'], gaps: ['No confirmed sign-off authority'] } },
    });
    hook.state.data = view({ phase: 'awaiting_feedback', pendingInput: { requestId: 'req_1' }, jevResult: jev({ overallScore: 56 }), system2Result: system2(), opportunity: scored });
    renderShell();
    expect(screen.getAllByText('PENDING_FEEDBACK').length).toBeGreaterThan(0);
    expect(screen.getByText('Who signs?')).toBeTruthy();
    expect(screen.getByText(/System 2 Reasoning Complete \(56\/100\)/)).toBeTruthy();
    // ContextColumn: System 2 evidence and gaps per dimension, from the persisted System 2 Opportunity.
    fireEvent.click(screen.getByText('Economic Buyer'));
    expect(screen.getByText(/VP of E-Commerce mentioned budget/)).toBeTruthy();
    expect(screen.getByText(/No confirmed sign-off authority/)).toBeTruthy();
  });

  it("answers run_assessment's pending question with the verbatim answers and their feedbackKey, as JSON text", async () => {
    hook.state.status = 'streaming'; // a parked turn may still hold its stream open
    hook.state.data = view({ phase: 'awaiting_feedback', pendingInput: { requestId: 'req_1' }, jevResult: jev(), system2Result: system2(), opportunity: opportunity() });
    renderShell();
    fireEvent.change(screen.getByLabelText(/Who signs\?/), { target: { value: 'CFO Mark Ellis' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/ })));
    expect(hook.reset).not.toHaveBeenCalled();
    expect(hook.send).not.toHaveBeenCalled();
    const [responses, options] = hook.respond.mock.calls[0] as unknown as [{ requestId: string; text: string }[], object];
    expect(responses).toHaveLength(1);
    expect(responses[0].requestId).toBe('req_1');
    expect(JSON.parse(responses[0].text)).toEqual({
      formResponses: { eb: 'CFO Mark Ellis' },
      feedbackKey: await saFeedbackKey({ eb: 'CFO Mark Ellis' }),
    });
    expect(options).toEqual({ outputSchema: TURN_OUTCOME_JSON_SCHEMA });
  });

  it('shows the written-back Suggested Next Steps when the session is closed', () => {
    const steps = '[QUALIFIED] Run POC | Owner: AE | Focus: ISR | Watch: Netlify';
    hook.state.data = view({
      phase: 'closed',
      system2Result: system2(),
      writeback: { suggestedNextSteps: steps, deltaScore: 33 },
      opportunity: opportunity({ meddpicc_score: 89, qualification_status: 'qualified', suggested_next_steps: steps }),
    });
    renderShell();
    expect(screen.getByText(steps)).toBeTruthy();
    expect(screen.getByText(/Qualification Finalized \(89\/100\)/)).toBeTruthy();
  });

  it('shows a failed writeback error verbatim and offers a new assessment (the run ended with its question)', () => {
    hook.state.data = view({ phase: 'failed', sentFeedbackKey: 'k', system2Result: system2(), opportunity: opportunity(), error: 'Jev 402 payment required' });
    renderShell();
    expect(screen.getByRole('alert').textContent).toMatch(/Writeback failed:.*Jev 402 payment required/);
    expect(screen.queryByRole('button', { name: /Submit Discovery Findings/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Start Assessment|Re-run Assessment/ })).toBeTruthy();
  });

  it('shows a failed assessment error verbatim and offers to start again', () => {
    hook.state.data = view({ phase: 'failed', error: 'System 2 ran with a, not the requested model b.' });
    renderShell();
    expect(screen.getByText(/System 2 ran with a, not the requested model b\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start Assessment/ })).toBeTruthy();
  });

  it('shows a send that never reached eve (e.g. 401) as a failure instead of dropping it', async () => {
    hook.send.mockRejectedValueOnce(new Error('HTTP 401 Unauthorized'));
    renderShell();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start Assessment/ })));
    expect(screen.getByRole('alert').textContent).toMatch(/Assessment failed:.*HTTP 401 Unauthorized/);
  });

  it('locks Start while a turn is in flight', () => {
    hook.state.status = 'submitted';
    renderShell();
    expect(screen.getByRole('button', { name: /Evaluating Opportunity/ })).toHaveProperty('disabled', true);
  });

  describe('resume per Opportunity (issue 15)', () => {
    it('starts without a session when this Opportunity has none saved', () => {
      renderShell();
      expect(hook.options.initialSession).toBeUndefined();
      expect(hook.options.resume).toBe(false);
    });

    it("reattaches to the Opportunity's saved session and replays it from the start", () => {
      saveSession(base, { sessionId: 'wrun_SAVED', streamIndex: 17 });
      saveSession({ id: 'opp_other', last_reset_at: null }, { sessionId: 'wrun_OTHER', streamIndex: 0 });
      renderShell();
      expect(hook.options.initialSession).toEqual({ sessionId: 'wrun_SAVED', streamIndex: 0 });
      expect(hook.options.resume).toBe(true);
    });

    it('remembers the session as soon as eve creates it, and forgets it when the hook resets', () => {
      renderShell();
      act(() => hook.options.onSessionChange({ sessionId: 'wrun_NEW', streamIndex: 1 }));
      expect(loadSavedSession(base)?.sessionId).toBe('wrun_NEW');
      act(() => hook.options.onSessionChange(undefined));
      expect(loadSavedSession(base)).toBeUndefined();
    });

    it('disables submission while resuming', () => {
      saveSession(base, { sessionId: 'wrun_SAVED', streamIndex: 0 });
      hook.state.status = 'resuming';
      hook.state.data = view({ phase: 'awaiting_feedback', pendingInput: { requestId: 'req_1' }, jevResult: jev(), system2Result: system2(), opportunity: opportunity() });
      renderShell();
      expect(screen.getAllByText('RESUMING').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Submit Discovery Findings/ })).toHaveProperty('disabled', true);
    });

    it('surfaces a failed resume (expired or retired session) and forgets the saved session', () => {
      saveSession(base, { sessionId: 'wrun_GONE', streamIndex: 0 });
      hook.state.status = 'resuming';
      renderShell();
      act(() => hook.options.onError(Object.assign(new Error('The session is no longer active.'), { code: 'session_not_active', status: 409 })));
      expect(loadSavedSession(base)).toBeUndefined();
      expect(screen.getByRole('alert').textContent).toMatch(/Could not resume.*The session is no longer active\./);
    });

    it('forgets a session from an older deployment, says so, and offers a fresh assessment', () => {
      saveSession(base, { sessionId: 'wrun_OLD', streamIndex: 0 });
      hook.state.data = view({ phase: 'failed', legacySession: true, error: LEGACY_SESSION_ERROR });
      renderShell();
      expect(loadSavedSession(base)).toBeUndefined();
      expect(screen.getByRole('alert').textContent).toMatch(/older version of the agent.*Start a new assessment/);
      expect(screen.getByRole('button', { name: /Start Assessment/ })).toBeTruthy();
    });

    it("forgets the saved session when eve no longer has the paused run's workflow", () => {
      saveSession(base, { sessionId: 'wrun_OLD', streamIndex: 0 });
      hook.state.status = 'resuming';
      renderShell();
      act(() => hook.options.onError(new Error('Tool "run_assessment" is not registered as a workflow in this deployment (x).')));
      expect(loadSavedSession(base)).toBeUndefined();
    });

    it('forgets the saved session when the demo is reset', async () => {
      saveSession(base, { sessionId: 'wrun_SAVED', streamIndex: 0 });
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, opportunity: base }), { status: 200 })));
      renderShell();
      await act(async () => fireEvent.click(screen.getByRole('button', { name: /Reset Demo/ })));
      expect(loadSavedSession(base)).toBeUndefined();
      expect(hook.options.resume).toBe(false);
    });

    it('keeps the saved session when the resume fails for another reason (e.g. the network), so a reload can retry', () => {
      saveSession(base, { sessionId: 'wrun_SAVED', streamIndex: 0 });
      hook.state.status = 'resuming';
      renderShell();
      act(() => hook.options.onError(new Error('Failed to fetch')));
      expect(loadSavedSession(base)?.sessionId).toBe('wrun_SAVED');
      expect(screen.getByRole('alert').textContent).toMatch(/Failed to fetch/);
    });

    it("switching scenario remounts on the other Opportunity's own saved session", async () => {
      const globex = opportunity({ id: 'opp_globex_fintech_002', name: 'Globex' });
      saveSession(globex, { sessionId: 'wrun_GLOBEX', streamIndex: 0 });
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(globex), { status: 200 })));
      renderShell();
      expect(hook.options.initialSession).toBeUndefined();
      await act(async () => fireEvent.change(screen.getByLabelText('Select Scenario'), { target: { value: 'scenario_globex_amplify' } }));
      expect(hook.options.initialSession).toEqual({ sessionId: 'wrun_GLOBEX', streamIndex: 0 });
      expect(hook.options.resume).toBe(true);
    });
  });
});
