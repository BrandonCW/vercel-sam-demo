import { describe, it, expect, beforeEach } from 'vitest';
import crmReadDealTool from '@/agent/tools/crm_read_deal';
import runJevScoringTool from '@/agent/tools/run_jev_scoring';
import runSystem2AnalysisTool from '@/agent/tools/run_system2_analysis';
import crmUpdateNextStepsTool from '@/agent/tools/crm_update_next_steps';
import resetCrmDataTool from '@/agent/tools/reset_crm_data';
import { getOpportunity, resetCrmDatabase } from '@/lib/db/crm';

describe('Eve Deal Qualification Agent Tools', () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
  });

  it('crm_read_deal tool reads existing opportunity from CRM', async () => {
    const opp = await getOpportunity('opp_acme_corp_001');
    expect(opp).toBeDefined();

    const result = await crmReadDealTool.execute(
      { opportunityId: 'opp_acme_corp_001' },
      {} as any
    );

    expect(result.opportunity).toBeDefined();
    expect(result.opportunity.id).toBe('opp_acme_corp_001');
    expect(result.opportunity.name).toBe('Acme Corp - Next.js Migration');
  });

  it('run_jev_scoring tool executes System 1 deterministic scoring', async () => {
    const opp = await getOpportunity('opp_acme_corp_001');
    expect(opp).toBeDefined();

    const result = await runJevScoringTool.execute(
      {
        opportunityId: opp!.id,
        dealName: opp!.name,
        stageName: opp!.stage_name,
        aeNotes: opp!.ae_notes,
        saNotes: opp!.sa_notes,
      },
      {} as any
    );

    expect(result.jevResult).toBeDefined();
    expect(result.jevResult.overallScore).toBeGreaterThanOrEqual(40);
    expect(result.jevResult.dimensions.identifyPain.status).toBe('verified');
    expect(result.jevResult.competitiveFlags.some((f: any) => f.name === 'Netlify')).toBe(true);
  });

  it('run_system2_analysis tool executes deep reasoning pipeline', async () => {
    const opp = await getOpportunity('opp_acme_corp_001');
    const jevRes = await runJevScoringTool.execute(
      {
        opportunityId: opp!.id,
        dealName: opp!.name,
        stageName: opp!.stage_name,
        aeNotes: opp!.ae_notes,
        saNotes: opp!.sa_notes,
      },
      {} as any
    );

    const s2Res = await runSystem2AnalysisTool.execute(
      {
        opportunity: {
          id: opp!.id,
          name: opp!.name,
          stageName: opp!.stage_name,
          amount: opp!.amount,
          aeNotes: opp!.ae_notes,
          saNotes: opp!.sa_notes,
        },
        jevResult: jevRes.jevResult,
        model: 'claude-3-5-sonnet',
      },
      {} as any
    );

    expect(s2Res.system2Result).toBeDefined();
    expect(s2Res.system2Result.phase1Gaps.length).toBeGreaterThan(0);
    expect(s2Res.system2Result.phase2Competitive.length).toBeGreaterThan(0);
    expect(s2Res.system2Result.phase3Form.sections.length).toBeGreaterThanOrEqual(1);
    const totalFields = s2Res.system2Result.phase3Form.sections.reduce(
      (acc: number, s: any) => acc + s.fields.length,
      0
    );
    expect(totalFields).toBeGreaterThanOrEqual(3);
    expect(totalFields).toBeLessThanOrEqual(5);
  });

  it('crm_update_next_steps tool performs atomic CRM writeback', async () => {
    const opp = await getOpportunity('opp_acme_corp_001');
    expect(opp).toBeDefined();

    const writebackResult = await crmUpdateNextStepsTool.execute(
      {
        opportunityId: 'opp_acme_corp_001',
        suggestedNextSteps:
          '[QUALIFIED] Advance to Stage 3 | Owner: SA (Lead) + AE | Focus: App Router & Turborepo | Watch: Netlify 30% discount renewal',
        qualificationStatus: 'qualified',
        saNotes: `${opp!.sa_notes}\n[2026-09-24] Verified unilateral Economic Buyer sign-off with VP.`,
        meddpiccScore: 78,
        meddpiccBreakdown: {
          overallScore: 78,
          dimensions: {},
          stageGate: { gateReady: true, currentStage: 'Stage 2', targetStage: 'Stage 3', gateBlockers: [] },
        },
      },
      {} as any
    );

    expect(writebackResult.success).toBe(true);
    expect(writebackResult.opportunity.qualification_status).toBe('qualified');
    expect(writebackResult.opportunity.meddpicc_score).toBe(78);
    expect(writebackResult.opportunity.suggested_next_steps).toContain('[QUALIFIED]');

    // Verify in database
    const refreshed = await getOpportunity('opp_acme_corp_001');
    expect(refreshed!.qualification_status).toBe('qualified');
    expect(refreshed!.meddpicc_score).toBe(78);
    expect(refreshed!.suggested_next_steps).toContain('[QUALIFIED]');
  });

  it('reset_crm_data tool restores baseline state', async () => {
    const result = await resetCrmDataTool.execute(
      { scenarioId: 'scenario_acme_netlify' },
      {} as any
    );

    expect(result.success).toBe(true);
    expect(result.opportunity.id).toBe('opp_acme_corp_001');
    expect(result.opportunity.qualification_status).toBe('unqualified');
    expect(result.opportunity.suggested_next_steps).toBeNull();
  });
});
