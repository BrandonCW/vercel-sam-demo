import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/qualification/assess/route';
import { getOpportunity, resetCrmDatabase, getInteractions } from '@/lib/db/crm';
import { JevScoringResultSchema } from '@/lib/agents/jev-schema';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/qualification/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/qualification/assess - System 1 Assessment Endpoint', () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
    await resetCrmDatabase('scenario_globex_amplify');
    await resetCrmDatabase('scenario_soylent_headless');
  });

  it('returns 400 if opportunityId is missing or invalid', async () => {
    const req1 = makeRequest({});
    const res1 = await POST(req1);
    expect(res1.status).toBe(400);
    const data1 = await res1.json();
    expect(data1.success).toBe(false);
    expect(data1.error).toContain('opportunityId is required');

    const req2 = makeRequest({ opportunityId: 12345 });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
  });

  it('returns 404 if opportunity is not found', async () => {
    const req = makeRequest({ opportunityId: 'opp_non_existent_999' });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  it('assesses Acme Corp, persists score, records telemetry, and blocks Gate 2 on Economic Buyer', async () => {
    const req = makeRequest({ opportunityId: 'opp_acme_corp_001' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.opportunity).toBeDefined();
    expect(body.jevResult).toBeDefined();

    // Verify Jev output adheres to schema
    const parsed = JevScoringResultSchema.safeParse(body.jevResult);
    expect(parsed.success).toBe(true);

    // Verify score range & dimension values
    const { opportunity, jevResult } = body;
    expect(opportunity.meddpicc_score).toBeGreaterThanOrEqual(50);
    expect(opportunity.meddpicc_score).toBeLessThanOrEqual(58);
    expect(opportunity.qualification_status).toBe('in_review');
    expect(opportunity.competitive_flags).toContain('Netlify');

    // Economic Buyer should be unaddressed and block Gate 2
    expect(jevResult.dimensions.economicBuyer.score).toBe(3);
    expect(jevResult.dimensions.economicBuyer.status).toBe('unaddressed');
    expect(jevResult.stageGate.gateReady).toBe(false);
    expect(jevResult.stageGate.gateBlockers.some((b: string) => b.includes('Economic Buyer'))).toBe(true);

    // Verify CRM database persistence
    const saved = await getOpportunity('opp_acme_corp_001');
    expect(saved?.meddpicc_score).toBe(opportunity.meddpicc_score);
    expect(saved?.qualification_status).toBe('in_review');
    expect(saved?.competitive_flags).toContain('Netlify');
    expect(saved?.meddpicc_breakdown.identifyPain?.score).toBe(8);

    // Verify Telemetry event in deal_interactions
    const interactions = await getInteractions('opp_acme_corp_001');
    const assessEvent = interactions.find(
      (i) => i.actor === 'system1_jev' && i.action === 'initial_scoring'
    );
    expect(assessEvent).toBeDefined();
    expect((assessEvent?.payload as any).overallScore).toBe(opportunity.meddpicc_score);

    // Verify System 2 JSON Render Form and sessionState
    expect(body.sessionState).toBe('pending_feedback');
    expect(body.form).toBeDefined();
    expect(body.form.opportunityId).toBe('opp_acme_corp_001');
    expect(body.form.sections.length).toBeGreaterThanOrEqual(2);

    // Verify System 2 interaction checkpoint
    const s2Event = interactions.find(
      (i) => i.actor === 'system2_llm' && i.action === 'questions_generated'
    );
    expect(s2Event).toBeDefined();
    expect((s2Event?.payload as any).sessionState).toBe('pending_feedback');
  });

  it('assesses Globex FinTech and extracts AWS Amplify competitive threat with custom model', async () => {
    const req = makeRequest({
      opportunityId: 'opp_globex_fintech_002',
      model: 'gpt-4o-mini',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sessionState).toBe('pending_feedback');
    expect(body.opportunity.competitive_flags).toContain('AWS Amplify');
    expect(body.jevResult.competitiveFlags[0].name).toBe('AWS Amplify');
    expect(body.jevResult.competitiveFlags[0].threatLevel).toBe('high');
    expect(body.form).toBeDefined();
    expect(body.form.opportunityId).toBe('opp_globex_fintech_002');

    const interactions = await getInteractions('opp_globex_fintech_002');
    const s2Event = interactions.find((i) => i.action === 'questions_generated');
    expect((s2Event?.payload as any).model).toBe('gpt-4o-mini');
  });

  it('assesses Soylent Retail with 0 competitor flags and returns valid form', async () => {
    const req = makeRequest({ opportunityId: 'opp_soylent_retail_003' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sessionState).toBe('pending_feedback');
    expect(body.opportunity.competitive_flags).toHaveLength(0);
    expect(body.jevResult.competitiveFlags).toHaveLength(0);
    expect(body.form).toBeDefined();
    expect(body.form.sections.length).toBeGreaterThanOrEqual(1);
  });
});
