import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/qualification/feedback/route';
import { getOpportunity, resetCrmDatabase, getInteractions } from '@/lib/db/crm';
import { formatSaDiscoveryDelta, saFeedbackKey } from '@/lib/agents/feedback-schema';
import { recordJevScoring, recordSystem2Analysis } from '@/lib/db/assessments';
import { jev, system2 } from './fixtures/qualification';
import { scope } from './fixtures/eve-session';

function makeFeedbackRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/qualification/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Feedback Ingestion & Delta Re-scoring (Ticket 04)', () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
    await resetCrmDatabase('scenario_globex_amplify');
    await resetCrmDatabase('scenario_soylent_headless');
  });

  describe('formatSaDiscoveryDelta', () => {
    it('formats one timestamped discovery update block', () => {
      const block = formatSaDiscoveryDelta(
        {
          eb_authority: 'Verified signoff authority up to $250k with VP of E-Commerce Marcus Vance.',
          cache_strategy: ['ISR', 'Edge Middleware'],
        },
        'Customer confirmed Netlify renewal deadline is hard Oct 31.',
        '2026-09-25T00:00:00.000Z'
      );
      expect(block).toBe(
        '[SA Discovery Update - 2026-09-25T00:00:00.000Z]\n' +
          '• eb_authority: Verified signoff authority up to $250k with VP of E-Commerce Marcus Vance.\n' +
          '• cache_strategy: ISR, Edge Middleware\n' +
          '• Additional SA Notes: Customer confirmed Netlify renewal deadline is hard Oct 31.'
      );
    });

    it('omits the notes line when there is no notesDelta', () => {
      expect(formatSaDiscoveryDelta({ pain_quant: '45-minute blocking' }, undefined, 'T')).toBe(
        '[SA Discovery Update - T]\n• pain_quant: 45-minute blocking'
      );
    });
  });

  describe('saFeedbackKey', () => {
    it('is stable under key order and differs when an answer changes', () => {
      expect(saFeedbackKey({ a: '1', b: ['x'] }, ' n ')).toBe(saFeedbackKey({ b: ['x'], a: '1' }, 'n'));
      expect(saFeedbackKey({ a: '1' })).not.toBe(saFeedbackKey({ a: '2' }));
    });
  });

  describe('POST /api/qualification/feedback Endpoint', () => {
    it('validates schema and returns 400 on malformed payload', async () => {
      const req = makeFeedbackRequest({ opportunityId: '' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid feedback payload');
    });

    it('returns 404 for unknown opportunity', async () => {
      const req = makeFeedbackRequest({
        opportunityId: 'opp_unknown_xyz',
        formResponses: { q1: 'answer' },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });

    it('returns a descriptive 500 and leaves the CRM untouched when AI_GATEWAY_API_KEY is unset', async () => {
      const saved = process.env.AI_GATEWAY_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;
      try {
        // An Assessment Session is awaiting feedback, so only the missing key can stop it.
        const opp = (await getOpportunity('opp_acme_corp_001'))!;
        await recordJevScoring(opp, jev(), scope('wrun_cfg', 't1'));
        await recordSystem2Analysis(opp, jev(), system2(), scope('wrun_cfg', 't1'));
        const before = await getOpportunity('opp_acme_corp_001');
        const res = await POST(
          makeFeedbackRequest({
            opportunityId: 'opp_acme_corp_001',
            formResponses: { eb_authority: 'Verified sign-off authority.' },
          })
        );
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.error).toMatch(/AI_GATEWAY_API_KEY/);

        const after = await getOpportunity('opp_acme_corp_001');
        expect(after?.sa_notes).toBe(before?.sa_notes);
        expect(after?.qualification_status).toBe(before?.qualification_status);
        expect(after?.suggested_next_steps).toBeNull();
      } finally {
        if (saved !== undefined) process.env.AI_GATEWAY_API_KEY = saved;
      }
    });
  });
});
