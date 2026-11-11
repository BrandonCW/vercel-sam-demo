// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { assessmentReducer, type AssessmentView } from '@/lib/assessment-results';
import { assessTurnMessage } from '@/lib/assessment-turns';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';
import { LEGACY_SESSION_ERROR } from '@/lib/assessment-results';
import { INITIAL_MEDDPICC_BREAKDOWN } from '@/lib/db/scenarios';
import {
  loadSavedSession,
  loadSubmittingRequestId,
  saveSession,
  saveSubmittingRequestId,
} from '@/lib/ui/saved-assessment-session';
import { DEFAULT_SYSTEM2_MODEL } from '@/lib/types/crm';
import { parseSuggestedNextSteps, formatStageGateReadout } from '@/components/workbench/desk-os-shared';
import { jev, opportunity, system2 } from './fixtures/qualification';

// The workbench drives the Assessment Session through useEveAgent only. The hook is stubbed at
// the eve/react seam: tests set the projected view and status, and inspect what the UI sends.
const hook = vi.hoisted(() => ({
  options: undefined as any,
  state: { data: undefined as any, status: 'ready' as string, error: undefined as any, session: undefined as any },
  send: vi.fn(async () => {}),
  respond: vi.fn(async () => {}),
  reset: vi.fn(),
  cancel: vi.fn(async () => {}),
}));
vi.mock('eve/react', () => ({
  useEveAgent: (options: any) => {
    hook.options = options;
    return {
      ...hook.state,
      data: hook.state.data ?? options.reducer.initial(),
      send: hook.send,
      respond: hook.respond,
      reset: hook.reset,
      cancel: hook.cancel,
    };
  },
}));

const { LiveQualificationWorkbench } = await import('@/components/workbench/LiveQualificationWorkbench');

const base = opportunity({
  meddpicc_score: null,
  qualification_status: 'unqualified',
  meddpicc_breakdown: INITIAL_MEDDPICC_BREAKDOWN,
});
const view = (patch: Partial<AssessmentView>): AssessmentView => ({ ...assessmentReducer.initial(), ...patch });
const renderShell = () =>
  render(
    <LiveQualificationWorkbench
      initialOpportunity={base}
      initialScenarioId="scenario_acme_netlify"
      onModeChange={vi.fn()}
    />
  );

function assertZeroInternalJargon(container: HTMLElement) {
  const text = container.textContent ?? '';
  expect(text).not.toMatch(/System 1|System 2|\bJev\b|Eve Agent|Demo Scenario|Reset Demo/i);
}

describe('LiveQualificationWorkbench on useEveAgent', () => {
  beforeEach(() => {
    hook.state = { data: undefined, status: 'ready', error: undefined, session: undefined };
    hook.send.mockClear();
    hook.respond.mockClear();
    hook.reset.mockClear();
    hook.cancel.mockClear();
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('the workbench must not call fetch for assessments');
      })
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uses the Assessment Session reducer with prewarm enabled against same-origin eve routes', () => {
    const { container } = renderShell();
    expect(hook.options.reducer).toBe(assessmentReducer);
    expect(hook.options.prewarm).toBe(true);
    expect(hook.options.host).toBeUndefined();
    assertZeroInternalJargon(container);
  });

  it('renders crisp monochrome LIVE pill in TopNavBar and opens Workbench Settings on click', () => {
    renderShell();
    const livePill = screen.getByRole('button', { name: /^LIVE$/i });
    expect(livePill).toBeTruthy();
    expect(livePill.getAttribute('title')).toBe('Live AI inference via Gateway — click to configure');
    expect(livePill.className).toContain('bg-[#111215]');
    expect(livePill.className).toContain('text-[#FFFFFF]');

    // Clicking the LIVE pill opens Workbench Settings dialog
    fireEvent.click(livePill);
    expect(screen.getByRole('dialog', { name: /Workbench settings/i })).toBeTruthy();
  });

  it('starts the audit on a prewarmed fresh session without calling agent.reset(), using the selected analysis model', async () => {
    renderShell();
    // Clean primary CTA label (not concatenated)
    expect(screen.getByText('Run MEDDPICC Deal Audit →')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Workbench settings/i }));
    fireEvent.change(screen.getByLabelText('Select analysis model'), {
      target: { value: 'anthropic/claude-haiku-5.5' },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }))
    );
    // Skips agent.reset() when session is already fresh/idle so prewarmed session is preserved
    expect(hook.reset).not.toHaveBeenCalled();
    expect(hook.send).toHaveBeenCalledWith(assessTurnMessage(base.id, 'anthropic/claude-haiku-5.5'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows Deal Desk rubric evaluation status before baseline scores arrive, keeps Abort visible, and locks Settings controls', () => {
    hook.state.status = 'streaming';
    hook.state.data = view({ phase: 'assessing', runningTool: 'run_assessment' });
    const { container } = renderShell();

    expect(screen.getByText(/Evaluating MEDDPICC rubric & stage-gate criteria…/i)).toBeTruthy();
    expect(screen.getByText(/Scanning AE & SA notes against MEDDPICC rubric…/i)).toBeTruthy();
    assertZeroInternalJargon(container);

    // Abort button is visible during baseline scoring
    const abortBtn = screen.getByRole('button', { name: /^Abort$/i });
    fireEvent.click(abortBtn);
    expect(hook.cancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Workbench settings/i }));
    expect(screen.getByRole('button', { name: /Reset Opportunity Baseline/i })).toHaveProperty(
      'disabled',
      true
    );
    expect(screen.getByLabelText('Select active opportunity')).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Simulated AI \(Instant Replay\)/i })).toHaveProperty(
      'disabled',
      true
    );
  });

  it('unblocks Stage 1 immediately on jev_scored while deep synthesis runs: shows score, gate badge, 8 rows, bone shimmers, progressive CTA, and Abort without leaking seeded gaps', () => {
    hook.state.status = 'streaming';
    hook.state.data = view({
      phase: 'assessing',
      runningTool: 'run_assessment',
      jevResult: jev({ overallScore: 56 }),
      system2Running: true,
      opportunity: undefined as any,
    });
    const { container } = renderShell();

    // Stage 1 immediately renders composite score & real Stage Gate blocker readout
    expect(screen.getAllByText('56').length).toBeGreaterThan(0);
    expect(screen.getByText('Stage Gate 2 · 1 Gate Blocker Identified')).toBeTruthy();

    // Progressive disabled primary CTA (no layout-shifting blue status banner!)
    const progressiveBtn = screen.getByRole('button', { name: /Generating Discovery Checklist…/i });
    expect(progressiveBtn).toHaveProperty('disabled', true);

    // Abort button stays visible throughout deep gap synthesis (Bug 3.1 fix)
    const abortBtn = screen.getByRole('button', { name: /^Abort$/i });
    fireEvent.click(abortBtn);
    expect(hook.cancel).toHaveBeenCalledTimes(1);

    // Calm 2-line bone shimmers instead of 16 repeated "Pending System 2..." lines (Bug 3.2/3.4 fix)
    expect(screen.getByTestId('evidence-shimmer-economicBuyer')).toBeTruthy();
    expect(screen.getByTestId('gap-shimmer-economicBuyer')).toBeTruthy();
    expect(screen.queryByText(/Pending System 2/i)).toBeNull();
    expect(screen.queryByText('Criteria verified, no blocking gaps.')).toBeNull();

    // Zero seeded INITIAL_MEDDPICC_BREAKDOWN placeholder gaps leaked (Bug 3.3 fix)
    expect(screen.queryByText('Operational and business impact unquantified')).toBeNull();
    expect(screen.queryByText('Budget authority and discretionary sponsor unconfirmed')).toBeNull();

    // Zero internal jargon
    assertZeroInternalJargon(container);
  });

  it('renders the paused session: real Stage Gate badge, citations, gaps, and discovery form with zero jargon', () => {
    const scored = opportunity({
      meddpicc_score: 56,
      meddpicc_breakdown: {
        economicBuyer: {
          label: 'Economic Buyer',
          score: 3,
          status: 'unaddressed',
          confidence: 0.8,
          evidence: ['VP of E-Commerce mentioned budget'],
          gaps: ['No confirmed sign-off authority'],
        },
      },
    });
    hook.state.data = view({
      phase: 'awaiting_feedback',
      pendingInput: { requestId: 'req_1' },
      jevResult: jev({ overallScore: 56 }),
      system2Result: system2(),
      opportunity: scored,
    });
    const { container } = renderShell();

    expect(screen.getByText('Stage Gate 2 · 1 Gate Blocker Identified')).toBeTruthy();
    expect(screen.getByText(/VP of E-Commerce mentioned budget/)).toBeTruthy();
    expect(screen.getByText(/No confirmed sign-off authority/)).toBeTruthy();
    assertZeroInternalJargon(container);

    // Navigate to Stage 2 (Field Discovery Checklist) to inspect questions
    fireEvent.click(screen.getByRole('button', { name: /Answer 1 Discovery Question/i }));
    expect(screen.getByText('Who signs?')).toBeTruthy();
    expect(screen.getByText('Economic Buyer: 3/10')).toBeTruthy();
    assertZeroInternalJargon(container);
  });

  it('does not strand the operator in an empty Stage 2 when discoveryQuestionCount === 0', () => {
    hook.state.data = view({
      phase: 'awaiting_feedback',
      pendingInput: { requestId: 'req_empty' },
      jevResult: jev({
        overallScore: 82,
        stageGate: {
          gateReady: true,
          currentStage: 'Stage 2 - Discovery',
          targetStage: 'Stage 3 - Technical Validation',
          gateBlockers: [],
          blockingDimensions: [],
        },
      }),
      system2Result: system2({
        phase3Form: {
          opportunityId: 'opp_acme_corp_001',
          title: 'Discovery Checklist',
          summary: 'No gaps.',
          sections: [],
        },
      }),
      opportunity: opportunity({ meddpicc_score: 82 }),
    });
    renderShell();

    expect(screen.getByText('Stage Gate 2 · Gate Criteria Satisfied')).toBeTruthy();
    expect(screen.getByText('No Open Discovery Questions')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Answer .* Discovery Question/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Proceed to Stage 2/i })).toBeNull();
  });

  it("answers run_assessment's pending question with the verbatim answers and their feedbackKey, as JSON text", async () => {
    hook.state.status = 'streaming';
    hook.state.data = view({
      phase: 'awaiting_feedback',
      pendingInput: { requestId: 'req_1' },
      jevResult: jev(),
      system2Result: system2(),
      opportunity: opportunity(),
    });
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /Answer 1 Discovery Question/i }));
    fireEvent.change(screen.getByLabelText(/Who signs\?/), { target: { value: 'CFO Mark Ellis' } });
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/ }))
    );
    expect(hook.reset).not.toHaveBeenCalled();
    expect(hook.send).not.toHaveBeenCalled();
    const [responses, options] = hook.respond.mock.calls[0] as unknown as [
      { requestId: string; text: string }[],
      object?,
    ];
    expect(responses).toHaveLength(1);
    expect(responses[0].requestId).toBe('req_1');
    expect(JSON.parse(responses[0].text)).toEqual({
      formResponses: { eb: 'CFO Mark Ellis' },
      feedbackKey: await saFeedbackKey({ eb: 'CFO Mark Ellis' }),
    });
    expect(options).toBeUndefined();
  });

  it('parses pipe-delimited Suggested Next Steps without raw [QUALIFIED] tags or pipes, surfaces CRM writeback in DealContextCard, and provides Re-run Deal Audit', () => {
    const steps = '[QUALIFIED] Run POC | Owner: AE | Focus: ISR | Watch: Netlify';
    hook.state.data = view({
      phase: 'closed',
      baselineJevResult: jev({ overallScore: 54 }),
      jevResult: jev({
        overallScore: 72,
        stageGate: {
          gateReady: true,
          currentStage: 'Stage 2 - Discovery',
          targetStage: 'Stage 3 - Technical Validation',
          gateBlockers: [],
          blockingDimensions: [],
        },
      }),
      system2Result: system2(),
      opportunity: opportunity({
        meddpicc_score: 72,
        qualification_status: 'qualified',
        suggested_next_steps: steps,
      }),
    });
    const { container } = renderShell();

    // Stage Gate passes at 72/100 when stageGate.gateReady === true (no hardcoded 75 threshold!)
    expect(screen.getByText('Stage Gate 2 · Gate Criteria Satisfied')).toBeTruthy();
    expect(screen.getByText('Qualification Finalized (72/100)')).toBeTruthy();
    expect(screen.getByText('Synchronized to simulated Salesforce CRM.')).toBeTruthy();

    // Zero raw [QUALIFIED] tags or pipe delimiters in rendered DOM
    expect(container.textContent).not.toContain('[QUALIFIED]');
    expect(container.textContent).not.toContain(' | ');
    expect(screen.getAllByText('Run POC').length).toBeGreaterThanOrEqual(1);

    // Surfaced in DealContextCard CRM Writeback block
    const writebackCard = screen.getByTestId('crm-writeback-card');
    expect(within(writebackCard).getByText('Qualified')).toBeTruthy();
    expect(within(writebackCard).getByText('Run POC')).toBeTruthy();

    // Non-destructive Re-run Deal Audit button sits alongside Reset Opportunity Baseline
    expect(screen.getByRole('button', { name: /Re-run Deal Audit/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reset Opportunity Baseline/i })).toBeTruthy();
  });

  it('blocks Stage Gate at 76/100 when stageGate.gateReady is false (mandatory dimension blocker), and preserves negative deltas + baseline Stage 2 scores', () => {
    const baseline = jev({ overallScore: 60 });
    const rescored = jev({
      overallScore: 76,
      dimensions: {
        ...baseline.dimensions,
        identifyPain: { key: 'identifyPain', label: 'Identify Pain', weight: 0.2, score: 9, status: 'verified', confidence: 0.9 },
        champion: { key: 'champion', label: 'Champion', weight: 0.15, score: 4, status: 'partial', confidence: 0.8 }, // dropped from 7 -> 4 (-3)
        economicBuyer: { key: 'economicBuyer', label: 'Economic Buyer', weight: 0.15, score: 3, status: 'unaddressed', confidence: 0.8 },
        metrics: { key: 'metrics', label: 'Metrics', weight: 0.1, score: 6, status: 'partial', confidence: 0.8 }, // partial with 0 gaps
      },
      stageGate: {
        gateReady: false,
        currentStage: 'Stage 2 - Discovery',
        targetStage: 'Stage 3 - Technical Validation',
        gateBlockers: ['Economic Buyer score 3/10 is below minimum 4/10'],
        blockingDimensions: ['economicBuyer'],
      },
    });

    hook.state.data = view({
      phase: 'closed',
      baselineJevResult: baseline,
      jevResult: rescored,
      system2Result: system2(),
      opportunity: opportunity({
        meddpicc_score: 76,
        qualification_status: 'in_review',
        suggested_next_steps: '[IN REVIEW] Hold at Stage 2. | Owner: AE | Focus: EB | Watch: Netlify',
      }),
    });
    renderShell();

    // Fails Stage Gate despite 76/100 score because stageGate.gateReady === false
    expect(screen.getByText('Stage Gate 2 · 1 Blocker Remaining')).toBeTruthy();
    expect(screen.getByText('In Review · Gate Blocked (76/100)')).toBeTruthy();

    // Preserves negative delta (-3) on Champion (7 -> 4) in unadorned parenthetical notation
    expect(screen.getByText('(-3)')).toBeTruthy();

    // Only status === 'verified' && gaps.length === 0 renders "Verified in discovery" (Identify Pain & Competition = 2 rows, NOT partial Metrics)
    expect(screen.getAllByText('Verified in discovery')).toHaveLength(2);
    expect(screen.getAllByText('Partial evidence — additional validation needed.').length).toBeGreaterThan(0);

    // Inspecting Stage 2 retrospectively shows baseline 3/10 score on Economic Buyer
    fireEvent.click(screen.getByRole('button', { name: /Field Discovery Checklist/i }));
    expect(screen.getByText('Economic Buyer: 3/10')).toBeTruthy();
  });

  it('syncs out-of-date scenario on mount (Simulation -> Live), deduplicates handleScenarioChange fetch, and surfaces fetch errors', async () => {
    const globex = opportunity({ id: 'opp_globex_fintech_002', name: 'Globex FinTech - Wealth Portal Replatform' });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(globex), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    // Mount LiveQualificationWorkbench with Acme initialOpportunity while initialScenarioId is already Globex
    render(
      <LiveQualificationWorkbench
        initialOpportunity={base}
        initialScenarioId="scenario_globex_amplify"
        onModeChange={vi.fn()}
      />
    );

    // Immediately fetches Globex once on mount
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/crm/opportunity?scenarioId=scenario_globex_amplify');
    expect(screen.getAllByText(/Globex FinTech/i).length).toBeGreaterThan(0);

    // Switching scenario via Settings fetches ONCE (no double-fetch)
    const soylent = opportunity({ id: 'opp_soylent_retail_003', name: 'Soylent Retail - Headless Storefront' });
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(soylent), { status: 200 }));

    fireEvent.click(screen.getByRole('button', { name: /Workbench settings/i }));
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Select active opportunity'), {
        target: { value: 'scenario_soylent_headless' },
      });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText(/Soylent Retail/i).length).toBeGreaterThan(0);

    // Failed scenario fetch surfaces ProblemCauseFixBanner error instead of failing silently
    fetchMock.mockImplementationOnce(
      async () => new Response(JSON.stringify({ error: 'CRM database unreachable' }), { status: 503 })
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Select active opportunity'), {
        target: { value: 'scenario_acme_netlify' },
      });
    });
    expect(screen.getByRole('alert').textContent).toMatch(/Failed to load opportunity:.*CRM database unreachable/);
  });

  it('shows a failed writeback error verbatim and offers a new assessment', () => {
    hook.state.data = view({
      phase: 'failed',
      sentFeedbackKey: 'k',
      system2Result: system2(),
      opportunity: opportunity(),
      error: 'Gateway 402 payment required',
    });
    renderShell();
    expect(screen.getByRole('alert').textContent).toMatch(/Writeback failed:.*Gateway 402 payment required/);
    expect(screen.queryByRole('button', { name: /Submit Discovery Findings/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Start assessment/i })).toBeTruthy();
  });

  it('shows a failed assessment error verbatim and offers to start again', () => {
    hook.state.data = view({ phase: 'failed', error: 'Requested analysis model unavailable.' });
    renderShell();
    expect(screen.getByText(/Requested analysis model unavailable\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start assessment/i })).toBeTruthy();
  });

  it('shows a send that never reached the backend (e.g. 401) as a failure instead of dropping it', async () => {
    hook.send.mockRejectedValueOnce(new Error('HTTP 401 Unauthorized'));
    renderShell();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start assessment/i })));
    expect(screen.getByRole('alert').textContent).toMatch(/Assessment failed:.*HTTP 401 Unauthorized/);
  });

  it('retrying from ProblemCauseFixBanner after failure resets agent and transitions to blank state', async () => {
    hook.state.status = 'ready';
    hook.state.data = view({
      phase: 'failed',
      error: 'Inference gateway timed out',
    });
    render(
      <LiveQualificationWorkbench
        initialOpportunity={base}
        initialScenarioId="scenario_acme_netlify"
        onModeChange={vi.fn()}
        initialStageView="stage2"
      />
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    const retryBtn = screen.getByRole('button', { name: /^Retry$/i });
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(hook.reset).toHaveBeenCalled();
    expect(hook.send).toHaveBeenCalledWith(assessTurnMessage(base.id, DEFAULT_SYSTEM2_MODEL));
    expect(screen.getByText(/Stage Gate 2 · Unassessed Opportunity/i)).toBeTruthy();
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
      hook.state.data = view({
        phase: 'awaiting_feedback',
        pendingInput: { requestId: 'req_1' },
        jevResult: jev(),
        system2Result: system2(),
        opportunity: opportunity(),
      });
      renderShell();
      fireEvent.click(screen.getByRole('button', { name: /Answer 1 Discovery Question/i }));
      expect(screen.getByRole('button', { name: /Submit Discovery Findings/ })).toHaveProperty(
        'disabled',
        true
      );
    });

    it('surfaces a failed resume (expired or retired session) and forgets the saved session', () => {
      saveSession(base, { sessionId: 'wrun_GONE', streamIndex: 0 });
      hook.state.status = 'resuming';
      renderShell();
      act(() =>
        hook.options.onError(
          Object.assign(new Error('The session is no longer active.'), {
            code: 'session_not_active',
            status: 409,
          })
        )
      );
      expect(loadSavedSession(base)).toBeUndefined();
      expect(screen.getByRole('alert').textContent).toMatch(
        /Could not resume.*The session is no longer active\./
      );
    });

    it('forgets a session from an older deployment, says so, and offers a fresh assessment', () => {
      saveSession(base, { sessionId: 'wrun_OLD', streamIndex: 0 });
      hook.state.data = view({ phase: 'failed', legacySession: true, error: LEGACY_SESSION_ERROR });
      renderShell();
      expect(loadSavedSession(base)).toBeUndefined();
      expect(screen.getByRole('alert').textContent).toMatch(
        /older version of the agent.*Start a new assessment/
      );
      expect(screen.getByRole('button', { name: /Start assessment/i })).toBeTruthy();
    });

    it("forgets the saved session when eve no longer has the paused run's workflow", () => {
      saveSession(base, { sessionId: 'wrun_OLD', streamIndex: 0 });
      hook.state.status = 'resuming';
      renderShell();
      act(() =>
        hook.options.onError(
          new Error('Tool "run_assessment" is not registered as a workflow in this deployment (x).')
        )
      );
      expect(loadSavedSession(base)).toBeUndefined();
    });

    it('forgets the saved session when the opportunity baseline is reset', async () => {
      saveSession(base, { sessionId: 'wrun_SAVED', streamIndex: 0 });
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ success: true, opportunity: base }), { status: 200 }))
      );
      renderShell();
      fireEvent.click(screen.getByRole('button', { name: /Workbench settings/i }));
      await act(async () =>
        fireEvent.click(screen.getByRole('button', { name: /Reset Opportunity Baseline/i }))
      );
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
      fireEvent.click(screen.getByRole('button', { name: /Workbench settings/i }));
      await act(async () =>
        fireEvent.change(screen.getByLabelText('Select active opportunity'), {
          target: { value: 'scenario_globex_amplify' },
        })
      );
      expect(hook.options.initialSession).toEqual({ sessionId: 'wrun_GLOBEX', streamIndex: 0 });
      expect(hook.options.resume).toBe(true);
    });
  });

  describe('Settings Popover & Controlled TopNavBar', () => {
    it('opens settings popover with accessible dialog role and aria-label', () => {
      renderShell();
      expect(screen.queryByRole('dialog', { name: /Workbench settings/i })).toBeNull();
      const settingsBtn = screen.getByRole('button', { name: /Workbench settings/i });
      fireEvent.click(settingsBtn);
      const dialog = screen.getByRole('dialog', { name: /Workbench settings/i });
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('closes settings popover on Escape key and returns focus to trigger', () => {
      renderShell();
      const settingsBtn = screen.getByRole('button', { name: /Workbench settings/i });
      fireEvent.click(settingsBtn);
      expect(screen.getByRole('dialog', { name: /Workbench settings/i })).toBeTruthy();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: /Workbench settings/i })).toBeNull();
    });

    it('closes settings popover on click outside', () => {
      renderShell();
      const settingsBtn = screen.getByRole('button', { name: /Workbench settings/i });
      fireEvent.click(settingsBtn);
      const dialog = screen.getByRole('dialog', { name: /Workbench settings/i });
      expect(dialog).toBeTruthy();
      const backdrop = dialog.parentElement!;
      fireEvent.click(backdrop);
      expect(screen.queryByRole('dialog', { name: /Workbench settings/i })).toBeNull();
    });

    it('renders Deal Desk copy in Settings without raw enums, Salesforce pill, or System 1/2 jargon', () => {
      const { container } = renderShell();
      const header = screen.getByRole('banner');
      expect(header.textContent).not.toContain('READY_TO_ASSESS');
      expect(header.textContent).not.toContain('Salesforce connected');
      expect(screen.getByLabelText('Deal Desk Operator').textContent).toBe('DD');

      fireEvent.click(screen.getByRole('button', { name: /Workbench settings/i }));
      expect(screen.getByText(/Simulated AI \(Instant Replay\)/i)).toBeTruthy();
      expect(screen.getByText(/Live AI Inference/i)).toBeTruthy();
      expect(screen.getByLabelText('Select active opportunity')).toBeTruthy();
      expect(screen.getByLabelText('Select analysis model')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Reset Opportunity Baseline/i })).toBeTruthy();
      assertZeroInternalJargon(container);
    });
  });

  describe('Cancellation & mid-submit reload continuity (Issue #25)', () => {
    it('keeps EVALUATING state across a browser reload while SA feedback submission is in flight', () => {
      saveSubmittingRequestId(base.id, 'req_1');
      hook.state.status = 'streaming';
      hook.state.data = view({
        phase: 'awaiting_feedback',
        pendingInput: { requestId: 'req_1' },
        jevResult: jev(),
        system2Result: system2(),
        opportunity: opportunity(),
      });
      renderShell();
      expect(screen.getAllByText(/Re-scoring Deal & Updating CRM…/i).length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /Submit Discovery Findings/i })).toBeNull();
    });

    it('clears submittingRequestId and restores the Stage 2 discovery form when Turn 2 is cancelled', async () => {
      hook.state.status = 'streaming';
      hook.state.data = view({
        phase: 'awaiting_feedback',
        pendingInput: { requestId: 'req_1' },
        jevResult: jev(),
        system2Result: system2(),
        opportunity: opportunity(),
      });
      const { rerender } = renderShell();

      fireEvent.click(screen.getByRole('button', { name: /Answer 1 Discovery Question/i }));
      fireEvent.change(screen.getByLabelText(/Who signs\?/), { target: { value: 'CFO Mark Ellis' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Submit Discovery Findings/i }));
      });
      expect(loadSubmittingRequestId(base.id)).toBe('req_1');

      hook.state.data = view({
        phase: 'submitting_feedback',
        pendingInput: { requestId: 'req_1' },
        jevResult: jev(),
        system2Result: system2(),
        opportunity: opportunity(),
      });
      rerender(
        <LiveQualificationWorkbench
          initialOpportunity={base}
          initialScenarioId="scenario_acme_netlify"
          onModeChange={vi.fn()}
        />
      );
      expect(screen.getAllByText(/Re-scoring Deal & Updating CRM…/i).length).toBeGreaterThan(0);

      hook.state.status = 'ready';
      hook.state.data = view({
        phase: 'awaiting_feedback',
        pendingInput: { requestId: 'req_1' },
        jevResult: jev(),
        system2Result: system2(),
        opportunity: opportunity(),
      });
      rerender(
        <LiveQualificationWorkbench
          initialOpportunity={base}
          initialScenarioId="scenario_acme_netlify"
          onModeChange={vi.fn()}
        />
      );

      expect(loadSubmittingRequestId(base.id)).toBeNull();
      expect(screen.getByRole('button', { name: /Submit Discovery Findings/i })).toBeTruthy();
    });

    it('clears stale submittingRequestId on reload when ctx.ask retried with a new requestId or turn was cancelled', () => {
      saveSubmittingRequestId(base.id, 'req_1');
      hook.state.status = 'ready';
      hook.state.data = view({
        phase: 'awaiting_feedback',
        pendingInput: { requestId: 'req_2' },
        jevResult: jev(),
        system2Result: system2(),
        opportunity: opportunity(),
      });
      renderShell();

      expect(loadSubmittingRequestId(base.id)).toBeNull();
      expect(screen.queryByText(/Re-scoring Deal & Updating CRM…/i)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /Answer 1 Discovery Question/i }));
      expect(screen.getByRole('button', { name: /Submit Discovery Findings/i })).toBeTruthy();
    });

    it('cancels an active in-flight run before switching back to Simulation Mode', async () => {
      const onModeChange = vi.fn();
      hook.state.status = 'streaming';
      hook.state.data = view({
        phase: 'failed',
        error: 'Gateway error',
      });
      // Simulate active streaming turn when Switching to Simulation from error banner
      hook.state.data = view({
        phase: 'assessing',
        runningTool: 'run_assessment',
      });
      const { rerender } = render(
        <LiveQualificationWorkbench
          initialOpportunity={base}
          initialScenarioId="scenario_acme_netlify"
          onModeChange={onModeChange}
        />
      );
      // Surface sendError while assessing so ProblemCauseFixBanner Switch to Simulation button is clickable
      hook.send.mockRejectedValueOnce(new Error('Transient failure'));
      hook.state.status = 'ready';
      hook.state.data = view({ phase: 'ready' });
      rerender(
        <LiveQualificationWorkbench
          initialOpportunity={base}
          initialScenarioId="scenario_acme_netlify"
          onModeChange={onModeChange}
        />
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Start assessment/i }));
      });
      hook.state.status = 'streaming';
      hook.state.data = view({ phase: 'assessing', runningTool: 'run_assessment' });
      rerender(
        <LiveQualificationWorkbench
          initialOpportunity={base}
          initialScenarioId="scenario_acme_netlify"
          onModeChange={onModeChange}
        />
      );
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Switch to Simulation Mode/i }));
      });
      expect(hook.cancel).toHaveBeenCalled();
      expect(hook.reset).toHaveBeenCalled();
      expect(onModeChange).toHaveBeenCalledWith('simulation');
    });
  });

  describe('desk-os-shared pure helpers (parseSuggestedNextSteps & formatStageGateReadout)', () => {
    it('parses pipe-delimited SuggestedNextSteps cleanly without bracketed status tags or pipes', () => {
      const parsed = parseSuggestedNextSteps(
        '[QUALIFIED] Advance to Stage 3 - Technical Validation. Schedule POC. | Owner: SA (Lead) + AE | Focus: Turborepo & ISR | Watch: Netlify (high threat)'
      );
      expect(parsed).toEqual([
        {
          text: 'Advance to Stage 3 - Technical Validation. Schedule POC.',
          raw: 'Advance to Stage 3 - Technical Validation. Schedule POC.',
        },
        { label: 'Owner', text: 'SA (Lead) + AE', raw: 'Owner: SA (Lead) + AE' },
        { label: 'Focus', text: 'Turborepo & ISR', raw: 'Focus: Turborepo & ISR' },
        { label: 'Watch', text: 'Netlify (high threat)', raw: 'Watch: Netlify (high threat)' },
      ]);
    });

    it('drives Stage Gate readout strictly from stageGate.gateReady and qualificationStatus', () => {
      const passAt72 = formatStageGateReadout({
        stageGate: {
          gateReady: true,
          currentStage: 'Stage 2 - Discovery',
          targetStage: 'Stage 3 - Technical Validation',
          gateBlockers: [],
        },
        qualificationStatus: 'qualified',
        phase: 'stage3',
      });
      expect(passAt72.isSatisfied).toBe(true);
      expect(passAt72.label).toBe('Stage Gate 2 · Gate Criteria Satisfied');

      const failAt76 = formatStageGateReadout({
        stageGate: {
          gateReady: false,
          currentStage: 'Stage 2 - Discovery',
          targetStage: 'Stage 3 - Technical Validation',
          gateBlockers: ['Economic Buyer score 3/10 < minimum 4/10'],
        },
        qualificationStatus: 'in_review',
        phase: 'stage3',
      });
      expect(failAt76.isSatisfied).toBe(false);
      expect(failAt76.label).toBe('Stage Gate 2 · 1 Blocker Remaining');
    });
  });
});
