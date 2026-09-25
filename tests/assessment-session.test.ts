import { describe, it, expect, beforeEach } from 'vitest';
import crmUpdateNextStepsTool from '@/agent/tools/crm_update_next_steps';
import recordSaFeedbackTool from '@/agent/tools/record_sa_feedback';
import runSystem2AnalysisTool from '@/agent/tools/run_system2_analysis';
import { getInteractions, getOpportunity, resetCrmDatabase } from '@/lib/db/crm';
import { recordJevScoring, recordSystem2Analysis } from '@/lib/db/assessments';
import { rootCtx, runTool, scope } from './fixtures/eve-session';
import { jev, system2 } from './fixtures/qualification';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';

const ACME = 'opp_acme_corp_001';

async function assessIn(sessionId: string, overrides: Parameters<typeof system2>[0] = {}, score = 54) {
  const opp = (await getOpportunity(ACME))!;
  await recordJevScoring(opp, jev({ overallScore: score }), scope(sessionId, 'turn_1'));
  await recordSystem2Analysis(opp, jev({ overallScore: score }), system2(overrides), scope(sessionId, 'turn_1'));
}

describe('Assessment Session: tools are scoped to the root eve session', { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
  });

  it('crm_update_next_steps uses its own session results even when another session assessed the same deal later', async () => {
    await assessIn('wrun_A', { valueFocus: 'Session A focus' });
    await assessIn('wrun_B', { valueFocus: 'Session B focus' });

    const result = (await crmUpdateNextStepsTool.execute({ opportunityId: ACME }, rootCtx('wrun_A', 'turn_2'))) as any;

    expect(result.suggestedNextSteps).toContain('Focus: Session A focus');
  });

  it('run_system2_analysis reads only its own Assessment Session', async () => {
    await assessIn('wrun_A');
    const saved = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try {
      // Finds wrun_A's System 1 result, then stops at the (missing) Gateway key.
      await expect(runTool(runSystem2AnalysisTool, { opportunityId: ACME }, rootCtx('wrun_A', 'turn_1'))).rejects.toThrow(
        /AI_GATEWAY_API_KEY/
      );
    } finally {
      if (saved !== undefined) process.env.AI_GATEWAY_API_KEY = saved;
    }
    // No System 1 result exists for another session.
    await expect(runTool(runSystem2AnalysisTool, { opportunityId: ACME }, rootCtx('wrun_Z', 'turn_1'))).rejects.toThrow(
      /run_jev_scoring/
    );
  });

  it('tools fail loudly outside an eve session', async () => {
    await assessIn('wrun_A');
    await expect(
      Promise.resolve(crmUpdateNextStepsTool.execute({ opportunityId: ACME }, {} as any))
    ).rejects.toThrow(/eve session/);
  });

  it('crm_update_next_steps writes exactly one writeback audit row carrying the session telemetry', async () => {
    await assessIn('wrun_A', {}, 54);
    const opp = (await getOpportunity(ACME))!;
    await recordJevScoring(opp, jev({ overallScore: 61 }), scope('wrun_A', 'turn_2'));

    const result = (await crmUpdateNextStepsTool.execute({ opportunityId: ACME }, rootCtx('wrun_A', 'turn_2'))) as any;

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

  it('record_sa_feedback appends timestamped SA notes once per payload, leaving ae_notes alone', async () => {
    await assessIn('wrun_A');
    const baseline = (await getOpportunity(ACME))!;
    const input = {
      opportunityId: ACME,
      formResponses: { eb_authority: 'Verified sign-off authority.' },
      notesDelta: 'CFO joins next call.',
    };

    const first = (await recordSaFeedbackTool.execute(input, rootCtx('wrun_A', 'turn_2'))) as any;
    // A retried turn with the same answers must not append them again.
    const retry = (await recordSaFeedbackTool.execute(input, rootCtx('wrun_A', 'turn_3'))) as any;

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

  it('crm_update_next_steps closes the session once: a second writeback in the same session is rejected', async () => {
    await assessIn('wrun_A');
    await crmUpdateNextStepsTool.execute({ opportunityId: ACME }, rootCtx('wrun_A', 'turn_2'));
    await expect(
      Promise.resolve(crmUpdateNextStepsTool.execute({ opportunityId: ACME }, rootCtx('wrun_A', 'turn_2')))
    ).rejects.toThrow(/already closed/);
    expect((await getInteractions(ACME)).filter((i) => i.action === 'writeback')).toHaveLength(1);
  });

  it('record_sa_feedback rejects answers that do not match the submitted feedbackKey and writes nothing', async () => {
    await assessIn('wrun_A');
    const before = (await getOpportunity(ACME))!;
    const submitted = await saFeedbackKey({ q: 'Verified sign-off authority.' });
    await expect(
      Promise.resolve(
        recordSaFeedbackTool.execute(
          { opportunityId: ACME, formResponses: { q: 'Sign-off verified.' }, feedbackKey: submitted },
          rootCtx('wrun_A', 'turn_2')
        )
      )
    ).rejects.toThrow(/feedbackKey/);
    expect((await getOpportunity(ACME))!.sa_notes).toBe(before.sa_notes);
    expect((await getInteractions(ACME)).some((i) => i.action === 'sa_feedback')).toBe(false);
  });

  it('record_sa_feedback refuses feedback for a session with no discovery form', async () => {
    await expect(
      Promise.resolve(
        recordSaFeedbackTool.execute({ opportunityId: ACME, formResponses: { q: 'a' } }, rootCtx('wrun_none', 'turn_2'))
      )
    ).rejects.toThrow(/run_system2_analysis/);
    expect((await getInteractions(ACME)).some((i) => i.action === 'sa_feedback')).toBe(false);
  });
});
