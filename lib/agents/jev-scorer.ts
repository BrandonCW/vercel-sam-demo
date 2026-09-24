import {
  JevScoringInput,
  JevScoringResult,
  JevScoringResultSchema,
  DimensionStatus,
  StageGateEvaluation,
} from './jev-schema';
import { gateway, generateText } from 'ai';
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

const JEV_SYSTEM_PROMPT = `You are Jev, the Vercel Enterprise Deal Qualification & MEDDPICC Evaluation Engine (System 1).
Your task is to analyze Enterprise Opportunity notes (AE notes and SA discovery notes) and evaluate MEDDPICC qualification and Stage Gate readiness.

You MUST score the 8 canonical MEDDPICC dimensions (each score 0-10, status: 'unaddressed' | 'partial' | 'verified', confidence: 0.0-1.0, evidence: array of text citations, gaps: array of unaddressed items):
1. identifyPain (weight 0.20): Core operational/business pain, cost of inaction, timeline urgency
2. champion (weight 0.15): Tested internal advocate with influence and access to economic buyer
3. economicBuyer (weight 0.15): Discretionary budget sign-off authority confirmed
4. decisionCriteria (weight 0.15): Technical benchmarks, architecture requirements, compliance
5. decisionProcess (weight 0.10): Formal milestone timeline, technical evaluation steps
6. metrics (weight 0.10): Quantifiable ROI, performance metrics, conversion impact
7. competition (weight 0.10): Threat level and positioning against Netlify, AWS Amplify, Cloudflare, Akamai, DIY Kubernetes
8. paperProcess (weight 0.05): Legal review, infosec questionnaire, MSA and procurement path

Also detect competitive mentions with threatLevel ('low' | 'medium' | 'high'), evidence, and contextSummary.
Evaluate Stage Gate blockers for advancing past the current stage.

Return ONLY a valid JSON object matching:
{
  "opportunityId": string,
  "dimensions": {
    "identifyPain": { "score": number, "status": "unaddressed"|"partial"|"verified", "confidence": number, "evidence": string[], "gaps": string[] },
    "champion": { "score": number, "status": "unaddressed"|"partial"|"verified", "confidence": number, "evidence": string[], "gaps": string[] },
    "economicBuyer": { "score": number, "status": "unaddressed"|"partial"|"verified", "confidence": number, "evidence": string[], "gaps": string[] },
    "decisionCriteria": { "score": number, "status": "unaddressed"|"partial"|"verified", "confidence": number, "evidence": string[], "gaps": string[] },
    "decisionProcess": { "score": number, "status": "unaddressed"|"partial"|"verified", "confidence": number, "evidence": string[], "gaps": string[] },
    "metrics": { "score": number, "status": "unaddressed"|"partial"|"verified", "confidence": number, "evidence": string[], "gaps": string[] },
    "competition": { "score": number, "status": "unaddressed"|"partial"|"verified", "confidence": number, "evidence": string[], "gaps": string[] },
    "paperProcess": { "score": number, "status": "unaddressed"|"partial"|"verified", "confidence": number, "evidence": string[], "gaps": string[] }
  },
  "competitiveFlags": [
    { "name": string, "threatLevel": "low"|"medium"|"high", "evidence": string, "contextSummary": string }
  ],
  "stageGate": {
    "gateReady": boolean,
    "currentStage": string,
    "targetStage": string,
    "gateBlockers": string[]
  }
}`;

/**
 * Score an Opportunity using Jev AI model dispatched through Vercel AI Gateway (via Vercel AI SDK).
 * Throws when AI_GATEWAY_API_KEY is missing or the Gateway call fails; nothing is substituted.
 * TODO(issue 07): replace with the typesafe-ai/jev evaluation model.
 */
export async function scoreOpportunityWithJevAI(
  input: JevScoringInput,
  timeoutMs: number = 15000
): Promise<JevScoringResult> {
  assertAiGatewayConfigured();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { text: jsonText } = await generateText({
      model: gateway('openai/gpt-4o-mini'),
      system: JEV_SYSTEM_PROMPT,
      prompt: JSON.stringify({
        opportunityId: input.opportunityId || input.dealId,
        name: input.name,
        accountName: input.accountName,
        stageName: input.stageName,
        amount: input.amount,
        aeNotes: input.aeNotes,
        saNotes: input.saNotes,
      }),
      abortSignal: controller.signal,
    });

    if (!jsonText) {
      throw new Error('No JSON output returned from Jev AI on Vercel AI Gateway');
    }

    const cleaned = jsonText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const dims = parsed.dimensions;
    const overallScore = computeCompositeScore({
      identifyPain: Number(dims?.identifyPain?.score ?? 0),
      champion: Number(dims?.champion?.score ?? 0),
      economicBuyer: Number(dims?.economicBuyer?.score ?? 0),
      decisionCriteria: Number(dims?.decisionCriteria?.score ?? 0),
      decisionProcess: Number(dims?.decisionProcess?.score ?? 0),
      metrics: Number(dims?.metrics?.score ?? 0),
      competition: Number(dims?.competition?.score ?? 0),
      paperProcess: Number(dims?.paperProcess?.score ?? 0),
    });

    // Populate metadata labels & weights on dimensions
    for (const [key, config] of Object.entries(CANONICAL_DIMENSIONS) as [
      keyof JevScoringResult['dimensions'],
      DimensionConfig,
    ][]) {
      if (dims[key]) {
        dims[key].key = key;
        dims[key].label = config.label;
        dims[key].weight = config.weight;
        dims[key].score = Math.max(0, Math.min(10, Math.round(Number(dims[key].score || 0))));
        dims[key].status = getDimensionStatus(dims[key].score);
        dims[key].evidence = Array.isArray(dims[key].evidence) ? dims[key].evidence : [];
        dims[key].gaps = Array.isArray(dims[key].gaps) ? dims[key].gaps : [];
        dims[key].confidence = Number(dims[key].confidence || 0.8);
      }
    }

    const stageGate = evaluateStageGate(input.stageName, dims, overallScore);

    const result: JevScoringResult = {
      opportunityId: input.opportunityId || input.dealId || '',
      overallScore,
      dimensions: dims,
      competitiveFlags: Array.isArray(parsed.competitiveFlags) ? parsed.competitiveFlags : [],
      stageGate: parsed.stageGate?.gateBlockers ? parsed.stageGate : stageGate,
      evaluatedAt: new Date().toISOString(),
    };

    return JevScoringResultSchema.parse(result);
  } finally {
    clearTimeout(timer);
  }
}
