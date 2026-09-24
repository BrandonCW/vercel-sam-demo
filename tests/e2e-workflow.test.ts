import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as assessRoute } from '@/app/api/qualification/assess/route';
import { POST as feedbackRoute } from '@/app/api/qualification/feedback/route';
import { POST as resetRoute } from '@/app/api/crm/reset/route';
import {
  getOpportunity,
  resetCrmDatabase,
  getInteractions,
} from '@/lib/db/crm';
import { JevScoringResultSchema } from '@/lib/agents/jev-schema';
import { JsonRenderFormSchema } from '@/lib/ui/json-render-schema';
import { System2ModelOption } from '@/lib/types/crm';

function makeAssessRequest(body: { opportunityId: string; model?: string }): NextRequest {
  return new NextRequest('http://localhost:3000/api/qualification/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeFeedbackRequest(body: {
  opportunityId: string;
  formResponses: Record<string, string | string[]>;
  notesDelta?: string;
}): NextRequest {
  return new NextRequest('http://localhost:3000/api/qualification/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeResetRequest(body?: { scenarioId?: string }): Request {
  return new Request('http://localhost:3000/api/crm/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const PIPE_CONTRACT_REGEX =
  /^\[(QUALIFIED|IN REVIEW|DISQUALIFIED)\] (.+) \| Owner: (.+) \| Focus: (.+) \| Watch: (.+)$/;

describe('End-to-End Workflow Integration Test Suite (tests/e2e-workflow.test.ts)', () => {
  beforeEach(async () => {
    // Reset all 3 scenarios to pristine fixture baseline before each test
    await resetCrmDatabase('scenario_acme_netlify');
    await resetCrmDatabase('scenario_globex_amplify');
    await resetCrmDatabase('scenario_soylent_headless');
  });

  describe('1. Deterministic Multi-Model Verification (System 1 & System 2)', () => {
    const models: System2ModelOption[] = [
      'claude-3-5-sonnet',
      'claude-3-5-haiku',
      'gpt-4o-mini',
      'gemini-2-flash',
    ];

    for (const model of models) {
      it(`evaluates baseline and generates schema-valid forms using model: ${model}`, async () => {
        const assessReq = makeAssessRequest({
          opportunityId: 'opp_acme_corp_001',
          model,
        });
        const assessRes = await assessRoute(assessReq);
        expect(assessRes.status).toBe(200);

        const data = await assessRes.json();
        expect(data.success).toBe(true);
        expect(data.sessionState).toBe('pending_feedback');

        // Verify System 1 Jev output adheres strictly to Zod schema
        const jevValidation = JevScoringResultSchema.safeParse(data.jevResult);
        expect(jevValidation.success).toBe(true);

        // Verify System 2 JSON Render Form adheres strictly to Zod schema
        const formValidation = JsonRenderFormSchema.safeParse(data.form);
        expect(formValidation.success).toBe(true);
        expect(data.form.opportunityId).toBe('opp_acme_corp_001');

        // Verify 3 to 5 questions constraint
        const totalFields = data.form.sections.reduce(
          (acc: number, s: { fields: unknown[] }) => acc + s.fields.length,
          0
        );
        expect(totalFields).toBeGreaterThanOrEqual(3);
        expect(totalFields).toBeLessThanOrEqual(5);

        // Verify telemetry audit trail captured the model selection
        const interactions = await getInteractions('opp_acme_corp_001');
        const s2Event = interactions.find((i) => i.action === 'questions_generated');
        expect(s2Event).toBeDefined();
        expect((s2Event?.payload as any).model).toBe(model);
      });
    }
  });

  describe('2. Acme Corp Scenario End-to-End Workflow (scenario_acme_netlify)', () => {
    it('executes baseline scoring -> Netlify detection -> EB gate block -> zero-cost pause -> SA feedback -> Delta Re-scoring -> [QUALIFIED] atomic writeback', async () => {
      // 1. Verify Initial CRM state
      const initialOpp = await getOpportunity('opp_acme_corp_001');
      expect(initialOpp).not.toBeNull();
      expect(initialOpp!.qualification_status).toBe('unqualified');
      expect(initialOpp!.suggested_next_steps).toBeNull();
      expect(initialOpp!.meddpicc_score).toBeNull();
      const originalAeNotes = initialOpp!.ae_notes;
      const originalSaNotes = initialOpp!.sa_notes;

      // 2. Trigger Assessment via POST /api/qualification/assess
      const assessReq = makeAssessRequest({
        opportunityId: 'opp_acme_corp_001',
        model: 'claude-3-5-sonnet',
      });
      const assessRes = await assessRoute(assessReq);
      expect(assessRes.status).toBe(200);

      const assessData = await assessRes.json();
      expect(assessData.success).toBe(true);
      expect(assessData.sessionState).toBe('pending_feedback');

      // System 1 validation
      const jevResult = assessData.jevResult;
      expect(assessData.opportunity.meddpicc_score).toBeGreaterThanOrEqual(50);
      expect(assessData.opportunity.meddpicc_score).toBeLessThanOrEqual(58);
      expect(assessData.opportunity.competitive_flags).toContain('Netlify');
      expect(jevResult.competitiveFlags[0].name).toBe('Netlify');
      expect(jevResult.competitiveFlags[0].threatLevel).toBe('high');

      // Gate 2 blocked by Economic Buyer (score 3/10)
      expect(jevResult.dimensions.economicBuyer.score).toBe(3);
      expect(jevResult.dimensions.economicBuyer.status).toBe('unaddressed');
      expect(jevResult.stageGate.gateReady).toBe(false);
      expect(
        jevResult.stageGate.gateBlockers.some((b: string) => b.includes('Economic Buyer'))
      ).toBe(true);

      // Verify zero-cost session pause in CRM
      const pausedOpp = await getOpportunity('opp_acme_corp_001');
      expect(pausedOpp?.qualification_status).toBe('in_review');
      expect(pausedOpp?.meddpicc_score).toBe(assessData.opportunity.meddpicc_score);

      // Invariant: ae_notes must remain unchanged
      expect(pausedOpp?.ae_notes).toBe(originalAeNotes);

      // 3. SA Feedback Submission via POST /api/qualification/feedback
      const feedbackReq = makeFeedbackRequest({
        opportunityId: 'opp_acme_corp_001',
        formResponses: {
          q_economic_buyer:
            'Met with VP of E-Commerce Marcus Vance. Verified signoff authority up to $250k confirmed; unilateral approval without board review.',
          q_pain_dollar_impact:
            'Deploy queues causing 45-minute delays across 8 daily releases, costing ~$120k quarterly in developer idle time; risk of flash sale downtime.',
          q_competitive_counter: 'confirmed_pain_seeking_switch',
          q_metrics_targets:
            'Target Core Web Vitals: LCP < 1.5s on mobile, 45-minute build times reduced to sub-5 minutes with Turborepo Remote Caching.',
        },
        notesDelta:
          'Marcus Vance confirmed budget is committed and agreed to schedule architecture validation kickoff next Tuesday.',
      });

      const feedbackRes = await feedbackRoute(feedbackReq);
      expect(feedbackRes.status).toBe(200);

      const feedbackData = await feedbackRes.json();
      expect(feedbackData.success).toBe(true);
      expect(feedbackData.sessionState).toBe('closed');
      expect(feedbackData.deltaScore).toBeGreaterThan(0);

      // Delta Re-scoring verification: EB upgraded to verified (score 8)
      expect(feedbackData.jevResult.dimensions.economicBuyer.score).toBe(8);
      expect(feedbackData.jevResult.dimensions.economicBuyer.status).toBe('verified');
      expect(feedbackData.jevResult.stageGate.gateReady).toBe(true);
      expect(feedbackData.jevResult.stageGate.gateBlockers).toHaveLength(0);

      // Status transition to 'qualified'
      expect(feedbackData.opportunity.qualification_status).toBe('qualified');
      expect(feedbackData.opportunity.meddpicc_score).toBeGreaterThanOrEqual(60);

      // Standardized Suggested Next Steps string
      const nextSteps = feedbackData.suggestedNextSteps;
      expect(nextSteps).toMatch(PIPE_CONTRACT_REGEX);
      expect(nextSteps.startsWith('[QUALIFIED]')).toBe(true);
      expect(nextSteps).toContain('| Owner: SA (Lead) + AE');
      expect(nextSteps).toContain('| Focus: Demonstrate Turborepo Remote Caching & ISR Cache Invalidation');
      expect(nextSteps).toContain('| Watch: Netlify 30% discount renewal offer.');

      // Invariant: ae_notes must remain completely untouched
      expect(feedbackData.opportunity.ae_notes).toBe(originalAeNotes);

      // SA discovery updates formatted cleanly
      expect(feedbackData.opportunity.sa_notes).toContain(originalSaNotes);
      expect(feedbackData.opportunity.sa_notes).toContain('[SA Discovery Update -');
      expect(feedbackData.opportunity.sa_notes).toContain('Marcus Vance confirmed budget is committed');

      // Database persistence verification
      const finalizedOpp = await getOpportunity('opp_acme_corp_001');
      expect(finalizedOpp?.qualification_status).toBe('qualified');
      expect(finalizedOpp?.meddpicc_score).toBe(feedbackData.opportunity.meddpicc_score);
      expect(finalizedOpp?.suggested_next_steps).toBe(nextSteps);
      expect(finalizedOpp?.ae_notes).toBe(originalAeNotes);

      // Audit telemetry verification
      const interactions = await getInteractions('opp_acme_corp_001');
      const writebackEvent = interactions.find((i) => i.action === 'writeback');
      expect(writebackEvent).toBeDefined();
      expect((writebackEvent?.payload as any).sessionState).toBe('closed');
      expect((writebackEvent?.payload as any).qualificationStatus).toBe('qualified');
      expect((writebackEvent?.payload as any).suggestedNextSteps).toBe(nextSteps);
    });
  });

  describe('3. Globex FinTech Scenario End-to-End Workflow (scenario_globex_amplify)', () => {
    it('executes baseline scoring -> Amplify threat detection -> VPC egress discovery -> [IN REVIEW] writeback when gate remains blocked', async () => {
      // 1. Initial Assessment
      const assessReq = makeAssessRequest({
        opportunityId: 'opp_globex_fintech_002',
      });
      const assessRes = await assessRoute(assessReq);
      expect(assessRes.status).toBe(200);

      const assessData = await assessRes.json();
      expect(assessData.success).toBe(true);
      expect(assessData.sessionState).toBe('pending_feedback');
      expect(assessData.opportunity.competitive_flags).toContain('AWS Amplify');
      expect(assessData.jevResult.competitiveFlags[0].name).toBe('AWS Amplify');
      expect(assessData.jevResult.competitiveFlags[0].threatLevel).toBe('high');

      // Verify form contains competitive and architecture fields
      const sectionIds = assessData.form.sections.map((s: { id: string }) => s.id);
      expect(sectionIds).toContain('section_competitive');

      // 2. Submit SA Feedback addressing VPC egress and Amplify evaluation, but EB remains unverified
      const feedbackReq = makeFeedbackRequest({
        opportunityId: 'opp_globex_fintech_002',
        formResponses: {
          q_competitive_amplify: 'engineering_prefers_vercel',
          q_vpc_egress:
            'Security team validated Vercel Secure Compute dedicated egress IP filtering; satisfies SOC2 Type II requirements.',
        },
        notesDelta:
          'Engineering team strongly prefers Vercel Developer Experience over Amplify container overhead. However, AWS account team is still lobbying CFO with enterprise credits; direct meeting with Economic Buyer is pending.',
      });

      const feedbackRes = await feedbackRoute(feedbackReq);
      expect(feedbackRes.status).toBe(200);

      const feedbackData = await feedbackRes.json();
      expect(feedbackData.success).toBe(true);
      expect(feedbackData.sessionState).toBe('closed');

      // Gate remains blocked on Economic Buyer
      expect(feedbackData.jevResult.stageGate.gateReady).toBe(false);
      expect(feedbackData.opportunity.qualification_status).toBe('in_review');

      // Standardized Suggested Next Steps string contains [IN REVIEW]
      const nextSteps = feedbackData.suggestedNextSteps;
      expect(nextSteps).toMatch(PIPE_CONTRACT_REGEX);
      expect(nextSteps.startsWith('[IN REVIEW]')).toBe(true);
      expect(nextSteps).toContain('| Owner: AE');
      expect(nextSteps).toContain('| Focus: Secure Compute, VPC Peering & Enterprise Security Architecture');
      expect(nextSteps).toContain('| Watch: AWS EDP credit subsidies and native service bundles.');

      // Check database persistence
      const saved = await getOpportunity('opp_globex_fintech_002');
      expect(saved?.qualification_status).toBe('in_review');
      expect(saved?.suggested_next_steps).toBe(nextSteps);
    });
  });

  describe('4. Soylent Retail Scenario End-to-End Workflow (scenario_soylent_headless)', () => {
    it('executes headless storefront replatforming -> CWV / Shopify Plus validation -> [QUALIFIED] writeback', async () => {
      // 1. Initial Assessment
      const assessReq = makeAssessRequest({
        opportunityId: 'opp_soylent_retail_003',
      });
      const assessRes = await assessRoute(assessReq);
      expect(assessRes.status).toBe(200);

      const assessData = await assessRes.json();
      expect(assessData.success).toBe(true);
      expect(assessData.sessionState).toBe('pending_feedback');
      expect(assessData.opportunity.competitive_flags).toHaveLength(0);

      // 2. Submit SA Feedback validating Headless Shopify Plus and sub-1.5s CWV targets
      const feedbackReq = makeFeedbackRequest({
        opportunityId: 'opp_soylent_retail_003',
        formResponses: {
          q_economic_buyer:
            'Met with CEO and CMO sponsors. Verified discretionary signoff authority for $90k ACV budget confirmed.',
          q_metrics_targets:
            'Core Web Vitals target: LCP < 1.2s on mobile storefront to prevent peak Q4 bounce rates.',
          q_headless_shopify:
            'Head of Engineering confirmed Shopify Plus headless storefront architecture and accepted Next.js 15 App Router.',
        },
        notesDelta:
          'Architecture signoff completed with Head of Engineering; automated preview branches tested with Sanity CMS webhooks.',
      });

      const feedbackRes = await feedbackRoute(feedbackReq);
      expect(feedbackRes.status).toBe(200);

      const feedbackData = await feedbackRes.json();
      expect(feedbackData.success).toBe(true);
      expect(feedbackData.sessionState).toBe('closed');
      expect(feedbackData.opportunity.qualification_status).toBe('qualified');
      expect(feedbackData.jevResult.stageGate.gateReady).toBe(true);

      // Verify Suggested Next Steps
      const nextSteps = feedbackData.suggestedNextSteps;
      expect(nextSteps).toMatch(PIPE_CONTRACT_REGEX);
      expect(nextSteps.startsWith('[QUALIFIED]')).toBe(true);
      expect(nextSteps).toContain('| Focus: Core Web Vitals Optimization & Headless Storefront Performance');

      // Check database persistence
      const saved = await getOpportunity('opp_soylent_retail_003');
      expect(saved?.qualification_status).toBe('qualified');
      expect(saved?.suggested_next_steps).toBe(nextSteps);
    });
  });

  describe('5. CRM Reset Endpoint End-to-End (POST /api/crm/reset)', () => {
    it('cleanly restores default scenario payloads and purges previous interaction telemetry', async () => {
      // 1. Advance Acme Corp to qualified state with telemetry
      const assessReq = makeAssessRequest({ opportunityId: 'opp_acme_corp_001' });
      await assessRoute(assessReq);

      const feedbackReq = makeFeedbackRequest({
        opportunityId: 'opp_acme_corp_001',
        formResponses: {
          q_economic_buyer:
            'Met with VP of E-Commerce Marcus Vance. Verified signoff authority up to $250k confirmed; unilateral approval without board review.',
        },
      });
      await feedbackRoute(feedbackReq);

      // Verify opportunity is modified and telemetry is present
      const modifiedOpp = await getOpportunity('opp_acme_corp_001');
      expect(modifiedOpp?.qualification_status).toBe('qualified');
      expect(modifiedOpp?.suggested_next_steps).not.toBeNull();

      const telemetryBefore = await getInteractions('opp_acme_corp_001');
      expect(telemetryBefore.length).toBeGreaterThanOrEqual(3);

      // 2. Execute CRM Reset via POST /api/crm/reset
      const resetReq = makeResetRequest({ scenarioId: 'scenario_acme_netlify' });
      const resetRes = await resetRoute(resetReq);
      expect(resetRes.status).toBe(200);

      const resetData = await resetRes.json();
      expect(resetData.success).toBe(true);
      expect(resetData.opportunity.qualification_status).toBe('unqualified');
      expect(resetData.opportunity.suggested_next_steps).toBeNull();
      expect(resetData.opportunity.meddpicc_score).toBeNull();

      // 3. Verify in database
      const resetOppInDb = await getOpportunity('opp_acme_corp_001');
      expect(resetOppInDb?.qualification_status).toBe('unqualified');
      expect(resetOppInDb?.suggested_next_steps).toBeNull();
      expect(resetOppInDb?.meddpicc_score).toBeNull();

      // 4. Verify interaction telemetry was purged: only the single reset event remains
      const telemetryAfter = await getInteractions('opp_acme_corp_001');
      expect(telemetryAfter).toHaveLength(1);
      expect(telemetryAfter[0].action).toBe('reset');
      expect(telemetryAfter[0].actor).toBe('sa_user');

      // 5. Test reset with empty body defaults cleanly to default scenario
      const defaultResetReq = makeResetRequest();
      const defaultResetRes = await resetRoute(defaultResetReq);
      expect(defaultResetRes.status).toBe(200);
      const defaultResetData = await defaultResetRes.json();
      expect(defaultResetData.success).toBe(true);
      expect(defaultResetData.opportunity.id).toBe('opp_acme_corp_001');
    });
  });
});
