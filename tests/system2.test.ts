import { describe, it, expect } from 'vitest';
import { SCENARIO_FIXTURES } from '@/lib/db/fixtures';
import { scoreOpportunityWithJev } from '@/lib/agents/jev-scorer';
import {
  executeSystem2Pipeline,
  runPhase1GapAnalysis,
  runPhase2CompetitivePlaybook,
  runPhase3FormGeneration,
  System2Input,
} from '@/lib/agents/system2';
import { runSystem2Analysis } from '@/lib/agents/system2-runner';
import { JsonRenderFormSchema } from '@/lib/ui/json-render-schema';
import { System2ModelOption } from '@/lib/types/crm';

function buildSystem2Input(scenarioId: string, model?: System2ModelOption): System2Input {
  const fixture = SCENARIO_FIXTURES[scenarioId];
  if (!fixture) throw new Error(`Unknown scenario ${scenarioId}`);

  const opp = fixture.default_data;
  const jevResult = scoreOpportunityWithJev({
    opportunityId: opp.id,
    name: opp.name,
    accountName: opp.account_name,
    stageName: opp.stage_name,
    amount: opp.amount,
    aeNotes: opp.ae_notes,
    saNotes: opp.sa_notes,
  });

  return {
    opportunity: {
      id: opp.id,
      name: opp.name,
      stageName: opp.stage_name,
      amount: opp.amount,
      aeNotes: opp.ae_notes,
      saNotes: opp.sa_notes,
    },
    jevResult,
    model,
  };
}

describe('System 2 Deep Reasoning Engine', () => {
  describe('Phase 1: Gap Analysis & Risk Synthesis', () => {
    it('isolates verified facts from AE assumptions for Acme Corp', () => {
      const input = buildSystem2Input('scenario_acme_netlify');
      const gaps = runPhase1GapAnalysis(input);

      expect(gaps.length).toBeGreaterThan(0);

      // Economic Buyer should be flagged as a critical Stage Gate blocker
      const ebGap = gaps.find((g) => g.dimension === 'economicBuyer');
      expect(ebGap).toBeDefined();
      expect(ebGap?.isStageGateBlocker).toBe(true);
      expect(ebGap?.riskLevel).toBe('critical');
      expect(ebGap?.verifiedFact).toContain('VP of E-Commerce');
      expect(ebGap?.aeAssumption).toContain('unilateral');

      // Metrics gap should address build times
      const metricsGap = gaps.find((g) => g.dimension === 'metrics');
      expect(metricsGap).toBeDefined();
      expect(metricsGap?.verifiedFact).toContain('build times');
    });

    it('identifies compliance and VPC criteria gaps for Globex FinTech', () => {
      const input = buildSystem2Input('scenario_globex_amplify');
      const gaps = runPhase1GapAnalysis(input);

      const dcGap = gaps.find((g) => g.dimension === 'decisionCriteria');
      expect(dcGap).toBeDefined();
      expect(dcGap?.verifiedFact).toContain('SOC2');
    });
  });

  describe('Phase 2: Competitive Playbook & Battlecard Synthesis', () => {
    it('generates Netlify counter-positioning using Vercel differentiators', () => {
      const input = buildSystem2Input('scenario_acme_netlify');
      const playbook = runPhase2CompetitivePlaybook(input);

      expect(playbook.length).toBeGreaterThanOrEqual(1);
      const netlifyCard = playbook.find((p) => p.competitor === 'Netlify');
      expect(netlifyCard).toBeDefined();
      expect(netlifyCard?.threatLevel).toBe('high');
      expect(netlifyCard?.vercelDifferentiator).toContain('App Router native streaming');
      expect(netlifyCard?.vercelDifferentiator).toContain('ISR');
      expect(netlifyCard?.vercelDifferentiator).toContain('Turborepo remote caching');
      expect(netlifyCard?.trapQuestion).toContain('cache invalidation');
    });

    it('generates AWS Amplify counter-positioning against EDP credits', () => {
      const input = buildSystem2Input('scenario_globex_amplify');
      const playbook = runPhase2CompetitivePlaybook(input);

      const amplifyCard = playbook.find((p) => p.competitor === 'AWS Amplify');
      expect(amplifyCard).toBeDefined();
      expect(amplifyCard?.threatLevel).toBe('high');
      expect(amplifyCard?.competitorClaim).toContain('credits');
      expect(amplifyCard?.tacticalAngle).toContain('developer velocity');
    });

    it('provides defensive positioning when 0 competitors are mentioned', () => {
      const input = buildSystem2Input('scenario_soylent_headless');
      const playbook = runPhase2CompetitivePlaybook(input);

      expect(playbook.length).toBeGreaterThanOrEqual(1);
      expect(playbook[0].competitor).toContain('Infrastructure');
    });
  });

  describe('Phase 3: Dynamic JSON Render Form Formulation', () => {
    it('formulates 3–5 interactive discovery questions grouped into logical sections for Acme Corp', () => {
      const input = buildSystem2Input('scenario_acme_netlify');
      const gaps = runPhase1GapAnalysis(input);
      const playbook = runPhase2CompetitivePlaybook(input);
      const form = runPhase3FormGeneration(input, gaps, playbook);

      // Verify schema compliance
      const parsed = JsonRenderFormSchema.safeParse(form);
      expect(parsed.success).toBe(true);

      // Verify total field count between 3 and 5
      const totalFields = form.sections.reduce((acc, s) => acc + s.fields.length, 0);
      expect(totalFields).toBeGreaterThanOrEqual(3);
      expect(totalFields).toBeLessThanOrEqual(5);

      // Verify sections: Stage Gate Blockers, Competitive Validation, Architecture & Metrics
      const sectionIds = form.sections.map((s) => s.id);
      expect(sectionIds).toContain('section_stage_gate');
      expect(sectionIds).toContain('section_competitive');

      // Verify section callouts
      const stageGateSec = form.sections.find((s) => s.id === 'section_stage_gate');
      expect(stageGateSec?.calloutType).toBe('warning');

      const compSec = form.sections.find((s) => s.id === 'section_competitive');
      expect(compSec?.calloutType).toBe('tip');

      // Verify Economic Buyer question is present and required
      const ebField = stageGateSec?.fields.find((f) => f.id === 'q_economic_buyer');
      expect(ebField).toBeDefined();
      expect(ebField?.required).toBe(true);
      expect(ebField?.type).toBe('radio');
    });
  });

  describe('Multi-Model Runner & Deterministic Offline Fallback', () => {
    const models: System2ModelOption[] = [
      'claude-3-5-sonnet',
      'claude-3-5-haiku',
      'gpt-4o-mini',
      'gemini-2-flash',
    ];

    for (const model of models) {
      it(`executes System 2 analysis with model option: ${model}`, async () => {
        const input = buildSystem2Input('scenario_acme_netlify', model);
        const result = await runSystem2Analysis(input, { model });

        expect(result.opportunityId).toBe('opp_acme_corp_001');
        expect(result.modelUsed).toBe(model);
        expect(result.phase1Gaps.length).toBeGreaterThan(0);
        expect(result.phase2Competitive.length).toBeGreaterThan(0);
        expect(result.phase3Form.sections.length).toBeGreaterThan(0);

        // Form validates strictly against Zod schema
        const parsed = JsonRenderFormSchema.safeParse(result.phase3Form);
        expect(parsed.success).toBe(true);
      });
    }

    it('works completely offline with forced deterministic fallback', async () => {
      const input = buildSystem2Input('scenario_globex_amplify');
      const result = await runSystem2Analysis(input, {
        forceDeterministicFallback: true,
      });

      expect(result.opportunityId).toBe('opp_globex_fintech_002');
      expect(result.phase3Form.opportunityId).toBe('opp_globex_fintech_002');
      expect(result.phase3Form.sections.length).toBeGreaterThan(0);
    });

    it('executes end-to-end pipeline across all 3 scenarios', () => {
      const scenarios = [
        'scenario_acme_netlify',
        'scenario_globex_amplify',
        'scenario_soylent_headless',
      ];

      for (const scenarioId of scenarios) {
        const input = buildSystem2Input(scenarioId);
        const result = executeSystem2Pipeline(input);

        expect(result.opportunityId).toBe(input.opportunity.id);
        expect(result.phase1Gaps.length).toBeGreaterThan(0);
        expect(result.phase2Competitive.length).toBeGreaterThan(0);
        expect(result.phase3Form.sections.length).toBeGreaterThan(0);

        const totalFields = result.phase3Form.sections.reduce(
          (acc, s) => acc + s.fields.length,
          0
        );
        expect(totalFields).toBeGreaterThanOrEqual(3);
        expect(totalFields).toBeLessThanOrEqual(5);

        expect(JsonRenderFormSchema.safeParse(result.phase3Form).success).toBe(true);
      }
    });
  });
});
