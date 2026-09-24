import { describe, it, expect } from 'vitest';
import {
  CANONICAL_DIMENSIONS,
  computeCompositeScore,
  getDimensionStatus,
  evaluateStageGate,
  scoreOpportunityWithJevAI,
  buildJevEvaluationRequest,
  interpretJevEvaluation,
  COMPETITOR_TAXONOMY,
  RUBRIC_TEXT,
} from '@/lib/agents/jev-scorer';
import fs from 'fs';
import path from 'path';

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
      { score, status: getDimensionStatus(score), confidence: 0.8 },
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
      identifyPain: { score: 7, status: 'partial' as const, confidence: 0.8 },
      champion: { score: 7, status: 'partial' as const, confidence: 0.8 },
      economicBuyer: { score: 5, status: 'partial' as const, confidence: 0.7 }, // fails (< 6)
      decisionCriteria: { score: 8, status: 'verified' as const, confidence: 0.9 },
      decisionProcess: { score: 4, status: 'partial' as const, confidence: 0.7 }, // fails (< 5)
      metrics: { score: 7, status: 'partial' as const, confidence: 0.8 },
      competition: { score: 6, status: 'partial' as const, confidence: 0.8 },
      paperProcess: { score: 4, status: 'partial' as const, confidence: 0.6 },
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

const ACME_INPUT = {
  opportunityId: 'opp_acme',
  name: 'Acme',
  stageName: 'Stage 2 - Discovery',
  amount: 250000,
  aeNotes: 'Netlify renewal pending',
  saNotes: 'Deploy queue 45m',
};

function scoreAnswer(score: number) {
  return { type: 'score' as const, score };
}
function choiceAnswer(choice: string) {
  return { type: 'choice' as const, choice };
}

function acmeEvaluation(confidence: unknown = 0.82) {
  return {
    answers: {
      identifyPain: scoreAnswer(7.47),
      champion: scoreAnswer(5.94),
      economicBuyer: scoreAnswer(2.61),
      decisionCriteria: scoreAnswer(6.3),
      decisionProcess: scoreAnswer(3.6),
      metrics: scoreAnswer(4.68),
      competition: scoreAnswer(3.6),
      paperProcess: scoreAnswer(1.44),
      competitor_netlify: choiceAnswer('high'),
      competitor_awsAmplify: choiceAnswer('absent'),
      competitor_cloudflarePages: choiceAnswer('low'),
      competitor_akamaiFastly: choiceAnswer('absent'),
      competitor_diyKubernetes: choiceAnswer('absent'),
    },
    providerMetadata: { typesafe: { confidence } },
  };
}

describe('System 1 (Jev) - evaluation request', () => {
  it('asks one 0-10 score question per MEDDPICC dimension and one threat choice per taxonomy competitor', () => {
    const req = buildJevEvaluationRequest(ACME_INPUT);
    expect(req.state).toEqual({
      stageName: 'Stage 2 - Discovery',
      amount: 250000,
      aeNotes: 'Netlify renewal pending',
      saNotes: 'Deploy queue 45m',
    });
    for (const key of Object.keys(CANONICAL_DIMENSIONS)) {
      const q = req.questions[key];
      expect(q.type).toBe('score');
      // Jev accepts at most 10 levels per score question.
      expect((q as any).criteria).toHaveLength(10);
    }
    expect(Object.keys(COMPETITOR_TAXONOMY)).toHaveLength(5);
    const netlify = req.questions.competitor_netlify as any;
    expect(netlify.type).toBe('choice');
    expect(Object.keys(netlify.criteria)).toEqual(['absent', 'low', 'medium', 'high']);
    // Zero Data Retention is not required (user decision); the Gateway may retain requests.
    expect(req).not.toHaveProperty('providerOptions');
  });

  it('keeps rubric wording in questions identical to docs/meddpicc-rubric.md', () => {
    const rubric = fs.readFileSync(path.resolve(__dirname, '../docs/meddpicc-rubric.md'), 'utf8');
    const req = buildJevEvaluationRequest(ACME_INPUT);
    const rungs = (req.questions.economicBuyer as any).criteria as string[];
    expect(rungs[0]).toContain('No mention in AE or SA notes');
    expect(rungs[9]).toContain('Explicitly verified with documented evidence');
    // Level p means round(p * 10 / 9)/10, and each level carries its rubric band.
    expect(rungs.map((r) => r.split(' ')[0])).toEqual(
      ['0/10', '1/10', '2/10', '3/10', '4/10', '6/10', '7/10', '8/10', '9/10', '10/10']
    );
    expect(rungs[3]).toContain('(unaddressed)');
    expect(rungs[4]).toContain('(partial)');
    expect(rungs[6]).toContain('(partial)');
    expect(rungs[7]).toContain('(verified)');
    for (const [key, text] of Object.entries(RUBRIC_TEXT.focus)) {
      expect(rubric).toContain(text);
      expect((req.questions[key] as any).instructions).toContain(text);
    }
    for (const band of Object.values(RUBRIC_TEXT.bands)) expect(rubric).toContain(band);
  });
});

describe('System 1 (Jev) - interpreting answers', () => {
  it('reproduces the Acme baseline: composite 50-58, Identify Pain verified, Netlify high, Gate 2 blocked on Economic Buyer', () => {
    const r = interpretJevEvaluation(ACME_INPUT, acmeEvaluation());
    expect(r.dimensions.identifyPain.score).toBe(8);
    expect(r.dimensions.identifyPain.status).toBe('verified');
    expect(r.dimensions.economicBuyer.score).toBe(3);
    expect(r.dimensions.economicBuyer.status).toBe('unaddressed');
    expect(r.dimensions.champion.label).toBe('Champion');
    expect(r.dimensions.champion.confidence).toBe(0.82);
    // 8*20 + 7*15 + 3*15 + 7*15 + 4*10 + 5*10 + 4*10 + 2*5 = 555 -> 55.5 -> 56
    expect(r.overallScore).toBe(56);
    expect(r.competitiveFlags).toEqual([
      { name: 'Netlify', threatLevel: 'high' },
      { name: 'Cloudflare Pages', threatLevel: 'low' },
    ]);
    expect(r.stageGate.gateReady).toBe(false);
    expect(r.stageGate.gateBlockers).toHaveLength(1);
    expect(r.stageGate.gateBlockers[0]).toContain('Economic Buyer');
    expect(r.opportunityId).toBe('opp_acme');
    expect(r.dimensions.identifyPain).not.toHaveProperty('evidence');
  });

  it('uses per-question confidence when Jev reports it per question', () => {
    const r = interpretJevEvaluation(
      ACME_INPUT,
      acmeEvaluation({ identifyPain: 0.9, champion: 0.4, economicBuyer: 0.7, decisionCriteria: 0.6,
        decisionProcess: 0.5, metrics: 0.5, competition: 0.5, paperProcess: 0.3 })
    );
    expect(r.dimensions.identifyPain.confidence).toBe(0.9);
    expect(r.dimensions.champion.confidence).toBe(0.4);
  });

  it('throws when Jev omits confidence instead of inventing one', () => {
    const e = acmeEvaluation();
    (e as any).providerMetadata = {};
    expect(() => interpretJevEvaluation(ACME_INPUT, e)).toThrow(/confidence/);
  });

  it('throws when a dimension answer is missing', () => {
    const e = acmeEvaluation();
    delete (e.answers as any).metrics;
    expect(() => interpretJevEvaluation(ACME_INPUT, e)).toThrow(/metrics/);
  });
});
