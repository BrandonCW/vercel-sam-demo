import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/qualification/feedback/route';
import { getOpportunity, resetCrmDatabase, getInteractions } from '@/lib/db/crm';
import { formatSaDiscoveryNotes } from '@/lib/agents/feedback-schema';

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

  describe('formatSaDiscoveryNotes', () => {
    it('appends timestamped discovery updates leaving existing notes preserved and ae_notes untouched', async () => {
      const opp = await getOpportunity('opp_acme_corp_001');
      expect(opp).not.toBeNull();
      const originalAeNotes = opp!.ae_notes;
      const originalSaNotes = opp!.sa_notes;

      const formatted = formatSaDiscoveryNotes(
        {
          eb_authority: 'Verified signoff authority up to $250k with VP of E-Commerce Marcus Vance.',
          cache_strategy: ['ISR', 'Edge Middleware'],
        },
        'Customer confirmed Netlify renewal deadline is hard Oct 31.',
        originalSaNotes
      );

      // Verify structure
      expect(formatted).toContain(originalSaNotes);
      expect(formatted).toContain('[SA Discovery Update -');
      expect(formatted).toContain('• eb_authority: Verified signoff authority up to $250k with VP of E-Commerce Marcus Vance.');
      expect(formatted).toContain('• cache_strategy: ISR, Edge Middleware');
      expect(formatted).toContain('• Additional SA Notes: Customer confirmed Netlify renewal deadline is hard Oct 31.');

      // Invariant: ae_notes must remain completely untouched
      expect(opp!.ae_notes).toBe(originalAeNotes);
    });

    it('formats cleanly when existing SA notes are empty', () => {
      const formatted = formatSaDiscoveryNotes(
        { pain_quant: 'Deploy queues causing 45-minute engineer blocking' },
        undefined,
        ''
      );
      expect(formatted).toContain('[SA Discovery Update -');
      expect(formatted).toContain('• pain_quant: Deploy queues causing 45-minute engineer blocking');
      expect(formatted.startsWith('[SA Discovery Update -')).toBe(true);
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
        expect(after?.qualification_status).toBe('unqualified');
        expect(after?.suggested_next_steps).toBeNull();
      } finally {
        if (saved !== undefined) process.env.AI_GATEWAY_API_KEY = saved;
      }
    });
  });
});
