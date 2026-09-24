import { describe, it, expect } from 'vitest';
import {
  CANONICAL_DIMENSIONS,
  computeCompositeScore,
  getDimensionStatus,
  evaluateStageGate,
  scoreOpportunityWithJevAI,
} from '@/lib/agents/jev-scorer';

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

function dims(scores: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(scores).map(([k, score]) => [
      k,
      { score, status: getDimensionStatus(score), confidence: 0.8, evidence: [], gaps: [] },
    ])
  ) as any;
}

const ACME_BASELINE = {
  identifyPain: 8, champion: 7, economicBuyer: 3, decisionCriteria: 7,
  decisionProcess: 4, metrics: 5, competition: 4, paperProcess: 2,
};

describe('System 1 (Jev) - Stage Gate Readiness Logic', () => {
  it('blocks Stage 2 -> Stage 3 specifically due to an Economic Buyer gap', () => {
    const overall = computeCompositeScore(ACME_BASELINE);
    const result = evaluateStageGate('Stage 2 - Discovery', dims(ACME_BASELINE), overall);

    expect(result.gateReady).toBe(false);
    expect(result.targetStage).toBe('Stage 3 - Technical Validation');
    expect(result.gateBlockers).toHaveLength(1);
    expect(result.gateBlockers[0]).toContain('Economic Buyer');
  });

  it('passes Stage Gate 2 when Economic Buyer is verified and pain/champion criteria met', () => {
    const scores = { ...ACME_BASELINE, economicBuyer: 8 };
    const result = evaluateStageGate('Stage 2 - Discovery', dims(scores), computeCompositeScore(scores));

    expect(result.gateReady).toBe(true);
    expect(result.gateBlockers).toHaveLength(0);
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

describe('System 1 (Jev) - fails loudly', () => {
  it('throws instead of returning a regex-derived score when AI_GATEWAY_API_KEY is unset', async () => {
    const saved = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try {
      await expect(
        scoreOpportunityWithJevAI({
          opportunityId: 'opp_x',
          name: 'X',
          stageName: 'Stage 2 - Discovery',
          aeNotes: 'notes',
          saNotes: '',
        })
      ).rejects.toThrow(/AI_GATEWAY_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.AI_GATEWAY_API_KEY = saved;
    }
  });
});
