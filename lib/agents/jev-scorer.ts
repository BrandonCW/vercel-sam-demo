import {
  JevScoringInput,
  JevScoringResult,
  JevScoringResultSchema,
  CompetitiveThreatLevelSchema,
  DimensionStatus,
  StageGateEvaluation,
} from './jev-schema';
import { evaluate } from 'eve/ai';
import type { Experimental_EvaluationQuestion as EvaluationQuestion } from 'ai';
import { assertAiGatewayConfigured } from '@/lib/env';

export interface DimensionConfig {
  key: keyof JevScoringResult['dimensions'];
  label: string;
  weight: number;
}

export const CANONICAL_DIMENSIONS: Record<keyof JevScoringResult['dimensions'], DimensionConfig> = {
  identifyPain: { key: 'identifyPain', label: 'Identify Pain', weight: 0.2 },
  champion: { key: 'champion', label: 'Champion', weight: 0.15 },
  economicBuyer: { key: 'economicBuyer', label: 'Economic Buyer', weight: 0.15 },
  decisionCriteria: { key: 'decisionCriteria', label: 'Decision Criteria', weight: 0.15 },
  decisionProcess: { key: 'decisionProcess', label: 'Decision Process', weight: 0.1 },
  metrics: { key: 'metrics', label: 'Metrics', weight: 0.1 },
  competition: { key: 'competition', label: 'Competition', weight: 0.1 },
  paperProcess: { key: 'paperProcess', label: 'Paper Process', weight: 0.05 },
};

export function getDimensionStatus(score: number): DimensionStatus {
  if (score >= 8) return 'verified';
  if (score >= 4) return 'partial';
  return 'unaddressed';
}

export function computeCompositeScore(
  dimensionScores: Record<keyof JevScoringResult['dimensions'], number>
): number {
  let total = 0;
  for (const [key, config] of Object.entries(CANONICAL_DIMENSIONS) as [
    keyof JevScoringResult['dimensions'],
    DimensionConfig,
  ][]) {
    const score = dimensionScores[key] ?? 0;
    total += score * 10 * config.weight;
  }
  return Math.min(100, Math.max(0, Math.round(total)));
}

/**
 * Stage Gate Evaluation
 * Evaluates readiness for:
 * - Gate 2: Discovery -> Technical Validation (Stage 2 -> Stage 3)
 * - Gate 3: Technical Validation -> Proposal (Stage 3 -> Stage 4)
 */
export function evaluateStageGate(
  stageName: string,
  dimensions: JevScoringResult['dimensions'],
  overallScore: number
): StageGateEvaluation {
  const isStage2 = /stage\s*2|discovery/i.test(stageName);
  const isStage3 = /stage\s*3|technical validation|validation/i.test(stageName);

  if (isStage2) {
    const blockers: string[] = [];
    const targetStage = 'Stage 3 - Technical Validation';

    // Gate 2 Rules:
    // Identify Pain >= 6
    if (dimensions.identifyPain.score < 6) {
      blockers.push(
        `Identify Pain score is ${dimensions.identifyPain.score}/10 (minimum 6/10 required with validated business pain)`
      );
    }

    // Champion >= 5
    if (dimensions.champion.score < 5) {
      blockers.push(
        `Champion score is ${dimensions.champion.score}/10 (minimum 5/10 required with identified advocate)`
      );
    }

    // Metrics >= 4
    if (dimensions.metrics.score < 4) {
      blockers.push(
        `Metrics score is ${dimensions.metrics.score}/10 (minimum 4/10 required with preliminary measurable targets)`
      );
    }

    // Economic Buyer >= 4 (Blocked on Acme Corp baseline where EB = 3)
    if (dimensions.economicBuyer.score < 4) {
      blockers.push(
        `Economic Buyer is not verified in discovery notes (score: ${dimensions.economicBuyer.score}/10, minimum 4/10 required)`
      );
    }

    // Overall Score >= 50
    if (overallScore < 50) {
      blockers.push(
        `Overall MEDDPICC score is ${overallScore}/100 (minimum 50/100 required for Gate 2)`
      );
    }

    return {
      gateReady: blockers.length === 0,
      currentStage: stageName,
      targetStage,
      gateBlockers: blockers,
    };
  }

  if (isStage3) {
    const blockers: string[] = [];
    const targetStage = 'Stage 4 - Proposal';

    // Gate 3 Rules:
    // Decision Criteria >= 7
    if (dimensions.decisionCriteria.score < 7) {
      blockers.push(
        `Decision Criteria score is ${dimensions.decisionCriteria.score}/10 (minimum 7/10 required with locked technical benchmarks)`
      );
    }

    // Economic Buyer >= 6
    if (dimensions.economicBuyer.score < 6) {
      blockers.push(
        `Economic Buyer score is ${dimensions.economicBuyer.score}/10 (minimum 6/10 required with direct sponsor sign-off)`
      );
    }

    // Decision Process >= 5
    if (dimensions.decisionProcess.score < 5) {
      blockers.push(
        `Decision Process score is ${dimensions.decisionProcess.score}/10 (minimum 5/10 required with formal evaluation steps mapped)`
      );
    }

    // Identify Pain >= 7
    if (dimensions.identifyPain.score < 7) {
      blockers.push(
        `Identify Pain score is ${dimensions.identifyPain.score}/10 (minimum 7/10 required for commercial proposal)`
      );
    }

    // Champion >= 7
    if (dimensions.champion.score < 7) {
      blockers.push(
        `Champion score is ${dimensions.champion.score}/10 (minimum 7/10 required with executive access)`
      );
    }

    // Overall Score >= 70
    if (overallScore < 70) {
      blockers.push(
        `Overall MEDDPICC score is ${overallScore}/100 (minimum 70/100 required for Gate 3 exit)`
      );
    }

    return {
      gateReady: blockers.length === 0,
      currentStage: stageName,
      targetStage,
      gateBlockers: blockers,
    };
  }

  // Non-gated stage
  return {
    gateReady: true,
    currentStage: stageName,
    targetStage: stageName,
    gateBlockers: [],
  };
}

type DimensionKey = keyof JevScoringResult['dimensions'];

/**
 * Rubric wording, copied verbatim from docs/meddpicc-rubric.md (the single source
 * of truth). tests/jev.test.ts fails if this text drifts from the document.
 */
export const RUBRIC_TEXT = {
  bands: {
    unaddressed:
      'No mention in AE or SA notes, or only speculative assumptions without customer corroboration.',
    partial:
      'Qualitative mention or intent expressed, but lacks quantitative metrics, formal signoff, or stakeholder verification.',
    verified:
      'Explicitly verified with documented evidence, stakeholder confirmation, or completed technical validation.',
  },
  focus: {
    identifyPain:
      'Deploy queue bottlenecks, slow build times (30–60m), outage risk during product launches, CDN cache invalidation limits, multi-zone latency issues.',
    champion:
      'Technical leaders (Head of Platform, VP Eng, Staff Architect) actively advocating for Next.js/Vercel and selling internally on Vercel\'s behalf.',
    economicBuyer:
      'Verified executive sponsor (CTO, VP of E-Commerce, Chief Digital Officer, CFO) with sign-off authority and confirmed budget allocation.',
    decisionCriteria:
      'Explicit technical requirements: Next.js App Router/Turborepo native support, Edge Middleware latency, SOC2 Type II, 99.99% SLA, and zero-downtime cutover.',
    decisionProcess:
      'Formal POC benchmarks, architecture review board signoff, security review milestones, and scheduled committee dates.',
    metrics:
      'Core Web Vitals (LCP < 1.5s, INP < 200ms), developer build-time reduction (e.g. 45m → 5m), infrastructure cost savings, conversion uplift.',
    competition:
      'Vendor positioning against Netlify, AWS Amplify, Cloudflare Pages, Fastly/Akamai, or in-house DIY Kubernetes/ECS deployments.',
    paperProcess:
      'Vendor onboarding timeline, standard MSA review, custom SLA terms, data processing addendum (DPA), and procurement approvals.',
  } satisfies Record<DimensionKey, string>,
  threat: {
    low: 'Casual mention or legacy tool being replaced with full alignment on Vercel.',
    medium:
      'Competing solution is under active evaluation in a bake-off; evaluation criteria not yet locked.',
    high: 'Competitor is incumbent with multi-year pricing discounts, or executive sponsor prefers incumbent vendor.',
  },
} as const;

/** Competitors Jev screens for; question ids are `competitor_<key>`. */
export const COMPETITOR_TAXONOMY = {
  netlify: 'Netlify',
  awsAmplify: 'AWS Amplify',
  cloudflarePages: 'Cloudflare Pages',
  akamaiFastly: 'Akamai/Fastly',
  diyKubernetes: 'DIY Kubernetes/ECS',
} as const;

const THREAT_CRITERIA = {
  absent: 'The competitor is not mentioned or considered anywhere in the notes.',
  low: RUBRIC_TEXT.threat.low,
  medium: RUBRIC_TEXT.threat.medium,
  high: RUBRIC_TEXT.threat.high,
};

/**
 * Jev accepts at most 10 levels per score question. Level p (0..9) stands for
 * round(p * 10 / 9) on the rubric's 0-10 scale, worded with that value's rubric band.
 * Jev returns a fractional level position, scaled the same way.
 */
const SCORE_LEVELS = 10;
const SCORE_RUNGS = Array.from({ length: SCORE_LEVELS }, (_, p) => {
  const value = Math.round((p * 10) / (SCORE_LEVELS - 1));
  const status = getDimensionStatus(value);
  return `${value}/10 (${status}): ${RUBRIC_TEXT.bands[status]}`;
});

function toTenPointScore(position: number): number {
  const scaled = (position * 10) / (SCORE_LEVELS - 1);
  return Math.max(0, Math.min(10, Math.round(scaled)));
}

export function buildJevEvaluationRequest(input: JevScoringInput) {
  const dimensionQuestions = Object.fromEntries(
    (Object.keys(CANONICAL_DIMENSIONS) as DimensionKey[]).map((key) => [
      key,
      {
        type: 'score' as const,
        instructions: `Score the MEDDPICC dimension "${CANONICAL_DIMENSIONS[key].label}" from the AE and SA notes. Vercel Enterprise evaluation focus: ${RUBRIC_TEXT.focus[key]}`,
        criteria: SCORE_RUNGS,
      },
    ])
  ) as Record<DimensionKey, { type: 'score'; instructions: string; criteria: string[] }>;

  const competitorQuestions = Object.fromEntries(
    Object.entries(COMPETITOR_TAXONOMY).map(([key, name]) => [
      `competitor_${key}`,
      {
        type: 'choice' as const,
        instructions: `Classify the competitive threat from ${name} in this opportunity.`,
        criteria: THREAT_CRITERIA,
      },
    ])
  ) as Record<string, { type: 'choice'; instructions: string; criteria: typeof THREAT_CRITERIA }>;

  return {
    state: {
      stageName: input.stageName,
      amount: input.amount ?? null,
      aeNotes: input.aeNotes,
      saNotes: input.saNotes,
    },
    questions: { ...dimensionQuestions, ...competitorQuestions } as Record<string, EvaluationQuestion>,
  };
}

/** The subset of an AI SDK evaluation result that System 1 reads. */
export interface JevEvaluation {
  answers: Record<string, { type: string; score?: number; choice?: string } | undefined>;
  providerMetadata?: Record<string, unknown> | undefined;
}

function confidenceFor(metadata: JevEvaluation['providerMetadata'], key: DimensionKey): number {
  const raw = (metadata?.typesafe as { confidence?: unknown } | undefined)?.confidence;
  const value =
    typeof raw === 'number' ? raw : raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
  if (typeof value !== 'number' || value < 0 || value > 1) {
    throw new Error(`Jev returned no usable providerMetadata.typesafe.confidence for "${key}"`);
  }
  return value;
}

/** Pure mapping from Jev's typed answers to the System 1 result. Throws on any missing answer. */
export function interpretJevEvaluation(
  input: JevScoringInput,
  evaluation: JevEvaluation
): JevScoringResult {
  const dimensions = {} as JevScoringResult['dimensions'];
  const scores = {} as Record<DimensionKey, number>;
  for (const [key, config] of Object.entries(CANONICAL_DIMENSIONS) as [DimensionKey, DimensionConfig][]) {
    const answer = evaluation.answers[key];
    if (answer?.type !== 'score' || typeof answer.score !== 'number') {
      throw new Error(`Jev returned no score answer for "${key}"`);
    }
    const score = toTenPointScore(answer.score);
    scores[key] = score;
    dimensions[key] = {
      key,
      label: config.label,
      weight: config.weight,
      score,
      status: getDimensionStatus(score),
      confidence: confidenceFor(evaluation.providerMetadata, key),
    };
  }

  const competitiveFlags: JevScoringResult['competitiveFlags'] = [];
  for (const [key, name] of Object.entries(COMPETITOR_TAXONOMY)) {
    const answer = evaluation.answers[`competitor_${key}`];
    if (answer?.type !== 'choice' || !answer.choice) {
      throw new Error(`Jev returned no choice answer for "competitor_${key}"`);
    }
    if (answer.choice !== 'absent') {
      competitiveFlags.push({ name, threatLevel: CompetitiveThreatLevelSchema.parse(answer.choice) });
    }
  }

  const overallScore = computeCompositeScore(scores);
  return JevScoringResultSchema.parse({
    opportunityId: input.opportunityId,
    overallScore,
    dimensions,
    competitiveFlags,
    stageGate: evaluateStageGate(input.stageName, dimensions, overallScore),
    evaluatedAt: new Date().toISOString(),
  });
}

/**
 * System 1: score an Opportunity with TypeSafe AI's `typesafe-ai/jev` evaluation
 * model through Vercel AI Gateway. Jev answers typed questions; composite and
 * stage gates are computed in code. Throws on missing config or any Jev error.
 */
export async function scoreOpportunityWithJevAI(
  input: JevScoringInput,
  options: { abortSignal?: AbortSignal } = {}
): Promise<JevScoringResult> {
  assertAiGatewayConfigured();
  const request = buildJevEvaluationRequest(input);
  const evaluation = await evaluate({ ...request, abortSignal: options.abortSignal });
  return interpretJevEvaluation(input, evaluation);
}
