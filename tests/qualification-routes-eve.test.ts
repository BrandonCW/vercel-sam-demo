import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getOpportunity, getInteractions, resetCrmDatabase } from '@/lib/db/crm';
import { recordJevScoring, recordSystem2Analysis, writebackQualification, loadLatestSystem2Result } from '@/lib/db/assessments';
import { jev, system2 } from './fixtures/qualification';

// The eve HTTP boundary is the only thing replaced here: the stub stands in for the
// agent's tools by persisting what they would persist. The live path is covered by
// tests/eve-tools.live.test.ts (tools) and the eve evals in issue 10.
const runAgentTurn = vi.fn();
vi.mock('@/lib/eve-session', () => ({ runAgentTurn: (turn: unknown) => runAgentTurn(turn) }));

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

describe('/api/qualification/* reach the agents through eve', { timeout: 30_000 }, () => {
  beforeEach(async () => {
    runAgentTurn.mockReset();
    await resetCrmDatabase('scenario_acme_netlify');
  });

  it('assess runs one eve turn and returns the persisted System 1 score, System 2 form and citations', async () => {
    runAgentTurn.mockImplementation(async () => {
      const opp = (await getOpportunity(ACME))!;
      await recordJevScoring(opp, jev());
      await recordSystem2Analysis(opp, jev(), system2({ modelUsed: 'openai/gpt-5.5' }));
    });

    const res = await assess(post('/api/qualification/assess', { opportunityId: ACME, model: 'openai/gpt-5.5' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(runAgentTurn).toHaveBeenCalledTimes(1);
    const turn = runAgentTurn.mock.calls[0][0];
    expect(turn).toMatchObject({ origin: 'http://localhost:3000', cookie: 'deal_qual_session=tok' });
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

  it('assess fails loudly when the eve turn completes without persisting a fresh System 2 analysis', async () => {
    runAgentTurn.mockImplementation(async () => {
      const opp = (await getOpportunity(ACME))!;
      await recordJevScoring(opp, jev());
    });

    const res = await assess(post('/api/qualification/assess', { opportunityId: ACME }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/run_system2_analysis/);
    expect(data).not.toHaveProperty('jevResult');
  });

  it('assess fails loudly when System 2 ran with a different model than the one selected', async () => {
    runAgentTurn.mockImplementation(async () => {
      const opp = (await getOpportunity(ACME))!;
      await recordJevScoring(opp, jev());
      await recordSystem2Analysis(opp, jev(), system2({ modelUsed: 'anthropic/claude-sonnet-5' }));
    });
    const res = await assess(post('/api/qualification/assess', { opportunityId: ACME, model: 'openai/gpt-5.5' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/openai\/gpt-5\.5/);
  });

  it('assess surfaces the agent error as a 500', async () => {
    runAgentTurn.mockRejectedValue(new Error('Jev evaluation failed: 402 payment required'));
    const res = await assess(post('/api/qualification/assess', { opportunityId: ACME }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('Jev evaluation failed');
  });

  it('feedback appends SA notes, runs one eve turn (re-score + writeback) and returns the delta and next steps', async () => {
    const baseline = (await getOpportunity(ACME))!;
    await recordJevScoring(baseline, jev());
    await recordSystem2Analysis(baseline, jev(), system2());
    const previousScore = (await getOpportunity(ACME))!.meddpicc_score!;

    runAgentTurn.mockImplementation(async () => {
      const opp = (await getOpportunity(ACME))!;
      expect(opp.sa_notes).toContain('Verified sign-off authority.');
      const rescored = jev({ overallScore: 61 });
      await recordJevScoring(opp, rescored);
      await writebackQualification(opp, rescored, await loadLatestSystem2Result(ACME));
    });

    const res = await feedback(
      post('/api/qualification/feedback', {
        opportunityId: ACME,
        formResponses: { eb_authority: 'Verified sign-off authority.' },
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(runAgentTurn).toHaveBeenCalledTimes(1);
    expect(runAgentTurn.mock.calls[0][0].message).toContain(ACME);
    expect(data).toMatchObject({
      success: true,
      sessionState: 'closed',
      jevResult: { overallScore: 61 },
      deltaScore: 61 - previousScore,
    });
    expect(data.suggestedNextSteps).toMatch(/^\[IN REVIEW\] /);
    expect(data.opportunity.suggested_next_steps).toBe(data.suggestedNextSteps);

    const after = (await getOpportunity(ACME))!;
    expect(after.ae_notes).toBe(baseline.ae_notes);
    const actions = (await getInteractions(ACME)).map((i) => i.action);
    expect(actions.filter((a) => a === 'writeback').length).toBeGreaterThanOrEqual(2);
  });

  it('feedback fails loudly when the eve turn completes without a fresh writeback', async () => {
    const baseline = (await getOpportunity(ACME))!;
    await recordJevScoring(baseline, jev());
    await recordSystem2Analysis(baseline, jev(), system2());
    runAgentTurn.mockResolvedValue(undefined);

    const res = await feedback(
      post('/api/qualification/feedback', { opportunityId: ACME, formResponses: { q: 'a' } })
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/crm_update_next_steps|run_jev_scoring/);
  });
});
