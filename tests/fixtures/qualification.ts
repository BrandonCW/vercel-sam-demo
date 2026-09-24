// Fixtures for pure-logic tests only; tests/eve-tools.live.test.ts covers the same paths live.
import type { JevScoringResult } from '@/lib/agents/jev-schema';
import type { System2AnalysisResult } from '@/lib/agents/system2';

const dim = (key: string, score: number) => ({
  key,
  label: key,
  weight: 0.1,
  score,
  status: score >= 8 ? 'verified' : score >= 4 ? 'partial' : 'unaddressed',
  confidence: 0.8,
}) as const;

export function jev(overrides: Partial<JevScoringResult> = {}): JevScoringResult {
  return {
    opportunityId: 'opp_acme_corp_001',
    overallScore: 54,
    dimensions: {
      metrics: dim('metrics', 6),
      economicBuyer: dim('economicBuyer', 3),
      decisionCriteria: dim('decisionCriteria', 6),
      decisionProcess: dim('decisionProcess', 4),
      paperProcess: dim('paperProcess', 1),
      identifyPain: dim('identifyPain', 9),
      champion: dim('champion', 7),
      competition: dim('competition', 8),
    },
    competitiveFlags: [
      { name: 'Cloudflare Pages', threatLevel: 'low' },
      { name: 'Netlify', threatLevel: 'high' },
    ],
    stageGate: {
      gateReady: false,
      currentStage: 'Stage 2 - Discovery',
      targetStage: 'Stage 3 - Technical Validation',
      gateBlockers: ['Economic Buyer is not verified in discovery notes (score: 3/10, minimum 4/10 required)'],
      blockingDimensions: ['economicBuyer'],
    },
    evaluatedAt: '2026-09-25T00:00:00.000Z',
    ...overrides,
  } as JevScoringResult;
}

const emptyFinding = { citations: [], gaps: [] };
export function system2(overrides: Partial<System2AnalysisResult> = {}): System2AnalysisResult {
  return {
    opportunityId: 'opp_acme_corp_001',
    modelUsed: 'anthropic/claude-sonnet-5',
    phase1Gaps: [],
    phase2Competitive: [],
    phase3Form: {
      opportunityId: 'opp_acme_corp_001',
      title: 'Technical Qualification & Discovery Validation',
      summary: 'Confirm Economic Buyer authority.',
      sections: [
        {
          id: 'gate_blockers',
          title: 'Stage Gate Blockers',
          fields: [
            { id: 'eb', name: 'eb', label: 'Who signs?', type: 'text', required: true, dimensionTarget: 'economicBuyer' },
          ],
        },
      ],
    },
    dimensionFindings: {
      metrics: emptyFinding,
      economicBuyer: {
        citations: ['VP of E-Commerce mentioned budget'],
        gaps: ['No confirmed sign-off authority'],
      },
      decisionCriteria: emptyFinding,
      decisionProcess: emptyFinding,
      paperProcess: emptyFinding,
      identifyPain: emptyFinding,
      champion: emptyFinding,
      competition: emptyFinding,
    },
    fatalBlocker: null,
    valueFocus: 'Turborepo Remote Caching & ISR',
    primaryRisk: 'Budget freeze before Q4',
    nextMilestone: 'Run a 2-week POC on Vercel Enterprise.',
    summary: 'summary',
    ...overrides,
  } as System2AnalysisResult;
}

