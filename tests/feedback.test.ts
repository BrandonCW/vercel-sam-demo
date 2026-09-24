import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/qualification/feedback/route';
import { getOpportunity, resetCrmDatabase, getInteractions } from '@/lib/db/crm';
import { formatSaDiscoveryNotes } from '@/lib/agents/feedback-schema';
import { synthesizeSuggestedNextSteps } from '@/lib/agents/next-steps-synthesizer';

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

  describe('Suggested Next Steps Formatting Contract', () => {
    const CONTRACT_REGEX =
      /^\[(QUALIFIED|IN REVIEW|DISQUALIFIED)\] (.+) \| Owner: (.+) \| Focus: (.+) \| Watch: (.+)$/;

    it('generates [QUALIFIED] next steps adhering strictly to the pipe-delimited 4-field contract', () => {
      const opp = {
        name: 'Acme Corp - Next.js Migration',
        stage_name: 'Stage 2 - Discovery',
        ae_notes: 'Met with VP of E-Commerce. Netlify renewal 30% discount.',
        sa_notes: 'App Router and Turborepo monorepo with ISR cache invalidation.',
        competitive_flags: ['Netlify'],
      };

      const stageGate = {
        gateReady: true,
        currentStage: 'Stage 2 - Discovery',
        targetStage: 'Stage 3 - Technical Validation',
        gateBlockers: [],
      };

      const result = synthesizeSuggestedNextSteps({
        opportunity: opp,
        qualificationStatus: 'qualified',
        stageGate,
      });

      expect(result).toMatch(CONTRACT_REGEX);
      expect(result.startsWith('[QUALIFIED]')).toBe(true);
      expect(result).toContain('| Owner: SA (Lead) + AE');
      expect(result).toContain('| Focus: Demonstrate Turborepo Remote Caching & ISR Cache Invalidation');
      expect(result).toContain('| Watch: Netlify 30% discount renewal offer.');
    });

    it('generates [IN REVIEW] next steps when stage gate remains blocked', () => {
      const opp = {
        name: 'Acme Corp - Next.js Migration',
        stage_name: 'Stage 2 - Discovery',
        ae_notes: 'Initial discussion.',
        sa_notes: 'Turborepo questions.',
        competitive_flags: ['Netlify'],
      };

      const stageGate = {
        gateReady: false,
        currentStage: 'Stage 2 - Discovery',
        targetStage: 'Stage 3 - Technical Validation',
        gateBlockers: [
          'Economic Buyer is not verified in discovery notes (score: 3/10, minimum 4/10 required)',
        ],
      };

      const result = synthesizeSuggestedNextSteps({
        opportunity: opp,
        qualificationStatus: 'in_review',
        stageGate,
      });

      expect(result).toMatch(CONTRACT_REGEX);
      expect(result.startsWith('[IN REVIEW]')).toBe(true);
      expect(result).toContain('| Owner: AE');
      expect(result).toContain('Hold at Stage 2 - Discovery');
    });

    it('generates [DISQUALIFIED] next steps when fatal blocker is detected', () => {
      const opp = {
        name: 'Legacy Corp',
        stage_name: 'Stage 2 - Discovery',
        ae_notes: 'Customer requires strict on-premise container mandate.',
        sa_notes: 'Cannot adopt cloud or edge CDN.',
        competitive_flags: ['Kubernetes'],
      };

      const stageGate = {
        gateReady: false,
        currentStage: 'Stage 2 - Discovery',
        targetStage: 'Stage 3 - Technical Validation',
        gateBlockers: ['Fatal blocker: on-premise mandate'],
      };

      const result = synthesizeSuggestedNextSteps({
        opportunity: opp,
        qualificationStatus: 'disqualified',
        stageGate,
      });

      expect(result).toMatch(CONTRACT_REGEX);
      expect(result.startsWith('[DISQUALIFIED]')).toBe(true);
      expect(result).toContain('| Owner: AE');
      expect(result).toContain('Archive opportunity');
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
