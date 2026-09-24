import { describe, it, expect } from 'vitest';
import {
  CANONICAL_DIMENSIONS,
  computeCompositeScore,
  getDimensionStatus,
  scanCompetitiveMentions,
  evaluateStageGate,
  scoreOpportunityWithJev,
} from '@/lib/agents/jev-scorer';
import { JevScoringResultSchema } from '@/lib/agents/jev-schema';
import { SCENARIO_FIXTURES } from '@/lib/db/fixtures';

describe('System 1 (Jev) - Formulas, Weights and Rubric Scoring', () => {
  it('strictly adheres to canonical 8-dimension weights summing to 1.0 (100%)', () => {
    const weights = Object.values(CANONICAL_DIMENSIONS).map((d) => d.weight);
    const sum = weights.reduce((acc, w) => acc + w, 0);

    expect(CANONICAL_DIMENSIONS.identifyPain.weight).toBe(0.2);
    expect(CANONICAL_DIMENSIONS.champion.weight).toBe(0.15);
    expect(CANONICAL_DIMENSIONS.economicBuyer.weight).toBe(0.15);
    expect(CANONICAL_DIMENSIONS.decisionCriteria.weight).toBe(0.15);
    expect(CANONICAL_DIMENSIONS.decisionProcess.weight).toBe(0.1);
    expect(CANONICAL_DIMENSIONS.metrics.weight).toBe(0.1);
    expect(CANONICAL_DIMENSIONS.competition.weight).toBe(0.1);
    expect(CANONICAL_DIMENSIONS.paperProcess.weight).toBe(0.05);

    expect(Number(sum.toFixed(2))).toBe(1.0);
  });

  it('calculates weighted composite score bounded between 0 and 100', () => {
    // All 0s
    expect(
      computeCompositeScore({
        identifyPain: 0,
        champion: 0,
        economicBuyer: 0,
        decisionCriteria: 0,
        decisionProcess: 0,
        metrics: 0,
        competition: 0,
        paperProcess: 0,
      })
    ).toBe(0);

    // All 10s
    expect(
      computeCompositeScore({
        identifyPain: 10,
        champion: 10,
        economicBuyer: 10,
        decisionCriteria: 10,
        decisionProcess: 10,
        metrics: 10,
        competition: 10,
        paperProcess: 10,
      })
    ).toBe(100);

    // Expected Acme Corp baseline scores:
    // 8*20 + 7*15 + 3*15 + 7*15 + 4*10 + 5*10 + 4*10 + 2*5
    // = 160 + 105 + 45 + 105 + 40 + 50 + 40 + 10 = 550 / 10 = 55-56
    const acmeScores = {
      identifyPain: 8,
      champion: 7,
      economicBuyer: 3,
      decisionCriteria: 7,
      decisionProcess: 4,
      metrics: 5,
      competition: 4,
      paperProcess: 2,
    };
    const composite = computeCompositeScore(acmeScores);
    expect(composite).toBeGreaterThanOrEqual(50);
    expect(composite).toBeLessThanOrEqual(58);
  });

  it('correctly maps dimension status based on score thresholds', () => {
    // 0 - 3: unaddressed
    expect(getDimensionStatus(0)).toBe('unaddressed');
    expect(getDimensionStatus(2)).toBe('unaddressed');
    expect(getDimensionStatus(3)).toBe('unaddressed');

    // 4 - 7: partial
    expect(getDimensionStatus(4)).toBe('partial');
    expect(getDimensionStatus(6)).toBe('partial');
    expect(getDimensionStatus(7)).toBe('partial');

    // 8 - 10: verified
    expect(getDimensionStatus(8)).toBe('verified');
    expect(getDimensionStatus(9)).toBe('verified');
    expect(getDimensionStatus(10)).toBe('verified');
  });
});

describe('System 1 (Jev) - Competitive Scanner', () => {
  it('detects Netlify with High Threat for Acme Corp scenario', () => {
    const acme = SCENARIO_FIXTURES.scenario_acme_netlify.default_data;
    const notes = `${acme.ae_notes}\n${acme.sa_notes}`;
    const mentions = scanCompetitiveMentions(notes);

    expect(mentions).toHaveLength(1);
    expect(mentions[0].name).toBe('Netlify');
    expect(mentions[0].threatLevel).toBe('high');
    expect(mentions[0].evidence).toContain('Netlify');
    expect(mentions[0].contextSummary).toContain('discount');
  });

  it('detects AWS Amplify with High Threat for Globex FinTech scenario', () => {
    const globex = SCENARIO_FIXTURES.scenario_globex_amplify.default_data;
    const notes = `${globex.ae_notes}\n${globex.sa_notes}`;
    const mentions = scanCompetitiveMentions(notes);

    expect(mentions).toHaveLength(1);
    expect(mentions[0].name).toBe('AWS Amplify');
    expect(mentions[0].threatLevel).toBe('high');
    expect(mentions[0].evidence).toContain('Amplify');
    expect(mentions[0].contextSummary).toContain('credits');
  });

  it('detects no competitive threats for Soylent Retail scenario', () => {
    const soylent = SCENARIO_FIXTURES.scenario_soylent_headless.default_data;
    const notes = `${soylent.ae_notes}\n${soylent.sa_notes}`;
    const mentions = scanCompetitiveMentions(notes);

    expect(mentions).toHaveLength(0);
  });

  it('detects Cloudflare Pages, Akamai/Fastly, and DIY Kubernetes', () => {
    const sampleNotes =
      'Evaluating Cloudflare Pages for zero-egress caching. Also incumbent Fastly contract expiring. Platform team resisting migration and defending bespoke DIY Kubernetes cluster.';
    const mentions = scanCompetitiveMentions(sampleNotes);

    const names = mentions.map((m) => m.name);
    expect(names).toContain('Cloudflare Pages');
    expect(names).toContain('Akamai/Fastly');
    expect(names).toContain('DIY Kubernetes / AWS ECS');

    const k8s = mentions.find((m) => m.name === 'DIY Kubernetes / AWS ECS');
    expect(k8s?.threatLevel).toBe('high');
  });
});

describe('System 1 (Jev) - Stage Gate Readiness Logic', () => {
  it('blocks Stage 2 -> Stage 3 on Acme Corp baseline specifically due to Economic Buyer gap', () => {
    const acme = SCENARIO_FIXTURES.scenario_acme_netlify.default_data;
    const result = scoreOpportunityWithJev({
      dealId: acme.id,
      stageName: acme.stage_name,
      aeNotes: acme.ae_notes,
      saNotes: acme.sa_notes,
    });

    // Validates against Zod schema
    expect(JevScoringResultSchema.safeParse(result).success).toBe(true);

    // Identify Pain >= 8
    expect(result.dimensions.identifyPain.score).toBeGreaterThanOrEqual(8);
    expect(result.dimensions.identifyPain.status).toBe('verified');

    // Champion >= 7
    expect(result.dimensions.champion.score).toBeGreaterThanOrEqual(7);

    // Overall Score in expected range (50-58)
    expect(result.overallScore).toBeGreaterThanOrEqual(50);
    expect(result.overallScore).toBeLessThanOrEqual(58);

    // Economic Buyer is unaddressed (score 3 < 4)
    expect(result.dimensions.economicBuyer.score).toBe(3);
    expect(result.dimensions.economicBuyer.status).toBe('unaddressed');

    // Gate 2 evaluation must be blocked
    expect(result.stageGate.gateReady).toBe(false);
    expect(result.stageGate.targetStage).toBe('Stage 3 - Technical Validation');
    expect(
      result.stageGate.gateBlockers.some((b) => b.includes('Economic Buyer'))
    ).toBe(true);
  });

  it('passes Stage Gate 2 when Economic Buyer is verified and pain/champion criteria met', () => {
    const acme = SCENARIO_FIXTURES.scenario_acme_netlify.default_data;
    const updatedSaNotes = `${acme.sa_notes}\n[SA Qualification Update]: Verified Marcus Vance holds unilateral signoff authority up to $250k. Budget confirmed and allocated.`;

    const result = scoreOpportunityWithJev({
      dealId: acme.id,
      stageName: 'Stage 2 - Discovery',
      aeNotes: acme.ae_notes,
      saNotes: updatedSaNotes,
    });

    expect(result.dimensions.economicBuyer.score).toBeGreaterThanOrEqual(8);
    expect(result.dimensions.economicBuyer.status).toBe('verified');
    expect(result.stageGate.gateReady).toBe(true);
    expect(result.stageGate.gateBlockers).toHaveLength(0);
  });

  it('evaluates Gate 3 (Technical Validation -> Proposal) with stricter thresholds', () => {
    // Stage 3 requires DC >= 7, EB >= 6, DP >= 5, Overall >= 70
    const dummyDimensions = {
      identifyPain: { score: 7, status: 'partial' as const, confidence: 0.8, evidence: [], gaps: [] },
      champion: { score: 7, status: 'partial' as const, confidence: 0.8, evidence: [], gaps: [] },
      economicBuyer: { score: 5, status: 'partial' as const, confidence: 0.7, evidence: [], gaps: [] }, // fails (< 6)
      decisionCriteria: { score: 8, status: 'verified' as const, confidence: 0.9, evidence: [], gaps: [] },
      decisionProcess: { score: 4, status: 'partial' as const, confidence: 0.7, evidence: [], gaps: [] }, // fails (< 5)
      metrics: { score: 7, status: 'partial' as const, confidence: 0.8, evidence: [], gaps: [] },
      competition: { score: 6, status: 'partial' as const, confidence: 0.8, evidence: [], gaps: [] },
      paperProcess: { score: 4, status: 'partial' as const, confidence: 0.6, evidence: [], gaps: [] },
    };

    const evaluation = evaluateStageGate('Stage 3 - Technical Validation', dummyDimensions, 65);

    expect(evaluation.gateReady).toBe(false);
    expect(evaluation.targetStage).toBe('Stage 4 - Proposal');
    expect(evaluation.gateBlockers.some((b) => b.includes('Economic Buyer'))).toBe(true);
    expect(evaluation.gateBlockers.some((b) => b.includes('Decision Process'))).toBe(true);
    expect(evaluation.gateBlockers.some((b) => b.includes('Overall MEDDPICC score'))).toBe(true);
  });
});
