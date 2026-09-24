import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/qualification/feedback/route';
import { getOpportunity, resetCrmDatabase, getInteractions } from '@/lib/db/crm';
import { formatSaDiscoveryNotes } from '@/lib/agents/feedback-schema';
import { synthesizeSuggestedNextSteps } from '@/lib/agents/next-steps-synthesizer';
import { scoreOpportunityWithJev } from '@/lib/agents/jev-scorer';

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

  describe('Delta Re-scoring with Jev (System 1)', () => {
    it('passes Stage 2 gate when Economic Buyer and Metrics answers are submitted for Acme Corp', async () => {
      const opp = await getOpportunity('opp_acme_corp_001');
      expect(opp).not.toBeNull();

      // Baseline scoring without SA feedback: EB is score 3, Stage Gate 2 is blocked
      const baselineResult = scoreOpportunityWithJev({
        opportunityId: opp!.id,
        name: opp!.name,
        accountName: opp!.account_name,
        stageName: opp!.stage_name,
        amount: opp!.amount,
        aeNotes: opp!.ae_notes,
        saNotes: opp!.sa_notes,
      });

      expect(baselineResult.dimensions.economicBuyer.score).toBe(3);
      expect(baselineResult.stageGate.gateReady).toBe(false);
      expect(baselineResult.stageGate.gateBlockers.some((b) => b.includes('Economic Buyer'))).toBe(true);

      // Now append discovery answers resolving Economic Buyer authority and quantitative Metrics
      const updatedSaNotes = formatSaDiscoveryNotes(
        {
          economic_buyer:
            'Met with VP of E-Commerce Marcus Vance. Verified signoff authority up to $250k confirmed; unilateral approval without board review.',
          metrics_targets:
            'Core Web Vitals target: LCP < 1.5s on mobile, 45-minute build times reduced to sub-5 minutes with Turborepo.',
        },
        'Architecture POC scheduled with Head of Platform.',
        opp!.sa_notes
      );

      const deltaResult = scoreOpportunityWithJev({
        opportunityId: opp!.id,
        name: opp!.name,
        accountName: opp!.account_name,
        stageName: opp!.stage_name,
        amount: opp!.amount,
        aeNotes: opp!.ae_notes,
        saNotes: updatedSaNotes,
      });

      // Economic Buyer should upgrade to verified (score 8)
      expect(deltaResult.dimensions.economicBuyer.score).toBe(8);
      expect(deltaResult.dimensions.economicBuyer.status).toBe('verified');

      // Metrics should upgrade to verified/partial with CWV targets (score 6)
      expect(deltaResult.dimensions.metrics.score).toBeGreaterThanOrEqual(6);

      // Gate 2 exit criteria now satisfied!
      expect(deltaResult.stageGate.gateReady).toBe(true);
      expect(deltaResult.stageGate.gateBlockers).toHaveLength(0);
      expect(deltaResult.overallScore).toBeGreaterThanOrEqual(50);
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

    it('ingests feedback, executes Delta Re-scoring, transitions status to qualified, and writes back Suggested Next Steps', async () => {
      const initialOpp = await getOpportunity('opp_acme_corp_001');
      const originalAeNotes = initialOpp!.ae_notes;

      const req = makeFeedbackRequest({
        opportunityId: 'opp_acme_corp_001',
        formResponses: {
          eb_authority:
            'Marcus Vance has verified signoff authority up to $250k. Unilateral budget approval confirmed.',
          competitive_isr:
            'Presented Vercel ISR and Edge Middleware benchmarks; solved flash sale timeout bottleneck.',
          target_metrics: 'Target Core Web Vitals LCP < 1.5s and 50% build time reduction.',
        },
        notesDelta: 'Customer excited to move to Next.js 15 App Router.',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.sessionState).toBe('closed');
      expect(body.opportunity).toBeDefined();

      const { opportunity, jevResult, deltaScore, suggestedNextSteps } = body;

      // Check status & score progression
      expect(opportunity.qualification_status).toBe('qualified');
      expect(opportunity.meddpicc_score).toBeGreaterThanOrEqual(60);
      expect(deltaScore).toBeGreaterThan(0);
      expect(jevResult.stageGate.gateReady).toBe(true);

      // Verify suggested next steps
      expect(suggestedNextSteps).toContain('[QUALIFIED]');
      expect(suggestedNextSteps).toContain('| Owner: SA (Lead) + AE');
      expect(suggestedNextSteps).toContain('| Focus: Demonstrate Turborepo Remote Caching & ISR Cache Invalidation');
      expect(suggestedNextSteps).toContain('| Watch: Netlify 30% discount renewal offer.');

      // Invariant: ae_notes must remain unchanged
      expect(opportunity.ae_notes).toBe(originalAeNotes);

      // Verify SA notes contains the formatted delta
      expect(opportunity.sa_notes).toContain('[SA Discovery Update -');
      expect(opportunity.sa_notes).toContain('Marcus Vance has verified signoff authority');
      expect(opportunity.sa_notes).toContain('Customer excited to move to Next.js 15 App Router.');

      // Check CRM database persistence
      const saved = await getOpportunity('opp_acme_corp_001');
      expect(saved?.qualification_status).toBe('qualified');
      expect(saved?.meddpicc_score).toBe(opportunity.meddpicc_score);
      expect(saved?.suggested_next_steps).toBe(suggestedNextSteps);
      expect(saved?.ae_notes).toBe(originalAeNotes);

      // Check audit telemetry in deal_interactions
      const interactions = await getInteractions('opp_acme_corp_001');
      const writebackInteraction = interactions.find(
        (i) => i.actor === 'system1_jev' && i.action === 'writeback'
      );
      expect(writebackInteraction).toBeDefined();
      expect((writebackInteraction?.payload as any).sessionState).toBe('closed');
      expect((writebackInteraction?.payload as any).qualificationStatus).toBe('qualified');
      expect((writebackInteraction?.payload as any).suggestedNextSteps).toBe(suggestedNextSteps);
    });

    it('transitions status to disqualified when fatal architectural blocker is submitted', async () => {
      const req = makeFeedbackRequest({
        opportunityId: 'opp_globex_fintech_002',
        formResponses: {
          hosting_mandate: 'fatal blocker: customer confirmed strict on-premise container mandate; cannot adopt cloud edge CDN.',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.opportunity.qualification_status).toBe('disqualified');
      expect(body.suggestedNextSteps).toContain('[DISQUALIFIED]');
      expect(body.suggestedNextSteps).toContain('Archive opportunity');
    });
  });
});
