import { describe, it, expect, beforeEach } from 'vitest';
import { POST as resetRoute } from '@/app/api/crm/reset/route';
import {
  getOpportunity,
  getInteractions,
  recordInteraction,
  resetCrmDatabase,
  updateOpportunity,
} from '@/lib/db/crm';

// Full assess -> feedback -> writeback workflows run live against AI Gateway in the
// eve evals (issue 10). This suite covers the CRM reset endpoint against the live
// Postgres test branch.

function makeResetRequest(body?: { scenarioId?: string }): Request {
  return new Request('http://localhost:3000/api/crm/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('CRM Reset Endpoint (POST /api/crm/reset)', () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
  });

  it('restores the scenario baseline and purges previous interaction telemetry', async () => {
    await updateOpportunity('opp_acme_corp_001', {
      qualification_status: 'qualified',
      suggested_next_steps: '[QUALIFIED] step | Owner: SA | Focus: x | Watch: y',
      meddpicc_score: 80,
    });
    await recordInteraction({
      opportunity_id: 'opp_acme_corp_001',
      actor: 'system1_jev',
      action: 'writeback',
      payload: { newScore: 80 },
    });

    const resetRes = await resetRoute(makeResetRequest({ scenarioId: 'scenario_acme_netlify' }));
    expect(resetRes.status).toBe(200);
    const resetData = await resetRes.json();
    expect(resetData.success).toBe(true);
    expect(resetData.opportunity.qualification_status).toBe('unqualified');
    expect(resetData.opportunity.suggested_next_steps).toBeNull();
    expect(resetData.opportunity.meddpicc_score).toBeNull();

    const inDb = await getOpportunity('opp_acme_corp_001');
    expect(inDb?.qualification_status).toBe('unqualified');
    expect(inDb?.meddpicc_score).toBeNull();

    const telemetry = await getInteractions('opp_acme_corp_001');
    expect(telemetry).toHaveLength(1);
    expect(telemetry[0].action).toBe('reset');
    expect(telemetry[0].actor).toBe('sa_user');

    const defaultRes = await resetRoute(makeResetRequest());
    expect(defaultRes.status).toBe(200);
    expect((await defaultRes.json()).opportunity.id).toBe('opp_acme_corp_001');
  });

  it('rejects an unknown scenario instead of silently resetting the default one', async () => {
    const res = await resetRoute(makeResetRequest({ scenarioId: 'scenario_does_not_exist' }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await res.json()).success).toBe(false);
  });
});
