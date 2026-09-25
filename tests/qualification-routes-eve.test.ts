import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getOpportunity, getInteractions, resetCrmDatabase } from '@/lib/db/crm';
import {
  recordJevScoring,
  recordSaFeedback,
  recordSystem2Analysis,
  writebackQualification,
} from '@/lib/db/assessments';
import { jev, system2 } from './fixtures/qualification';
import { scope } from './fixtures/eve-session';
import type { System2ModelOption } from '@/lib/models';

// The eve HTTP boundary is the only thing replaced here: the stub stands in for the
// agent's tools by persisting what they would persist, stamped with the session. The
// live path is covered by tests/eve-tools.live.test.ts and tests/assessment-session.live.test.ts.
const runAssessmentTurn = vi.fn();
vi.mock('@/lib/eve-session', () => ({ runAssessmentTurn: (turn: unknown) => runAssessmentTurn(turn) }));

const { POST: assess } = await import('@/app/api/qualification/assess/route');
const { POST: feedback } = await import('@/app/api/qualification/feedback/route');

const ACME = 'opp_acme_corp_001';

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: 'deal_qual_session=tok' },
    body: JSON.stringify(body),
  });
}

/** Turn 1 as the agent's tools would persist it in session `sessionId`. */
async function turnOne(sessionId: string, modelUsed: System2ModelOption = 'anthropic/claude-sonnet-5', score = 54) {
  const opp = (await getOpportunity(ACME))!;
  await recordJevScoring(opp, jev({ overallScore: score }), scope(sessionId, 't1'));
  await recordSystem2Analysis(opp, jev({ overallScore: score }), system2({ modelUsed }), scope(sessionId, 't1'));
  return { sessionId };
}

/** Turn 2 as the agent's tools would persist it: record answers, re-score, write back. */
async function turnTwo(sessionId: string, answers: { formResponses: Record<string, string>; notesDelta?: string }, score = 61) {
  await recordSaFeedback(ACME, answers, scope(sessionId, 't2'));
  const opp = (await getOpportunity(ACME))!;
  await recordJevScoring(opp, jev({ overallScore: score }), scope(sessionId, 't2'));
  await writebackQualification((await getOpportunity(ACME))!, scope(sessionId, 't2'));
  return { sessionId };
}

describe('/api/qualification/* reach the agents through eve', { timeout: 30_000 }, () => {
  beforeEach(async () => {
    process.env.EVE_AGENT_ORIGIN = 'https://deal-qual.example.com';
    runAssessmentTurn.mockReset();
    await resetCrmDatabase('scenario_acme_netlify');
  });

  it('assess starts a new Assessment Session and returns its persisted System 1 score, System 2 form and citations', async () => {
    runAssessmentTurn.mockImplementation(() => turnOne('wrun_A', 'openai/gpt-5.5'));

    const res = await assess(post('/api/qualification/assess', { opportunityId: ACME, model: 'openai/gpt-5.5' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(runAssessmentTurn).toHaveBeenCalledTimes(1);
    const turn = runAssessmentTurn.mock.calls[0][0];
    // The configured origin, never the request's Host header (http://localhost:3000 here).
    expect(turn).toMatchObject({ origin: 'https://deal-qual.example.com', cookie: 'deal_qual_session=tok' });
    expect(turn.sessionId).toBeUndefined();
    expect(turn.message).toContain(ACME);
    expect(turn.message).toContain('openai/gpt-5.5');
    expect(data).toMatchObject({
      success: true,
      jevResult: { overallScore: 54 },
      form: { title: 'Technical Qualification & Discovery Validation' },
      modelUsed: 'openai/gpt-5.5',
      sessionState: 'pending_feedback',
    });
    expect(data.opportunity.meddpicc_breakdown.economicBuyer).toMatchObject({
      evidence: ['VP of E-Commerce mentioned budget'],
      gaps: ['No confirmed sign-off authority'],
    });
  });

  it('assess reads only its own session: a concurrent session on the same deal cannot satisfy it', async () => {
    runAssessmentTurn.mockImplementation(async () => {
      // Another session persisted a full result for the same opportunity; this one only scored.
      await turnOne('wrun_other');
      const opp = (await getOpportunity(ACME))!;
      await recordJevScoring(opp, jev(), scope('wrun_A', 't1'));
      return { sessionId: 'wrun_A' };
    });

    const res = await assess(post('/api/qualification/assess', { opportunityId: ACME }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toMatch(/run_system2_analysis/);
    expect(data).not.toHaveProperty('jevResult');
  });

  it('assess fails loudly when System 2 ran with a different model than the one selected', async () => {
    runAssessmentTurn.mockImplementation(() => turnOne('wrun_A', 'anthropic/claude-sonnet-5'));
    const res = await assess(post('/api/qualification/assess', { opportunityId: ACME, model: 'openai/gpt-5.5' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/openai\/gpt-5\.5/);
  });

  it('assess surfaces the agent error as a 500', async () => {
    runAssessmentTurn.mockRejectedValue(new Error('Jev evaluation failed: 402 payment required'));
    const res = await assess(post('/api/qualification/assess', { opportunityId: ACME }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('Jev evaluation failed');
  });

  it('feedback sends the answers as turn 2 of the same session and returns the delta and next steps', async () => {
    const baseline = (await getOpportunity(ACME))!;
    await turnOne('wrun_A');
    const answers = { formResponses: { eb_authority: 'Verified sign-off authority.' }, notesDelta: 'CFO joins.' };
    runAssessmentTurn.mockImplementation(() => turnTwo('wrun_A', answers));

    const res = await feedback(post('/api/qualification/feedback', { opportunityId: ACME, ...answers }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(runAssessmentTurn).toHaveBeenCalledTimes(1);
    const turn = runAssessmentTurn.mock.calls[0][0];
    expect(turn).toMatchObject({ sessionId: 'wrun_A', origin: 'https://deal-qual.example.com' });
    // The structured payload travels in the turn-2 message.
    expect(turn.message).toContain(JSON.stringify({ opportunityId: ACME, ...answers }));
    expect(data).toMatchObject({
      success: true,
      sessionState: 'closed',
      jevResult: { overallScore: 61 },
      deltaScore: 7,
    });
    expect(data.suggestedNextSteps).toMatch(/^\[IN REVIEW\] /);
    expect(data.opportunity.suggested_next_steps).toBe(data.suggestedNextSteps);

    const after = (await getOpportunity(ACME))!;
    expect(after.ae_notes).toBe(baseline.ae_notes);
    const actions = (await getInteractions(ACME)).map((i) => i.action);
    expect(actions.filter((a) => a === 'writeback')).toHaveLength(1);
    expect(actions.filter((a) => a === 'sa_feedback')).toHaveLength(1);
  });

  it('feedback does not touch SA notes itself: a failed turn leaves them unchanged', async () => {
    await turnOne('wrun_A');
    const before = (await getOpportunity(ACME))!;
    runAssessmentTurn.mockRejectedValue(new Error('Jev evaluation failed'));

    const res = await feedback(post('/api/qualification/feedback', { opportunityId: ACME, formResponses: { q: 'a' } }));

    expect(res.status).toBe(500);
    expect((await getOpportunity(ACME))!.sa_notes).toBe(before.sa_notes);
    expect((await getInteractions(ACME)).some((i) => i.action === 'sa_feedback')).toBe(false);
  });

  it('feedback fails loudly when the agent recorded different answers than were submitted', async () => {
    await turnOne('wrun_A');
    runAssessmentTurn.mockImplementation(() => turnTwo('wrun_A', { formResponses: { q: 'paraphrased' } }));

    const res = await feedback(post('/api/qualification/feedback', { opportunityId: ACME, formResponses: { q: 'a' } }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/record_sa_feedback/);
  });

  it('feedback fails loudly when the turn completes without a fresh writeback', async () => {
    await turnOne('wrun_A');
    runAssessmentTurn.mockImplementation(async () => {
      await recordSaFeedback(ACME, { formResponses: { q: 'a' } }, scope('wrun_A', 't2'));
      return { sessionId: 'wrun_A' };
    });

    const res = await feedback(post('/api/qualification/feedback', { opportunityId: ACME, formResponses: { q: 'a' } }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/crm_update_next_steps|run_jev_scoring/);
  });

  it('feedback returns 409 when no Assessment Session is awaiting feedback', async () => {
    const res = await feedback(post('/api/qualification/feedback', { opportunityId: ACME, formResponses: { q: 'a' } }));
    expect(res.status).toBe(409);
    expect(runAssessmentTurn).not.toHaveBeenCalled();
  });

  it('feedback returns 409 once the session is closed', async () => {
    await turnOne('wrun_A');
    await turnTwo('wrun_A', { formResponses: { q: 'a' } });
    const res = await feedback(post('/api/qualification/feedback', { opportunityId: ACME, formResponses: { q: 'b' } }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/closed/);
  });
});
