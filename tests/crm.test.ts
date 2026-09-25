import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOpportunity,
  getOpportunityByScenario,
  updateOpportunity,
  resetCrmDatabase,
  getScenarios,
  recordInteraction,
  getInteractions,
} from '@/lib/db/crm';
import { DEMO_SCENARIOS } from '@/lib/db/scenarios';

describe('CRM fails loudly without Postgres', () => {
  it('throws a descriptive error instead of using an in-memory store when POSTGRES_URL is unset', async () => {
    const saved = process.env.POSTGRES_URL;
    delete process.env.POSTGRES_URL;
    try {
      await expect(getOpportunity('opp_acme_corp_001')).rejects.toThrow(/POSTGRES_URL/);
      await expect(resetCrmDatabase('scenario_acme_netlify')).rejects.toThrow(/POSTGRES_URL/);
    } finally {
      process.env.POSTGRES_URL = saved;
    }
  });

  it('propagates query failures instead of silently switching stores', async () => {
    const saved = process.env.POSTGRES_URL;
    process.env.POSTGRES_URL = 'postgresql://nobody:wrong@127.0.0.1:1/none';
    try {
      await expect(getOpportunity('opp_acme_corp_001')).rejects.toThrow();
    } finally {
      process.env.POSTGRES_URL = saved;
    }
  });
});

describe('Simulated CRM Persistence & Seeding (live Postgres test branch)', () => {
  beforeEach(async () => {
    // Reset to clean fixture baseline
    await resetCrmDatabase('scenario_acme_netlify');
    await resetCrmDatabase('scenario_globex_amplify');
    await resetCrmDatabase('scenario_soylent_headless');
  });

  it('provides all 3 pre-seeded enterprise scenarios', async () => {
    const scenarios = await getScenarios();
    expect(scenarios.length).toBe(3);

    const ids = scenarios.map((s) => s.scenario_id);
    expect(ids).toContain('scenario_acme_netlify');
    expect(ids).toContain('scenario_globex_amplify');
    expect(ids).toContain('scenario_soylent_headless');
  });

  it('loads Acme Corp scenario with exact discovery data', async () => {
    const opp = await getOpportunityByScenario('scenario_acme_netlify');
    expect(opp).not.toBeNull();
    expect(opp?.id).toBe('opp_acme_corp_001');
    expect(opp?.name).toBe('Acme Corp - Next.js Migration');
    expect(opp?.amount).toBe(180000);
    expect(opp?.ae_name).toBe('Sarah Jenkins');
    expect(opp?.ae_notes).toContain('Netlify contract expires in 90 days');
    expect(opp?.sa_notes).toContain('Next.js Pages Router migrating to App Router');
    expect(opp?.competitive_flags).toContain('Netlify');
    expect(opp?.qualification_status).toBe('unqualified');
    expect(opp?.suggested_next_steps).toBeNull();
  });

  it('loads Globex FinTech scenario with AWS Amplify competitor flag', async () => {
    const opp = await getOpportunityByScenario('scenario_globex_amplify');
    expect(opp).not.toBeNull();
    expect(opp?.id).toBe('opp_globex_fintech_002');
    expect(opp?.amount).toBe(240000);
    expect(opp?.competitive_flags).toContain('AWS Amplify');
    expect(opp?.ae_notes).toContain('AWS account team is pushing Amplify heavily');
  });

  it('loads Soylent Retail scenario with headless storefront details', async () => {
    const opp = await getOpportunityByScenario('scenario_soylent_headless');
    expect(opp).not.toBeNull();
    expect(opp?.id).toBe('opp_soylent_retail_003');
    expect(opp?.amount).toBe(90000);
    expect(opp?.ae_notes).toContain('Need to launch before Q4 peak freeze');
  });

  it('updates opportunity state and persists changes', async () => {
    const updated = await updateOpportunity('opp_acme_corp_001', {
      qualification_status: 'qualified',
      suggested_next_steps: '[QUALIFIED] Schedule Technical Validation Workshop with Head of Platform | Owner: SA | Focus: Edge Middleware & ISR',
      meddpicc_score: 75,
    });

    expect(updated.qualification_status).toBe('qualified');
    expect(updated.meddpicc_score).toBe(75);
    expect(updated.suggested_next_steps).toContain('[QUALIFIED]');

    // Verify retrieval
    const fetched = await getOpportunity('opp_acme_corp_001');
    expect(fetched?.qualification_status).toBe('qualified');
    expect(fetched?.meddpicc_score).toBe(75);
    expect(fetched?.suggested_next_steps).toBe(updated.suggested_next_steps);
  });

  it('resets opportunity back to default baseline unqualified state', async () => {
    // 1. Modify the opportunity
    await updateOpportunity('opp_acme_corp_001', {
      qualification_status: 'qualified',
      suggested_next_steps: 'Temporary writeback test step',
      meddpicc_score: 88,
    });

    // 2. Perform reset
    const resetOpp = await resetCrmDatabase('scenario_acme_netlify');
    expect(resetOpp.qualification_status).toBe('unqualified');
    expect(resetOpp.suggested_next_steps).toBeNull();
    expect(resetOpp.meddpicc_score).toBeNull();

    // 3. Verify in database
    const fetched = await getOpportunity('opp_acme_corp_001');
    expect(fetched?.qualification_status).toBe('unqualified');
    expect(fetched?.suggested_next_steps).toBeNull();
    expect(fetched?.meddpicc_score).toBeNull();
  });

  it('records and queries interaction telemetry audit trail', async () => {
    await recordInteraction({
      opportunity_id: 'opp_acme_corp_001',
      actor: 'system1_jev',
      action: 'initial_scoring',
      payload: { score: 55, pain: 8 },
    });

    const interactions = await getInteractions('opp_acme_corp_001');
    expect(interactions.length).toBeGreaterThan(0);
    const latest = interactions[0];
    expect(latest.opportunity_id).toBe('opp_acme_corp_001');
  });
});
