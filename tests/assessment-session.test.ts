import { describe, it, expect, beforeEach } from 'vitest';
import runAssessmentTool from '@/agent/tools/run_assessment';
import { recordFeedback, writeBack } from '@/agent/lib/assessment-steps';
import { getInteractions, getOpportunity, resetCrmDatabase } from '@/lib/db/crm';
import { loadLatestJevResult, recordJevScoring, recordSystem2Analysis } from '@/lib/db/assessments';
import { scope } from './fixtures/eve-session';
import { jev, system2 } from './fixtures/qualification';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';

const ACME = 'opp_acme_corp_001';

async function assessIn(sessionId: string, overrides: Parameters<typeof system2>[0] = {}, score = 54) {
  const opp = (await getOpportunity(ACME))!;
  await recordJevScoring(opp, jev({ overallScore: score }), scope(sessionId, 'turn_1'));
  await recordSystem2Analysis(opp, jev({ overallScore: score }), system2(overrides), scope(sessionId, 'turn_1'));
}

describe('Assessment Session: run_assessment steps are scoped to the root eve session', { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
  });

  it('the writeback uses its own session results even when another session assessed the same deal later', async () => {
    await assessIn('wrun_A', { valueFocus: 'Session A focus' });
    await assessIn('wrun_B', { valueFocus: 'Session B focus' });

    const result = await writeBack(ACME, scope('wrun_A', 'turn_2'));

    expect(result.suggestedNextSteps).toContain('Focus: Session A focus');
  });

  it('System 2 and the writeback read only their own Assessment Session', async () => {
    await assessIn('wrun_A');
    expect((await loadLatestJevResult(ACME, 'wrun_A')).overallScore).toBe(54);
    await expect(loadLatestJevResult(ACME, 'wrun_Z')).rejects.toThrow(/No System 1 result/);
    await expect(writeBack(ACME, scope('wrun_Z', 'turn_1'))).rejects.toThrow(/No System 1 result/);
  });

  it('run_assessment fails loudly outside an eve session', async () => {
    const body = (runAssessmentTool.execute as any)({ opportunityId: ACME }, {});
    await expect(body.next()).rejects.toThrow(/eve session/);
  });

  it('the writeback writes exactly one writeback audit row carrying the session telemetry', async () => {
    await assessIn('wrun_A', {}, 54);
    const opp = (await getOpportunity(ACME))!;
    await recordJevScoring(opp, jev({ overallScore: 61 }), scope('wrun_A', 'turn_2'));

    const result = await writeBack(ACME, scope('wrun_A', 'turn_2'));

    const writebacks = (await getInteractions(ACME)).filter((i) => i.action === 'writeback');
    expect(writebacks).toHaveLength(1);
    expect(writebacks[0].payload).toMatchObject({
      assessmentSessionId: 'wrun_A',
      turnId: 'turn_2',
      previousScore: 54,
      newScore: 61,
      deltaScore: 7,
      qualificationStatus: 'in_review',
      suggestedNextSteps: result.suggestedNextSteps,
      sessionState: 'closed',
    });
    expect(result.deltaScore).toBe(7);
  });

  it('recording SA feedback appends timestamped SA notes once per payload, leaving ae_notes alone', async () => {
    await assessIn('wrun_A');
    const baseline = (await getOpportunity(ACME))!;
    const formResponses = { eb_authority: 'Verified sign-off authority.' };
    const input = { formResponses, notesDelta: 'CFO joins next call.', feedbackKey: await saFeedbackKey(formResponses, 'CFO joins next call.') };

    const first = await recordFeedback(ACME, input, scope('wrun_A', 'turn_2'));
    // A replayed or retried step with the same answers must not append them again.
    const retry = await recordFeedback(ACME, input, scope('wrun_A', 'turn_3'));

    expect(first).toMatchObject({ recorded: true });
    expect(retry).toMatchObject({ recorded: false, feedbackKey: first.feedbackKey });
    const after = (await getOpportunity(ACME))!;
    expect(after.ae_notes).toBe(baseline.ae_notes);
    expect(after.sa_notes.startsWith(baseline.sa_notes.trim())).toBe(true);
    expect(after.sa_notes.match(/\[SA Discovery Update - \d{4}-\d\d-\d\dT/g)).toHaveLength(1);
    expect(after.sa_notes).toContain('• eb_authority: Verified sign-off authority.');
    expect(after.sa_notes).toContain('• Additional SA Notes: CFO joins next call.');
    const feedbackRows = (await getInteractions(ACME)).filter((i) => i.action === 'sa_feedback');
    expect(feedbackRows).toHaveLength(1);
    expect(feedbackRows[0].payload).toMatchObject({
      assessmentSessionId: 'wrun_A',
      feedbackKey: first.feedbackKey,
      formResponses: input.formResponses,
      notesDelta: 'CFO joins next call.',
    });
  });

  it('the writeback closes the session once: a second writeback in the same session is rejected', async () => {
    await assessIn('wrun_A');
    await writeBack(ACME, scope('wrun_A', 'turn_2'));
    await expect(writeBack(ACME, scope('wrun_A', 'turn_2'))).rejects.toThrow(/already closed/);
    expect((await getInteractions(ACME)).filter((i) => i.action === 'writeback')).toHaveLength(1);
  });

  it('recording SA feedback rejects answers that do not match the submitted feedbackKey and writes nothing', async () => {
    await assessIn('wrun_A');
    const before = (await getOpportunity(ACME))!;
    const submitted = await saFeedbackKey({ q: 'Verified sign-off authority.' });
    await expect(
      recordFeedback(ACME, { formResponses: { q: 'Sign-off verified.' }, feedbackKey: submitted }, scope('wrun_A', 'turn_2'))
    ).rejects.toThrow(/feedbackKey/);
    expect((await getOpportunity(ACME))!.sa_notes).toBe(before.sa_notes);
    expect((await getInteractions(ACME)).some((i) => i.action === 'sa_feedback')).toBe(false);
  });

  it('recording SA feedback is refused for a session with no discovery form', async () => {
    await expect(
      recordFeedback(ACME, { formResponses: { q: 'a' }, feedbackKey: await saFeedbackKey({ q: 'a' }) }, scope('wrun_none', 'turn_2'))
    ).rejects.toThrow(/No System 2 result/);
    expect((await getInteractions(ACME)).some((i) => i.action === 'sa_feedback')).toBe(false);
  });
});
