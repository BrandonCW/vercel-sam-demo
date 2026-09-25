import { describe, it, expect } from 'vitest';
import { assessmentReducer, type AssessmentView } from '@/lib/assessment-results';
import { assessTurnMessage, feedbackTurnMessage } from '@/lib/assessment-turns';
import { jev, opportunity, system2 } from './fixtures/qualification';

// The workbench view is a projection of the root session's eve stream: typed tool results
// (action.result), the structured turn outcome (result.completed) and turn lifecycle events.
// Event shapes follow the eve 0.64 stream captured in .eve/evals (issue 10).

let seq = 0;
const ev = (type: string, data: Record<string, unknown>) => ({ type, data: { turnId: 'turn_0', sequence: 0, ...data }, meta: { id: `evt_${seq++}` } }) as any;
const submitted = (message = 'Assess opportunity opp_acme_corp_001') =>
  ({ type: 'client.message.submitted', data: { createdAt: 0, message, submissionId: 's1' } }) as any;
const requested = (toolName: string) => ev('actions.requested', { actions: [{ callId: `c_${toolName}`, kind: 'tool-call', toolName, input: {} }], stepIndex: 0 });
const ok = (toolName: string, output: unknown) =>
  ev('action.result', { status: 'completed', stepIndex: 0, result: { callId: `c_${toolName}`, kind: 'tool-result', toolName, output } });
const partial = (toolName: string, output: unknown) =>
  ev('action.partial', { stepIndex: 0, result: { callId: `c_${toolName}`, kind: 'tool-result', toolName, output } });
const failed = (toolName: string, message: string) =>
  ev('action.result', {
    status: 'failed',
    stepIndex: 0,
    error: { code: 'ACTION_RESULT_FAILED', message },
    result: { callId: `c_${toolName}`, kind: 'tool-result', toolName, isError: true, output: message },
  });
const outcome = (value: unknown) => ev('result.completed', { stepIndex: 1, result: value });
const turnCompleted = () => ev('turn.completed', {});

const run = (events: any[], from: AssessmentView = assessmentReducer.initial()) => events.reduce(assessmentReducer.reduce, from);

const assessTurn = [
  submitted(),
  ev('turn.started', {}),
  ok('crm_read_deal', { opportunity: opportunity({ meddpicc_score: null }) }),
  requested('run_jev_scoring'),
  ok('run_jev_scoring', { interactionId: 'i1', jevResult: jev({ overallScore: 56 }), opportunity: opportunity({ meddpicc_score: 56 }) }),
  requested('run_system2_analysis'),
  ok('run_system2_analysis', { interactionId: 'i2', system2Result: system2(), opportunity: opportunity({ meddpicc_score: 56 }) }),
  outcome({ outcome: 'completed', error: null }),
  turnCompleted(),
];

describe('assessmentReducer (workbench view from the eve stream)', () => {
  it('starts ready with nothing assessed', () => {
    expect(assessmentReducer.initial()).toMatchObject({ phase: 'ready', jevResult: null, system2Result: null, error: null });
  });

  it('shows the assessment running, and which step, as soon as turn 1 is submitted', () => {
    expect(run([submitted()]).phase).toBe('assessing');
    expect(run(assessTurn.slice(0, 4))).toMatchObject({ phase: 'assessing', runningTool: 'run_jev_scoring' });
  });

  it('pauses awaiting SA feedback with scores, form, model and Opportunity once turn 1 completes', () => {
    const view = run(assessTurn);
    expect(view.phase).toBe('awaiting_feedback');
    expect(view.runningTool).toBeNull();
    expect(view.jevResult?.overallScore).toBe(56);
    expect(view.system2Result?.modelUsed).toBe('anthropic/claude-sonnet-5');
    expect(view.system2Result?.phase3Form.sections[0].fields[0].id).toBe('eb');
    expect(view.opportunity?.meddpicc_score).toBe(56);
  });

  it('runs turn 2 to a closed session with the writeback and the updated Opportunity', () => {
    const paused = run(assessTurn);
    expect(run([submitted('The Solutions Architect submitted …')], paused).phase).toBe('submitting_feedback');
    const closed = run(
      [
        submitted('The Solutions Architect submitted …'),
        ev('turn.started', { sequence: 1, turnId: 'turn_1' }),
        ok('record_sa_feedback', { recorded: true, feedbackKey: 'k1' }),
        ok('run_jev_scoring', { interactionId: 'i3', jevResult: jev({ overallScore: 89 }), opportunity: opportunity({ meddpicc_score: 89 }) }),
        ok('crm_update_next_steps', {
          success: true,
          suggestedNextSteps: '[QUALIFIED] Run POC | Owner: AE | Focus: x | Watch: y',
          deltaScore: 33,
          sessionState: 'closed',
          opportunity: opportunity({ meddpicc_score: 89, qualification_status: 'qualified', suggested_next_steps: '[QUALIFIED] Run POC | Owner: AE | Focus: x | Watch: y' }),
        }),
        outcome({ outcome: 'completed', error: null }),
        turnCompleted(),
      ],
      paused
    );
    expect(closed).toMatchObject({
      phase: 'closed',
      feedback: { recorded: true, feedbackKey: 'k1' },
      writeback: { deltaScore: 33 },
      error: null,
    });
    expect(closed.opportunity?.qualification_status).toBe('qualified');
    expect(closed.system2Result?.modelUsed).toBe('anthropic/claude-sonnet-5'); // the form's session context survives
  });

  it('fails loudly with the tool error, verbatim, when a step fails', () => {
    const view = run([
      submitted(),
      ev('turn.started', {}),
      failed('run_jev_scoring', 'Jev 402 payment required'),
      outcome({ outcome: 'failed', error: 'Jev 402 payment required' }),
      turnCompleted(),
    ]);
    expect(view).toMatchObject({ phase: 'failed', error: 'Jev 402 payment required' });
  });

  it('fails when the agent reports a failed outcome even without a failed action', () => {
    expect(run([submitted(), outcome({ outcome: 'failed', error: 'run_system2_analysis was not called' }), turnCompleted()])).toMatchObject({
      phase: 'failed',
      error: 'run_system2_analysis was not called',
    });
  });

  it('fails when turn 1 claims success but produced no discovery form', () => {
    const view = run([submitted(), ok('run_jev_scoring', { interactionId: 'i1', jevResult: jev(), opportunity: opportunity() }), outcome({ outcome: 'completed', error: null }), turnCompleted()]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/without a System 2 discovery form/);
  });

  it('fails on a tool result it cannot read instead of rendering partial data', () => {
    const view = run([submitted(), ok('run_system2_analysis', { system2Result: { nope: true }, opportunity: opportunity() })]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/Unreadable run_system2_analysis result/);
  });

  it('fails on turn.failed, session.failed and a failed submission', () => {
    expect(run([submitted(), ev('turn.failed', { code: 'X', message: 'model overloaded' })])).toMatchObject({ phase: 'failed', error: 'model overloaded' });
    expect(run([submitted(), ev('session.failed', { message: 'session expired' })]).error).toMatch(/session expired/);
    expect(
      run([submitted(), { type: 'client.message.failed', data: { createdAt: 0, message: 'm', submissionId: 's1', error: { message: '401 Unauthorized' } } } as any])
    ).toMatchObject({ phase: 'failed', error: '401 Unauthorized' });
  });

  describe('progressive results (action.partial), before the CRM writes land', () => {
    const readDeal = [submitted(), ev('turn.started', {}), ok('crm_read_deal', { opportunity: opportunity({ meddpicc_score: null, competitive_flags: [] }) })];

    it('renders the Jev scores in the rubric as soon as Jev answers, before the write and before System 2', () => {
      const view = run([...readDeal, requested('run_jev_scoring'), partial('run_jev_scoring', { jevResult: jev({ overallScore: 56 }) })]);
      expect(view.phase).toBe('assessing');
      expect(view.jevResult?.overallScore).toBe(56);
      expect(view.opportunity?.meddpicc_score).toBe(56);
      expect(view.opportunity?.meddpicc_breakdown.economicBuyer).toMatchObject({ score: 3 });
      expect(view.opportunity?.meddpicc_breakdown.stageGate).toMatchObject({ gateReady: false });
      expect(view.opportunity?.competitive_flags).toEqual(['Cloudflare Pages', 'Netlify']);
      expect(view.opportunity?.qualification_status).toBe('in_review');
    });

    it('fails loudly when the write after the preliminary scores fails', () => {
      const view = run([
        ...readDeal,
        partial('run_jev_scoring', { jevResult: jev({ overallScore: 56 }) }),
        failed('run_jev_scoring', 'Postgres: connection terminated'),
      ]);
      expect(view).toMatchObject({ phase: 'failed', error: 'Postgres: connection terminated' });
    });

    it('fills in System 2 citations and a read-only form preview while System 2 streams', () => {
      const form = system2().phase3Form;
      const view = run([
        ...readDeal,
        ok('run_jev_scoring', {
          interactionId: 'i1',
          jevResult: jev(),
          opportunity: opportunity({ meddpicc_score: 54, meddpicc_breakdown: { economicBuyer: jev().dimensions.economicBuyer } }),
        }),
        partial('run_system2_analysis', {
          draft: { dimensionFindings: { economicBuyer: { citations: ['VP of E-Commerce mentioned budget'], gaps: [] } }, form: null },
        }),
        partial('run_system2_analysis', {
          draft: { dimensionFindings: { economicBuyer: { citations: ['VP of E-Commerce mentioned budget'], gaps: ['No sign-off'] } }, form },
        }),
      ]);
      expect(view.phase).toBe('assessing');
      expect(view.system2Result).toBeNull();
      expect(view.system2Draft?.form?.sections[0].fields[0].id).toBe('eb');
      expect(view.opportunity?.meddpicc_breakdown.economicBuyer).toMatchObject({
        score: 3,
        evidence: ['VP of E-Commerce mentioned budget'],
        gaps: ['No sign-off'],
      });
    });

    it('replaces the draft with the persisted System 2 result', () => {
      const view = run([
        ...readDeal,
        partial('run_system2_analysis', { draft: { dimensionFindings: {}, form: system2().phase3Form } }),
        ok('run_system2_analysis', { interactionId: 'i2', system2Result: system2(), opportunity: opportunity({ meddpicc_score: 54 }) }),
      ]);
      expect(view.system2Draft).toBeNull();
      expect(view.system2Result?.phase3Form.sections[0].fields[0].id).toBe('eb');
    });

    it('fails on a preliminary snapshot it cannot read instead of rendering it', () => {
      const view = run([...readDeal, partial('run_jev_scoring', { jevResult: { nope: true } })]);
      expect(view.phase).toBe('failed');
      expect(view.error).toMatch(/Unreadable run_jev_scoring snapshot/);
    });
  });

  it('ignores events it does not project (text, reasoning, subagent progress)', () => {
    const paused = run(assessTurn);
    expect(run([ev('message.appended', { messageDelta: 'hi' }), ev('subagent.called', {})], paused)).toEqual(paused);
  });

  it('records the structured outcome of the last turn', () => {
    expect(run(assessTurn).outcome).toEqual({ outcome: 'completed', error: null });
  });

  it('fails when the feedback turn ends without a writeback', () => {
    const paused = run(assessTurn);
    const view = run([submitted('The Solutions Architect submitted …'), ok('record_sa_feedback', { recorded: true, feedbackKey: 'k1' }), outcome({ outcome: 'completed', error: null }), turnCompleted()], paused);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/without a CRM writeback/);
  });

  it('fails when a closed Assessment Session receives another turn (a new assessment needs a new session)', () => {
    const closedView: AssessmentView = { ...run(assessTurn), phase: 'closed', writeback: { suggestedNextSteps: 's', deltaScore: 1 } };
    const view = run([submitted('again')], closedView);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/already closed/);
  });

  it('fails on a completed action result that names no tool', () => {
    const view = run([submitted(), ev('action.result', { status: 'completed', stepIndex: 0, result: { callId: 'c', kind: 'tool-result', output: {} } })]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/names no tool/);
  });

  it('fails when System 2 ran with a model other than the one the turn asked for', () => {
    const view = run([
      submitted(assessTurnMessage('opp_acme_corp_001', 'openai/gpt-5.5')),
      ok('run_system2_analysis', { interactionId: 'i2', system2Result: system2({ modelUsed: 'anthropic/claude-sonnet-5' }), opportunity: opportunity() }),
    ]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/System 2 ran with anthropic\/claude-sonnet-5, not the requested model openai\/gpt-5.5/);
  });

  it('fails when the agent recorded different SA answers than the workbench sent (feedbackKey mismatch)', () => {
    const paused = run(assessTurn);
    const message = feedbackTurnMessage({ opportunityId: 'opp_acme_corp_001', formResponses: { eb: 'x' } }, 'sent-key');
    const view = run([submitted(message), ok('record_sa_feedback', { recorded: true, feedbackKey: 'other-key' })], paused);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/recorded different SA answers/);
  });
});
