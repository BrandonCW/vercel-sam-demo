import { describe, it, expect } from 'vitest';
import { assessmentReducer, type AssessmentView } from '@/lib/assessment-results';
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
  requested('score_deal'),
  ok('score_deal', { interactionId: 'i1', jevResult: jev({ overallScore: 56 }), opportunity: opportunity({ meddpicc_score: 56 }), report: 'r' }),
  requested('analyze_deal'),
  ok('analyze_deal', { interactionId: 'i2', system2Result: system2(), opportunity: opportunity({ meddpicc_score: 56 }), report: 'r' }),
  outcome({ outcome: 'completed', error: null }),
  turnCompleted(),
];

describe('assessmentReducer (workbench view from the eve stream)', () => {
  it('starts ready with nothing assessed', () => {
    expect(assessmentReducer.initial()).toMatchObject({ phase: 'ready', jevResult: null, system2Result: null, error: null });
  });

  it('shows the assessment running, and which step, as soon as turn 1 is submitted', () => {
    expect(run([submitted()]).phase).toBe('assessing');
    expect(run(assessTurn.slice(0, 4))).toMatchObject({ phase: 'assessing', runningTool: 'score_deal' });
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
        ok('score_deal', { interactionId: 'i3', jevResult: jev({ overallScore: 89 }), opportunity: opportunity({ meddpicc_score: 89 }), report: 'r' }),
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
      failed('score_deal', 'Jev 402 payment required'),
      outcome({ outcome: 'failed', error: 'Jev 402 payment required' }),
      turnCompleted(),
    ]);
    expect(view).toMatchObject({ phase: 'failed', error: 'Jev 402 payment required' });
  });

  it('fails when the agent reports a failed outcome even without a failed action', () => {
    expect(run([submitted(), outcome({ outcome: 'failed', error: 'analyze_deal was not called' }), turnCompleted()])).toMatchObject({
      phase: 'failed',
      error: 'analyze_deal was not called',
    });
  });

  it('fails when turn 1 claims success but produced no discovery form', () => {
    const view = run([submitted(), ok('score_deal', { interactionId: 'i1', jevResult: jev(), opportunity: opportunity(), report: 'r' }), outcome({ outcome: 'completed', error: null }), turnCompleted()]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/without a System 2 discovery form/);
  });

  it('fails on a tool result it cannot read instead of rendering partial data', () => {
    const view = run([submitted(), ok('analyze_deal', { system2Result: { nope: true }, opportunity: opportunity() })]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/Unreadable analyze_deal result/);
  });

  it('fails on turn.failed, session.failed and a failed submission', () => {
    expect(run([submitted(), ev('turn.failed', { code: 'X', message: 'model overloaded' })])).toMatchObject({ phase: 'failed', error: 'model overloaded' });
    expect(run([submitted(), ev('session.failed', { message: 'session expired' })]).error).toMatch(/session expired/);
    expect(
      run([submitted(), { type: 'client.message.failed', data: { createdAt: 0, message: 'm', submissionId: 's1', error: { message: '401 Unauthorized' } } } as any])
    ).toMatchObject({ phase: 'failed', error: '401 Unauthorized' });
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
});
