import { describe, it, expect, afterAll } from 'vitest';
import { neon } from '@neondatabase/serverless';
import {
  getInteractions,
  getOpportunity,
  getScenarios,
  listOpportunities,
  recordInteraction,
  resetAllScenarios,
  resetCrmDatabase,
  updateOpportunity,
} from '@/lib/db/crm';
import { markEvalTarget, requireEvalTarget, seedDemoData } from '@/lib/db/seed';
import { POST as resetRoute } from '@/app/api/crm/reset/route';
import resetCrmDataTool from '@/agent/tools/reset_crm_data';

// Live against the Neon `test` branch (.env.test.local). The demo scenarios are seed data
// in Postgres (`deal_scenarios`); runtime resets read them from there, never from code.
const sql = () => neon(process.env.POSTGRES_URL!);
const SCENARIO_OPPS = ['opp_acme_corp_001', 'opp_globex_fintech_002', 'opp_soylent_retail_003'];

describe('demo seed data (live Postgres test branch)', { timeout: 60_000 }, () => {
  afterAll(async () => {
    await seedDemoData({ fullReset: true });
  });

  it('seeds the three scenarios, with the rewritten Acme notes, into deal_scenarios and opportunities', async () => {
    await seedDemoData();
    const scenarios = await getScenarios();
    expect(scenarios.map((s) => s.scenario_id).sort()).toEqual([
      'scenario_acme_netlify',
      'scenario_globex_amplify',
      'scenario_soylent_headless',
    ]);
    const acme = await getOpportunity('opp_acme_corp_001');
    expect(acme?.ae_notes).toContain('Priya Raman (Head of Platform)');
    expect(acme?.ae_notes).toContain('CFO (Mark Ellis)');
    expect(acme?.qualification_status).toBe('unqualified');
    expect(acme?.suggested_next_steps).toBeNull();
  });

  it('is idempotent: seeding twice leaves one row per scenario at its baseline', async () => {
    await seedDemoData();
    await updateOpportunity('opp_globex_fintech_002', { suggested_next_steps: '[IN REVIEW] stale' });
    await seedDemoData();
    const [{ count }] = await sql()`SELECT count(*)::int AS count FROM deal_scenarios;`;
    expect(count).toBe(3);
    const opps = (await listOpportunities()).filter((o) => SCENARIO_OPPS.includes(o.id));
    expect(opps).toHaveLength(3);
    expect(opps.every((o) => o.suggested_next_steps === null && o.qualification_status === 'unqualified')).toBe(true);
  });

  it('full reset wipes every opportunity and interaction, then restores all three baselines', async () => {
    await seedDemoData();
    await sql()`INSERT INTO opportunities (id, name, account_name, stage_name, close_date, ae_name, ae_notes)
      VALUES ('opp_stray_999', 'Stray', 'Stray', 'Stage 2 - Discovery', '2026-12-01', 'Nobody', 'x')
      ON CONFLICT (id) DO NOTHING;`;
    await recordInteraction({ opportunity_id: 'opp_acme_corp_001', actor: 'sa_user', action: 'sa_feedback', payload: { x: 1 } });

    const restored = await resetAllScenarios();

    expect(restored.map((o) => o.id).sort()).toEqual([...SCENARIO_OPPS].sort());
    expect((await listOpportunities()).map((o) => o.id).sort()).toEqual([...SCENARIO_OPPS].sort());
    expect((await getInteractions('opp_acme_corp_001')).map((i) => i.action)).toEqual(['reset']);
  });

  it('a scenario reset fails loudly when the scenario is not seeded', async () => {
    await sql()`DELETE FROM deal_scenarios WHERE scenario_id = 'scenario_soylent_headless';`;
    await expect(resetCrmDatabase('scenario_soylent_headless')).rejects.toThrow(/not seeded.*pnpm db:seed/);
    await expect(resetAllScenarios()).rejects.toThrow(/not seeded.*pnpm db:seed/);
    await seedDemoData();
    await expect(resetCrmDatabase('scenario_soylent_headless')).resolves.toMatchObject({ id: 'opp_soylent_retail_003' });
  });

  it('the reset route and reset_crm_data tool offer the full reset', async () => {
    await seedDemoData();
    await sql()`INSERT INTO opportunities (id, name, account_name, stage_name, close_date, ae_name, ae_notes)
      VALUES ('opp_stray_999', 'Stray', 'Stray', 'Stage 2 - Discovery', '2026-12-01', 'Nobody', 'x')
      ON CONFLICT (id) DO NOTHING;`;
    const res = await resetRoute(
      new Request('http://localhost/api/crm/reset', { method: 'POST', body: JSON.stringify({ full: true }) }) as any
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.opportunities.map((o: any) => o.id).sort()).toEqual([...SCENARIO_OPPS].sort());
    expect(await getOpportunity('opp_stray_999')).toBeNull();

    const out = (await resetCrmDataTool.execute({ full: true } as any, {} as any)) as any;
    expect(out.opportunities).toHaveLength(3);
  });

  it('only a database marked as the eval target may be reset by eve eval', async () => {
    await sql()`DROP TABLE IF EXISTS eval_target;`;
    await expect(requireEvalTarget()).rejects.toThrow(/not marked as the eval target/);
    await sql()`CREATE TABLE eval_target (branch_id TEXT PRIMARY KEY);`;
    await sql()`INSERT INTO eval_target VALUES ('br-some-other-branch');`;
    await expect(requireEvalTarget()).rejects.toThrow(/not marked as the eval target/);
    await markEvalTarget();
    await expect(requireEvalTarget()).resolves.toMatch(/^br-/);
  });
});
