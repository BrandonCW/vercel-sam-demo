import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/qualification/assess/route';
import { getOpportunity, resetCrmDatabase, getInteractions } from '@/lib/db/crm';

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

  it('returns a descriptive 500 and writes no score when AI_GATEWAY_API_KEY is unset', async () => {
    const saved = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try {
      const res = await POST(makeRequest({ opportunityId: 'opp_acme_corp_001' }));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/AI_GATEWAY_API_KEY/);
      expect(data).not.toHaveProperty('jevResult');

      const opp = await getOpportunity('opp_acme_corp_001');
      expect(opp?.meddpicc_score).toBeNull();
      const interactions = await getInteractions('opp_acme_corp_001');
      expect(interactions.map((i) => i.action)).toEqual(['reset']);
    } finally {
      if (saved !== undefined) process.env.AI_GATEWAY_API_KEY = saved;
    }
  });
});
