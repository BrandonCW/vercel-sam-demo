import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

    expect((result as any).opportunity).toBeDefined();
    expect((result as any).opportunity.id).toBe('opp_acme_corp_001');
    expect((result as any).opportunity.name).toBe('Acme Corp - Next.js Migration');
  });

  describe('without AI_GATEWAY_API_KEY', () => {
    let saved: string | undefined;
    beforeEach(() => {
      saved = process.env.AI_GATEWAY_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;
    });
    afterEach(() => {
      if (saved !== undefined) process.env.AI_GATEWAY_API_KEY = saved;
    });

    it('run_jev_scoring fails the tool action instead of returning a fallback score', async () => {
      await expect(
        Promise.resolve(
          runJevScoringTool.execute(
            {
              opportunityId: 'opp_acme_corp_001',
              dealName: 'Acme',
              stageName: 'Stage 2 - Discovery',
              aeNotes: 'notes',
            },
            {} as any
          )
        )
      ).rejects.toThrow(/AI_GATEWAY_API_KEY/);
    });

    it('run_system2_analysis fails the tool action instead of returning canned output', async () => {
      await expect(
        Promise.resolve(
          runSystem2AnalysisTool.execute(
            {
              opportunity: {
                id: 'opp_acme_corp_001',
                name: 'Acme',
                stageName: 'Stage 2 - Discovery',
                amount: 1,
                aeNotes: 'notes',
                saNotes: '',
              },
              jevResult: {},
            },
            {} as any
          )
        )
      ).rejects.toThrow(/AI_GATEWAY_API_KEY/);
    });
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

    expect((writebackResult as any).success).toBe(true);
    expect((writebackResult as any).opportunity.qualification_status).toBe('qualified');
    expect((writebackResult as any).opportunity.meddpicc_score).toBe(78);
    expect((writebackResult as any).opportunity.suggested_next_steps).toContain('[QUALIFIED]');

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

    expect((result as any).success).toBe(true);
    expect((result as any).opportunity.id).toBe('opp_acme_corp_001');
    expect((result as any).opportunity.qualification_status).toBe('unqualified');
    expect((result as any).opportunity.suggested_next_steps).toBeNull();
  });
});
