// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { assessmentReducer, type AssessmentView } from '@/lib/assessment-results';
import { TURN_OUTCOME_JSON_SCHEMA, assessTurnMessage } from '@/lib/assessment-turns';
import { jev, opportunity, system2 } from './fixtures/qualification';

// The workbench drives the Assessment Session through useEveAgent only. The hook is stubbed at
// the eve/react seam: tests set the projected view and status, and inspect what the UI sends.
const hook = vi.hoisted(() => ({
  options: undefined as any,
  state: { data: undefined as any, status: 'ready' as string, error: undefined as any, session: undefined as any },
  send: vi.fn(async () => {}),
  reset: vi.fn(),
}));
vi.mock('eve/react', () => ({
  useEveAgent: (options: any) => {
    hook.options = options;
    return { ...hook.state, data: hook.state.data ?? options.reducer.initial(), send: hook.send, reset: hook.reset };
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
    hook.reset.mockClear();
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

  it('starts turn 1 on a fresh session with the selected System 2 model and the structured outcome', async () => {
    renderShell();
    fireEvent.change(screen.getByLabelText('Select System 2 Model'), { target: { value: 'openai/gpt-5.5' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start Assessment/ })));
    expect(hook.reset).toHaveBeenCalled();
    expect(hook.send).toHaveBeenCalledWith(assessTurnMessage(base.id, 'openai/gpt-5.5'), { outputSchema: TURN_OUTCOME_JSON_SCHEMA });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the running step while System 1 / System 2 run, and locks Reset and scenario switching', () => {
    hook.state.status = 'streaming';
    hook.state.data = view({ phase: 'assessing', turn: 'assess', runningTool: 'analyze_deal' });
    renderShell();
    expect(screen.getAllByText(/ANALYZING/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Reset Demo/ })).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Select Scenario')).toHaveProperty('disabled', true);
  });

  it('renders the paused session: discovery form, score and evidence from the stream results', () => {
    const scored = opportunity({
      meddpicc_score: 56,
      meddpicc_breakdown: { economicBuyer: { label: 'Economic Buyer', score: 3, status: 'unaddressed', confidence: 0.8, evidence: ['VP of E-Commerce mentioned budget'], gaps: ['No confirmed sign-off authority'] } },
    });
    hook.state.data = view({ phase: 'awaiting_feedback', turn: 'assess', jevResult: jev({ overallScore: 56 }), system2Result: system2(), opportunity: scored });
    renderShell();
    expect(screen.getAllByText('PENDING_FEEDBACK').length).toBeGreaterThan(0);
    expect(screen.getByText('Who signs?')).toBeTruthy();
    expect(screen.getByText(/System 2 Reasoning Complete \(56\/100\)/)).toBeTruthy();
    // ContextColumn: System 2 evidence and gaps per dimension, from the analyze_deal Opportunity.
    fireEvent.click(screen.getByText('Economic Buyer'));
    expect(screen.getByText(/VP of E-Commerce mentioned budget/)).toBeTruthy();
    expect(screen.getByText(/No confirmed sign-off authority/)).toBeTruthy();
  });

  it('sends turn 2 to the same session with the verbatim answers and their feedbackKey', async () => {
    hook.state.data = view({ phase: 'awaiting_feedback', turn: 'assess', jevResult: jev(), system2Result: system2(), opportunity: opportunity() });
    renderShell();
    fireEvent.change(screen.getByLabelText(/Who signs\?/), { target: { value: 'CFO Mark Ellis' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/ })));
    expect(hook.reset).not.toHaveBeenCalled();
    const [message, options] = hook.send.mock.calls[0] as unknown as [string, object];
    expect(message).toMatch(/record_sa_feedback with exactly this payload and feedbackKey [0-9a-f]{64}/);
    expect(message).toContain('"formResponses":{"eb":"CFO Mark Ellis"}');
    expect(options).toEqual({ outputSchema: TURN_OUTCOME_JSON_SCHEMA });
  });

  it('shows the written-back Suggested Next Steps when the session is closed', () => {
    const steps = '[QUALIFIED] Run POC | Owner: AE | Focus: ISR | Watch: Netlify';
    hook.state.data = view({
      phase: 'closed',
      turn: 'feedback',
      system2Result: system2(),
      writeback: { suggestedNextSteps: steps, deltaScore: 33 },
      opportunity: opportunity({ meddpicc_score: 89, qualification_status: 'qualified', suggested_next_steps: steps }),
    });
    renderShell();
    expect(screen.getByText(steps)).toBeTruthy();
    expect(screen.getByText(/Qualification Finalized \(89\/100\)/)).toBeTruthy();
  });

  it('keeps the form after a failed feedback turn and shows the eve error verbatim', () => {
    hook.state.data = view({ phase: 'failed', turn: 'feedback', system2Result: system2(), opportunity: opportunity(), error: 'Jev 402 payment required' });
    renderShell();
    expect(screen.getByText('Who signs?')).toBeTruthy();
    expect(screen.getByText(/Jev 402 payment required/)).toBeTruthy();
  });

  it('shows a failed assessment error verbatim and offers to start again', () => {
    hook.state.data = view({ phase: 'failed', turn: 'assess', error: 'System 2 ran with a, not the requested model b.' });
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
});
