import { describe, it, expect } from 'vitest';
import { assessmentReducer, LEGACY_SESSION_ERROR, type AssessmentView } from '@/lib/assessment-results';
import { assessTurnMessage } from '@/lib/assessment-turns';
import { jev, opportunity, system2 } from './fixtures/qualification';

const INTERNAL_JARGON = /\b(System 1|System 2|Jev|eve|run_assessment)\b/i;

let seq = 0;
const ev = (type: string, data: Record<string, unknown>) => ({ type, data: { turnId: 'turn_0', sequence: 0, ...data }, meta: { id: `evt_${seq++}` } }) as any;
const ASSESS = assessTurnMessage('opp_acme_corp_001', 'google/gemini-3.8-flash');
const INPUT = { opportunityId: 'opp_acme_corp_001', model: 'google/gemini-3.8-flash' };
const submitted = (message = ASSESS) => ({ type: 'client.message.submitted', data: { createdAt: 0, message, submissionId: 's1' } }) as any;
const requested = (toolName: string, input: Record<string, unknown> = {}) =>
  ev('actions.requested', { actions: [{ callId: `c_${toolName}`, kind: 'tool-call', toolName, input }], stepIndex: 0 });
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
        prompt: 'Submit Solutions Architect discovery responses.',
        display: 'text',
        allowFreeform: true,
        action: { callId: 'c_run_assessment', input: {}, kind: 'tool-call', toolName: 'run_assessment' },
      },
    ],
  });
const responded = (text: string, requestId = 'req_1') => ({ type: 'client.input.responded', data: { createdAt: 0, responses: [{ requestId, text }] } }) as any;
const resolved = (outcome = 'answered', requestId = 'req_1') =>
  ev('input.resolved', { stepIndex: 0, resolutions: [{ requestId, kind: 'question', outcome }] });
const turnCompleted = () => ev('turn.completed', {});

const run = (events: any[], from: AssessmentView = assessmentReducer.initial()) => events.reduce(assessmentReducer.reduce, from);

const NEXT_STEPS = '[QUALIFIED] Run POC | Owner: AE | Focus: x | Watch: y';
const verdict = (patch: Record<string, unknown> = {}) => ({
  status: 'written_back',
  opportunityId: 'opp_acme_corp_001',
  qualificationStatus: 'qualified',
  baselineScore: 56,
  finalScore: 89,
  delta: 33,
  nextSteps: NEXT_STEPS,
  writebackId: 'int_wb_1',
  feedback: 'recorded',
  opportunity: opportunity({ meddpicc_score: 89, qualification_status: 'qualified', suggested_next_steps: NEXT_STEPS }),
  ...patch,
});
const answer = JSON.stringify({ formResponses: { eb: 'CFO signs' }, feedbackKey: 'k1' });
const toPause = [
  submitted(),
  ev('turn.started', {}),
  requested('run_assessment', INPUT),
  progress({ stage: 'jev_scored', round: 'baseline', jevResult: jev({ overallScore: 56 }) }),
  progress({ stage: 'jev_saved', round: 'baseline', jevResult: jev({ overallScore: 56 }), opportunity: opportunity({ meddpicc_score: 56 }) }),
  progress({ stage: 'system2_saved', system2Result: system2(), opportunity: opportunity({ meddpicc_score: 56 }) }),
  question(),
  turnCompleted(),
  ev('session.waiting', {}),
];
const rescoreJevVerified = jev({
  overallScore: 89,
  dimensions: {
    ...jev().dimensions,
    economicBuyer: {
      key: 'economicBuyer',
      label: 'Economic Buyer',
      weight: 0.15,
      score: 9,
      status: 'verified',
      confidence: 0.9,
    },
  },
});
const toClosed = [
  responded(answer),
  progress({ stage: 'feedback_recorded', feedback: { recorded: true, feedbackKey: 'k1' } }),
  progress({ stage: 'jev_scored', round: 'rescore', jevResult: rescoreJevVerified }),
  progress({ stage: 'jev_saved', round: 'rescore', jevResult: rescoreJevVerified, opportunity: opportunity({ meddpicc_score: 89 }) }),
  ok('run_assessment', verdict()),
  ev('message.completed', { message: 'Audit complete.' }),
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

  it('surfaces baseline rubric scores AND sets system2Running: true immediately on jev_scored (before jev_saved)', () => {
    const view = run(toPause.slice(0, 4));
    expect(view.phase).toBe('assessing');
    expect(view.jevResult?.overallScore).toBe(56);
    expect(view.system2Running).toBe(true);
    expect(view.opportunity).toBeNull();
    const withBase = run(toPause.slice(0, 4), { ...assessmentReducer.initial(), opportunity: opportunity({ meddpicc_score: null }) });
    expect(withBase.opportunity?.meddpicc_score).toBe(56);
    expect(withBase.opportunity?.qualification_status).toBe('in_review');
  });

  it('keeps system2Running true through jev_saved and clears it on system2_saved', () => {
    expect(run(toPause.slice(0, 5)).system2Running).toBe(true);
    expect(run(toPause.slice(0, 6)).system2Running).toBe(false);
  });

  it('pauses awaiting SA feedback with scores, form and the pending question once the tool asks', () => {
    const view = run(toPause);
    expect(view).toMatchObject({ phase: 'awaiting_feedback', pendingInput: { requestId: 'req_1' }, error: null });
    expect(view.system2Result?.phase3Form.sections[0].fields[0].id).toBe('eb');
    expect(view.opportunity?.meddpicc_score).toBe(56);
  });

  it('transitions directly to closed on action.result without freezing until turn.completed, and treats trailing turn.completed as a no-op', () => {
    const paused = run(toPause);
    // Run up through action.result BEFORE message.completed and turn.completed arrive:
    const immediatelyOnActionResult = run(toClosed.slice(0, 5), paused);
    expect(immediatelyOnActionResult.phase).toBe('closed');
    expect(immediatelyOnActionResult.result?.status).toBe('written_back');
    expect(immediatelyOnActionResult.error).toBeNull();
    // Resolved verified dimension gaps are cleared on rescore:
    expect(immediatelyOnActionResult.system2Result?.dimensionFindings.economicBuyer.gaps).toEqual([]);

    // Subsequent message.completed + turn.completed is a clean no-op (not an error!):
    const closed = run(toClosed.slice(5), immediatelyOnActionResult);
    expect(closed).toMatchObject({
      phase: 'closed',
      pendingInput: null,
      feedback: { recorded: true, feedbackKey: 'k1' },
      result: { status: 'written_back', delta: 33, nextSteps: NEXT_STEPS, writebackId: 'int_wb_1' },
      error: null,
    });
    expect(closed.opportunity?.qualification_status).toBe('qualified');
    expect(closed.jevResult?.overallScore).toBe(89);
    expect(closed.system2Result?.modelUsed).toBe('google/gemini-3.8-flash');
  });

  it('closes immediately without a pause when writebackWithoutFeedback was requested', () => {
    const view = run([
      submitted(),
      ev('turn.started', {}),
      requested('run_assessment', { ...INPUT, writebackWithoutFeedback: true }),
      ...toPause.slice(3, 6),
      ok('run_assessment', verdict({ qualificationStatus: 'in_review', feedback: 'skipped', delta: 0 })),
    ]);
    expect(view).toMatchObject({ phase: 'closed', request: { model: 'google/gemini-3.8-flash', writebackWithoutFeedback: true } });
    // Trailing turn.completed stays closed without error:
    expect(run([turnCompleted()], view)).toMatchObject({ phase: 'closed', error: null });
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
    const view = run([...toPause.slice(0, 4), failed('run_assessment', 'Gateway 503 Service temporarily unavailable'), turnCompleted()]);
    expect(view).toMatchObject({ phase: 'failed', error: 'Gateway 503 Service temporarily unavailable', system2Running: false });
  });

  it('fails when the answer is rejected (malformed or mismatched) and the session ends', () => {
    const view = run([responded('not json'), resolved(), failed('run_assessment', 'The SA discovery answer is not JSON')], run(toPause));
    expect(view).toMatchObject({ phase: 'failed', pendingInput: null, error: 'The SA discovery answer is not JSON' });
  });

  it('fails when discovery responses are not accepted', () => {
    const view = run([responded(answer), resolved('invalid')], run(toPause));
    expect(view).toMatchObject({ phase: 'failed', error: expect.stringMatching(/not accepted \(invalid\)/) });
    expect(view.error).not.toMatch(INTERNAL_JARGON);
  });

  it('fails when recorded answers differ from the submitted payload (feedbackKey mismatch) with jargon-free copy', () => {
    const view = run([responded(answer), resolved(), progress({ stage: 'feedback_recorded', feedback: { recorded: true, feedbackKey: 'other' } })], run(toPause));
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/feedbackKey mismatch/);
    expect(view.error).not.toMatch(INTERNAL_JARGON);
  });

  it('reads the requested model and writeback flag from the run_assessment input, not the message text', () => {
    const view = run([submitted('please assess acme'), requested('run_assessment', { opportunityId: 'x', model: 'anthropic/claude-haiku-5.5' })]);
    expect(view.request).toEqual({ model: 'anthropic/claude-haiku-5.5', writebackWithoutFeedback: false });
  });

  it('fails with jargon-free copy when invoked without an analysis model', () => {
    const view = run([submitted(), requested('run_assessment', { opportunityId: 'opp_acme_corp_001' })]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/analysis model/i);
    expect(view.error).not.toMatch(INTERNAL_JARGON);
  });

  it('fails with jargon-free copy when invoked a second time in the session', () => {
    const view = run([requested('run_assessment', INPUT)], run(toPause.slice(0, 6)));
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/more than once/);
    expect(view.error).not.toMatch(INTERNAL_JARGON);
  });

  it('fails with jargon-free copy when the turn ends without a CRM writeback', () => {
    const noTool = run([submitted(), ev('message.completed', { message: 'Sure!' }), turnCompleted()]);
    expect(noTool).toMatchObject({
      phase: 'failed',
      error: expect.stringMatching(/without a CRM writeback/),
    });
    expect(noTool.error).not.toMatch(INTERNAL_JARGON);

    const midRun = run([...toPause.slice(0, 6), turnCompleted()]);
    expect(midRun.phase).toBe('failed');
    expect(midRun.error).toMatch(/without a CRM writeback/);
    expect(midRun.error).not.toMatch(INTERNAL_JARGON);
  });

  it('fails on an unreadable progress update or verdict without leaking internal tool names', () => {
    const badProgress = run([submitted(), progress({ stage: 'jev_scored', round: 'baseline', jevResult: { nope: true } })]);
    expect(badProgress.error).toMatch(/Unreadable deal audit progress/);
    expect(badProgress.error).not.toMatch(INTERNAL_JARGON);

    const badResult = run([submitted(), ok('run_assessment', { status: 'written_back' })]);
    expect(badResult.error).toMatch(/Unreadable deal audit verdict/);
    expect(badResult.error).not.toMatch(INTERNAL_JARGON);
  });

  it('fails with jargon-free copy when deep gap analysis ran with a different model than requested', () => {
    const view = run([submitted(), ev('turn.started', {}), requested('run_assessment', { ...INPUT, model: 'anthropic/claude-haiku-5.5' }), ...toPause.slice(3, 6)]);
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/google\/gemini-3.8-flash.*anthropic\/claude-haiku-5.5/);
    expect(view.error).not.toMatch(INTERNAL_JARGON);
  });

  it('fails on turn.failed, session.failed and a failed submission', () => {
    expect(run([submitted(), ev('turn.failed', { code: 'X', message: 'model overloaded' })])).toMatchObject({ phase: 'failed', error: 'model overloaded' });
    expect(run([submitted(), ev('session.failed', { message: 'session expired' })]).error).toMatch(/session expired/);
    expect(
      run([submitted(), { type: 'client.message.failed', data: { createdAt: 0, message: 'm', submissionId: 's1', error: { message: '401 Unauthorized' } } } as any])
    ).toMatchObject({ phase: 'failed', error: '401 Unauthorized' });
  });

  it('fails when a closed session receives another turn', () => {
    const view = run([submitted('again')], run(toClosed, run(toPause)));
    expect(view.phase).toBe('failed');
    expect(view.error).toMatch(/already closed/);
    expect(view.error).not.toMatch(INTERNAL_JARGON);
  });

  it('marks a session from an older deployment as legacy with jargon-free Deal Desk copy', () => {
    expect(LEGACY_SESSION_ERROR).not.toMatch(INTERNAL_JARGON);
    const view = run([submitted('Assess opportunity opp_acme_corp_001'), requested('run_jev_scoring')]);
    expect(view).toMatchObject({ phase: 'failed', legacySession: true, error: LEGACY_SESSION_ERROR });
  });

  it('says the session is legacy even when an earlier error was already shown', () => {
    const view = run([submitted('x'), ev('turn.failed', { message: 'boom' }), requested('run_jev_scoring')]);
    expect(view).toMatchObject({ legacySession: true, error: LEGACY_SESSION_ERROR });
  });

  it('rejects a closed result whose qualification status is not a CRM status', () => {
    const view = run([submitted(), ok('run_assessment', verdict({ qualificationStatus: 'great' }))]);
    expect(view.error).toMatch(/Unreadable deal audit verdict/);
  });

  it('ignores events it does not project (text, reasoning, other runtime events)', () => {
    const paused = run(toPause);
    expect(run([ev('message.appended', { messageDelta: 'hi' }), ev('session.waiting', {})], paused)).toEqual(paused);
  });

  it('handles turn.cancelled during Turn 1 by returning to ready without trapping in error', () => {
    const inFlight = run([submitted(), ev('turn.started', {}), requested('run_assessment', INPUT)]);
    expect(inFlight.phase).toBe('assessing');
    expect(inFlight.runningTool).toBe('run_assessment');

    const cancelled = run([ev('turn.cancelled', {})], inFlight);
    expect(cancelled.phase).toBe('ready');
    expect(cancelled.runningTool).toBeNull();
    expect(cancelled.system2Running).toBe(false);
    expect(cancelled.error).toBeNull();
  });

  it('handles turn.cancelled during Turn 2 by preserving discovery and returning to awaiting_feedback', () => {
    const paused = run(toPause);
    expect(paused.phase).toBe('awaiting_feedback');

    const submitting = run([responded(answer)], paused);
    expect(submitting.phase).toBe('submitting_feedback');

    const cancelled = run([ev('turn.cancelled', {})], submitting);
    expect(cancelled.phase).toBe('awaiting_feedback');
    expect(cancelled.runningTool).toBeNull();
    expect(cancelled.system2Running).toBe(false);
    expect(cancelled.error).toBeNull();
    expect(cancelled.system2Result).toBeDefined();
    expect(cancelled.pendingInput?.requestId).toBe('req_1');
    expect(cancelled.turnCancelled).toBe(true);
  });

  it('resets phase to awaiting_feedback and clears stale error state when ctx.ask retries input.requested', () => {
    const replayedCancel = run([...toPause, ev('turn.started', {}), ev('turn.cancelled', {})]);
    expect(replayedCancel.phase).toBe('awaiting_feedback');
    expect(replayedCancel.turnCancelled).toBe(true);

    // Even if attempt 1 produced a rejection/error before attempt 2's input.requested arrived:
    const afterFailedAttempt = run([responded('bad'), resolved('rejected'), question('req_2')], run(toPause));
    expect(afterFailedAttempt.phase).toBe('awaiting_feedback');
    expect(afterFailedAttempt.pendingInput).toEqual({ requestId: 'req_2' });
    expect(afterFailedAttempt.sentFeedbackKey).toBeNull();
    expect(afterFailedAttempt.error).toBeNull();
  });

  it('handles session.completed by transitioning to closed', () => {
    const paused = run(toPause);
    const completed = run([ev('session.completed', {})], paused);
    expect(completed.phase).toBe('closed');
    expect(completed.runningTool).toBeNull();
    expect(completed.system2Running).toBe(false);
    expect(completed.pendingInput).toBeNull();
  });
});
