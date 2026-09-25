import { describe, it, expect } from 'vitest';
import { assessmentReducer, LEGACY_SESSION_ERROR, type AssessmentView } from '@/lib/assessment-results';
import { assessTurnMessage } from '@/lib/assessment-turns';
import { jev, opportunity, system2 } from './fixtures/qualification';

// The workbench view is a projection of the root session's eve stream. One Assessment Session is
// one `run_assessment` call: its yields (action.partial), its discovery pause (input.requested /
// input.resolved), its result (action.result), the structured turn outcome (result.completed)
// and turn lifecycle events. Event shapes follow the eve 0.64 stream.

let seq = 0;
const ev = (type: string, data: Record<string, unknown>) => ({ type, data: { turnId: 'turn_0', sequence: 0, ...data }, meta: { id: `evt_${seq++}` } }) as any;
const ASSESS = assessTurnMessage('opp_acme_corp_001', 'anthropic/claude-sonnet-5');
const submitted = (message = ASSESS) => ({ type: 'client.message.submitted', data: { createdAt: 0, message, submissionId: 's1' } }) as any;
const requested = (toolName: string) => ev('actions.requested', { actions: [{ callId: `c_${toolName}`, kind: 'tool-call', toolName, input: {} }], stepIndex: 0 });
const ok = (toolName: string, output: unknown) =>
  ev('action.result', { status: 'completed', stepIndex: 0, result: { callId: `c_${toolName}`, kind: 'tool-result', toolName, output } });
const progress = (output: unknown) =>
  ev('action.partial', { stepIndex: 0, result: { callId: 'c_run_assessment', kind: 'tool-result', toolName: 'run_assessment', output } });
const failed = (toolName: string, message: string) =>
  ev('action.result', {
    status: 'failed',
    stepIndex: 0,
    error: { code: 'ACTION_RESULT_FAILED', message },
    result: { callId: `c_${toolName}`, kind: 'tool-result', toolName, isError: true, output: message },
  });
const question = (requestId = 'req_1') =>
  ev('input.requested', {
    stepIndex: 0,
    requests: [
      {
        requestId,
        kind: 'question',
        prompt: 'Answer the System 2 discovery form.',
        display: 'text',
        allowFreeform: true,
        action: { callId: 'c_run_assessment', input: {}, kind: 'tool-call', toolName: 'run_assessment' },
      },
    ],
  });
const responded = (text: string, requestId = 'req_1') => ({ type: 'client.input.responded', data: { createdAt: 0, responses: [{ requestId, text }] } }) as any;
const resolved = (outcome = 'answered', requestId = 'req_1') =>
  ev('input.resolved', { stepIndex: 0, resolutions: [{ requestId, kind: 'question', outcome }] });
const outcome = (value: unknown) => ev('result.completed', { stepIndex: 1, result: value });
const turnCompleted = () => ev('turn.completed', {});

const run = (events: any[], from: AssessmentView = assessmentReducer.initial()) => events.reduce(assessmentReducer.reduce, from);

const NEXT_STEPS = '[QUALIFIED] Run POC | Owner: AE | Focus: x | Watch: y';
const answer = JSON.stringify({ formResponses: { eb: 'CFO signs' }, feedbackKey: 'k1' });
const toPause = [
  submitted(),
  ev('turn.started', {}),
  requested('run_assessment'),
  progress({ stage: 'jev_scored', round: 'baseline', jevResult: jev({ overallScore: 56 }) }),
  progress({ stage: 'jev_saved', round: 'baseline', jevResult: jev({ overallScore: 56 }), opportunity: opportunity({ meddpicc_score: 56 }) }),
  progress({ stage: 'system2_saved', system2Result: system2(), opportunity: opportunity({ meddpicc_score: 56 }) }),
  question(),
  // Live eve 0.64 order: the turn completes as it parks on the question, then the session waits.
  turnCompleted(),
  ev('session.waiting', {}),
];
// Live eve 0.64 order after respond(): no input.resolved or turn.started for a workflow question.
const toClosed = [
  responded(answer),
  progress({ stage: 'feedback_recorded', feedback: { recorded: true, feedbackKey: 'k1' } }),
  progress({ stage: 'jev_scored', round: 'rescore', jevResult: jev({ overallScore: 89 }) }),
  progress({ stage: 'jev_saved', round: 'rescore', jevResult: jev({ overallScore: 89 }), opportunity: opportunity({ meddpicc_score: 89 }) }),
  ok('run_assessment', {
    stage: 'closed',
    writeback: { suggestedNextSteps: NEXT_STEPS, deltaScore: 33, qualificationStatus: 'qualified' },
    opportunity: opportunity({ meddpicc_score: 89, qualification_status: 'qualified', suggested_next_steps: NEXT_STEPS }),
  }),
  outcome({ outcome: 'completed', error: null }),
  turnCompleted(),
  ev('session.waiting', {}),
];

describe('assessmentReducer (workbench view from the run_assessment stream)', () => {
  it('starts ready with nothing assessed', () => {
    expect(assessmentReducer.initial()).toMatchObject({ phase: 'ready', jevResult: null, system2Result: null, pendingInput: null, error: null });
  });

  it('shows the assessment running as soon as it is submitted', () => {
    expect(run([submitted()]).phase).toBe('assessing');
    expect(run(toPause.slice(0, 3))).toMatchObject({ phase: 'assessing', runningTool: 'run_assessment' });
  });

  it('renders the Jev scores in the rubric as soon as Jev answers, before the write and before System 2', () => {
    const view = run(toPause.slice(0, 4));
    expect(view.phase).toBe('assessing');
    expect(view.jevResult?.overallScore).toBe(56);
    expect(view.opportunity).toBeNull(); // no Opportunity from the stream yet: the page's copy stays
    const withBase = run(toPause.slice(0, 4), { ...assessmentReducer.initial(), opportunity: opportunity({ meddpicc_score: null }) });
    expect(withBase.opportunity?.meddpicc_score).toBe(56);
    expect(withBase.opportunity?.qualification_status).toBe('in_review');
  });

  it('shows System 2 running between the saved Jev scores and the System 2 result', () => {
    expect(run(toPause.slice(0, 5)).system2Running).toBe(true);
    expect(run(toPause.slice(0, 6)).system2Running).toBe(false);
  });

  it('pauses awaiting SA feedback with scores, form and the pending question once the tool asks', () => {
    const view = run(toPause);
    expect(view).toMatchObject({ phase: 'awaiting_feedback', pendingInput: { requestId: 'req_1' }, error: null });
    expect(view.system2Result?.phase3Form.sections[0].fields[0].id).toBe('eb');
    expect(view.opportunity?.meddpicc_score).toBe(56);
  });

  it('runs to a closed session: answer, re-score, writeback', () => {
    const answering = run([responded(answer)], run(toPause));
    expect(answering).toMatchObject({ phase: 'submitting_feedback' });
    const closed = run(toClosed, run(toPause));
    expect(closed).toMatchObject({
      phase: 'closed',
      pendingInput: null,
      feedback: { recorded: true, feedbackKey: 'k1' },
      writeback: { deltaScore: 33, suggestedNextSteps: NEXT_STEPS },
      outcome: { outcome: 'completed', error: null },
      error: null,
    });
    expect(closed.opportunity?.qualification_status).toBe('qualified');
    expect(closed.jevResult?.overallScore).toBe(89);
    expect(closed.system2Result?.modelUsed).toBe('anthropic/claude-sonnet-5');
  });

  it('closes without a pause when the writeback without SA feedback was requested', () => {
    const view = run([
      submitted(assessTurnMessage('opp_globex_fintech_002', 'anthropic/claude-sonnet-5', { writeback: true })),
      ...toPause.slice(1, 6),
      ok('run_assessment', {
        stage: 'closed',
        writeback: { suggestedNextSteps: '[IN REVIEW] x | Owner: AE | Focus: y | Watch: z', deltaScore: 0, qualificationStatus: 'in_review' },
        opportunity: opportunity(),
      }),
      outcome({ outcome: 'completed', error: null }),
      turnCompleted(),
    ]);
    expect(view.phase).toBe('closed');
  });

  it('a reload after the SA answered replays to submitting, not back to an open form', () => {
    const replayed = run([...toPause, progress({ stage: 'feedback_recorded', feedback: { recorded: true, feedbackKey: 'k1' } })]);
    expect(replayed).toMatchObject({ phase: 'submitting_feedback', pendingInput: null });
  });

  it('rebuilds a paused session from a replayed stream (resume after reload)', () => {
    expect(run(toPause)).toEqual(run(toPause));
    expect(run(toPause).phase).toBe('awaiting_feedback');
  });

  it('fails loudly with the tool error, verbatim, when run_assessment fails', () => {
    const view = run([...toPause.slice(0, 4), failed('run_assessment', 'Jev 503 Service temporarily unavailable'), outcome({ outcome: 'failed', error: 'Jev 503' }), turnCompleted()]);
    expect(view).toMatchObject({ phase: 'failed', error: 'Jev 503 Service temporarily unavailable', system2Running: false });
  });

  it('fails when the answer is rejected (malformed or mismatched) and the session ends', () => {
    const view = run([responded('not json'), resolved(), failed('run_assessment', 'The SA discovery answer is not JSON')], run(toPause));
    expect(view).toMatchObject({ phase: 'failed', pendingInput: null, error: 'The SA discovery answer is not JSON' });
  });

  it('fails when eve does not accept the answer', () => {
    expect(run([responded(answer), resolved('invalid')], run(toPause))).toMatchObject({ phase: 'failed', error: expect.stringMatching(/not accepted \(invalid\)/) });
  });

  it('fails when the tool recorded different SA answers than the workbench sent (feedbackKey mismatch)', () => {
    const view = run([responded(answer), resolved(), progress({ stage: 'feedback_recorded', feedback: { recorded: true, feedbackKey: 'other' } })], run(toPause));
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/recorded different SA answers/);
  });

  it('fails when the agent reports a failed outcome even without a failed action', () => {
    expect(run([submitted(), outcome({ outcome: 'failed', error: 'run_assessment was not called' }), turnCompleted()])).toMatchObject({
      phase: 'failed',
      error: 'run_assessment was not called',
    });
  });

  it('fails when the turn ends without a writeback', () => {
    const view = run([...toPause.slice(0, 6), outcome({ outcome: 'completed', error: null }), turnCompleted()]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/without a CRM writeback/);
  });

  it('fails on a snapshot or result it cannot read instead of rendering partial data', () => {
    expect(run([submitted(), progress({ stage: 'jev_scored', round: 'baseline', jevResult: { nope: true } })]).error).toMatch(/Unreadable run_assessment progress/);
    expect(run([submitted(), ok('run_assessment', { stage: 'closed' })]).error).toMatch(/Unreadable run_assessment result/);
  });

  it('fails when System 2 ran with a model other than the one the turn asked for', () => {
    const view = run([submitted(assessTurnMessage('opp_acme_corp_001', 'openai/gpt-5.5')), ...toPause.slice(1, 6)]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/System 2 ran with anthropic\/claude-sonnet-5, not the requested model openai\/gpt-5.5/);
  });

  it('fails on turn.failed, session.failed and a failed submission', () => {
    expect(run([submitted(), ev('turn.failed', { code: 'X', message: 'model overloaded' })])).toMatchObject({ phase: 'failed', error: 'model overloaded' });
    expect(run([submitted(), ev('session.failed', { message: 'session expired' })]).error).toMatch(/session expired/);
    expect(
      run([submitted(), { type: 'client.message.failed', data: { createdAt: 0, message: 'm', submissionId: 's1', error: { message: '401 Unauthorized' } } } as any])
    ).toMatchObject({ phase: 'failed', error: '401 Unauthorized' });
  });

  it('fails when a closed Assessment Session receives another turn (a new assessment needs a new session)', () => {
    const view = run([submitted('again')], run(toClosed, run(toPause)));
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/already closed/);
  });

  it('marks a session from an older deployment (per-step tools) as legacy, so the workbench can start fresh', () => {
    const view = run([submitted('Assess opportunity opp_acme_corp_001: call crm_read_deal, then run_jev_scoring'), requested('run_jev_scoring')]);
    expect(view).toMatchObject({ phase: 'failed', legacySession: true, error: LEGACY_SESSION_ERROR });
  });

  it('ignores events it does not project (text, reasoning, other runtime events)', () => {
    const paused = run(toPause);
    expect(run([ev('message.appended', { messageDelta: 'hi' }), ev('session.waiting', {})], paused)).toEqual(paused);
  });
});
