import {
  appendSaFeedbackOnce,
  getSessionInteractions,
  recordAssessmentStep,
  writebackOpportunityQualification,
} from './crm';
import { z } from 'zod';
import type { AssessmentScope } from '@/lib/assessment-session';
import { formatSaDiscoveryDelta, saFeedbackKey } from '@/lib/agents/feedback-schema';
import { JevScoringResult, JevScoringResultSchema } from '@/lib/agents/jev-schema';
import {
  clearVerifiedDimensionGaps,
  System2AnalysisResult,
  System2AnalysisResultSchema,
} from '@/lib/agents/system2';
import {
  decideQualificationStatus,
  jevOpportunityFields,
  mergeSystem2Findings,
  synthesizeSuggestedNextSteps,
} from '@/lib/agents/qualification-decision';
import type { DealInteraction, Opportunity } from '@/lib/types/crm';

/**
 * Persistence of System 1 / System 2 results, so tools pass only an
 * opportunityId and load everything else from Postgres. Every row is stamped
 * with its Assessment Session (root eve session) and turn, and every load is
 * scoped to one session, so concurrent sessions on one deal never cross.
 */

const stamp = (scope: AssessmentScope) => ({ assessmentSessionId: scope.sessionId, turnId: scope.turnId });

/** The persisted row and the Opportunity as it stands after one assessment step. */
export interface RecordedStep {
  interaction: DealInteraction;
  opportunity: Opportunity;
}

/** Persists a baseline or post-feedback rubric result: scores, flags and stage gate on the Opportunity plus its `initial_scoring` row, atomically. */
export async function recordJevScoring(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  scope: AssessmentScope,
  options?: { sessionStartedAt?: string | null }
): Promise<RecordedStep> {
  return recordAssessmentStep(
    opportunity.id,
    { ...jevOpportunityFields(jevResult), markInReview: true },
    { actor: 'system1_jev', action: 'initial_scoring', payload: { ...stamp(scope), jevResult } },
    options
  );
}

/** Persists deep gap & citation analysis: citations and gaps merged into the breakdown plus its `questions_generated` checkpoint row, atomically. */
export async function recordSystem2Analysis(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  system2Result: System2AnalysisResult,
  scope: AssessmentScope,
  sessionState: 'pending_feedback' | 'skipped_feedback' | 'ready_for_writeback' = 'pending_feedback',
  options?: { sessionStartedAt?: string | null }
): Promise<RecordedStep> {
  return recordAssessmentStep(
    opportunity.id,
    { meddpicc_breakdown: mergeSystem2Findings(jevResult, system2Result) },
    {
      actor: 'system2_llm',
      action: 'questions_generated',
      payload: {
        ...stamp(scope),
        system2Result,
        form: system2Result.phase3Form,
        model: system2Result.modelUsed,
        sessionState: sessionState ?? 'pending_feedback',
        checkpointTimestamp: new Date().toISOString(),
      },
    },
    options
  );
}

async function sessionPayloads(
  opportunityId: string,
  sessionId: string,
  action: DealInteraction['action']
): Promise<Record<string, any>[]> {
  const interactions = await getSessionInteractions(opportunityId, sessionId);
  return interactions.filter((i) => i.action === action).map((i) => i.payload);
}

/** Latest System 1 result of the Assessment Session (the delta re-score in turn 2). */
export async function loadLatestJevResult(opportunityId: string, sessionId: string): Promise<JevScoringResult> {
  const [payload] = await sessionPayloads(opportunityId, sessionId, 'initial_scoring');
  if (!payload) {
    throw new Error(`No System 1 result for ${opportunityId} in Assessment Session ${sessionId}. run_assessment scores it first.`);
  }
  return JevScoringResultSchema.parse(payload.jevResult);
}

/** First System 1 result of the Assessment Session: the baseline the delta is measured against. */
export async function loadBaselineJevResult(opportunityId: string, sessionId: string): Promise<JevScoringResult> {
  const payloads = await sessionPayloads(opportunityId, sessionId, 'initial_scoring');
  const payload = payloads[payloads.length - 1];
  if (!payload) {
    throw new Error(`No System 1 result for ${opportunityId} in Assessment Session ${sessionId}. run_assessment scores it first.`);
  }
  return JevScoringResultSchema.parse(payload.jevResult);
}

export async function loadLatestSystem2Result(opportunityId: string, sessionId: string): Promise<System2AnalysisResult> {
  const [payload] = await sessionPayloads(opportunityId, sessionId, 'questions_generated');
  if (!payload) {
    throw new Error(
      `No System 2 result for ${opportunityId} in Assessment Session ${sessionId}: run_assessment analyzes it first.`
    );
  }
  return System2AnalysisResultSchema.parse(payload.system2Result);
}

/**
 * Records the SA's discovery answers (turn 2): appends a timestamped update to
 * sa_notes and an `sa_feedback` row atomically, once per session and payload.
 * ae_notes is never touched. Requires the session's discovery form (turn 1).
 */
export async function recordSaFeedback(
  opportunityId: string,
  feedback: { formResponses: Record<string, string | string[]>; notesDelta?: string | null; expectedKey?: string },
  scope: AssessmentScope,
  options?: { phase3Form?: System2AnalysisResult['phase3Form']; sessionStartedAt?: string | null }
): Promise<{ recorded: boolean; feedbackKey: string }> {
  const phase3Form =
    options?.phase3Form ?? (await loadLatestSystem2Result(opportunityId, scope.sessionId)).phase3Form;
  const feedbackKey = await saFeedbackKey(feedback.formResponses, feedback.notesDelta);
  // The caller's key proves the answers were passed through unaltered; nothing is written otherwise.
  if (feedback.expectedKey !== undefined && feedback.expectedKey !== feedbackKey) {
    throw new Error(
      'SA feedback does not match its feedbackKey: formResponses and notesDelta must be passed exactly as received. Nothing was recorded.'
    );
  }
  const recorded = await appendSaFeedbackOnce({
    opportunityId,
    sessionId: scope.sessionId,
    feedbackKey,
    notesDelta: formatSaDiscoveryDelta(
      feedback.formResponses,
      feedback.notesDelta,
      new Date().toISOString(),
      phase3Form
    ),
    payload: {
      ...stamp(scope),
      feedbackKey,
      formResponses: feedback.formResponses,
      notesDelta: feedback.notesDelta ?? null,
    },
    sessionStartedAt: options?.sessionStartedAt,
  });
  return { recorded, feedbackKey };
}

export interface WritebackInMemoryContext {
  baselineJevResult?: JevScoringResult;
  latestJevResult?: JevScoringResult;
  system2Result?: System2AnalysisResult;
  sessionStartedAt?: string | null;
}

/**
 * Decide status and Suggested Next Steps in code, then write back atomically
 * with the single `writeback` audit row that closes the Assessment Session.
 * Accepts optional in-memory workflow results to skip redundant Neon roundtrips,
 * falling back to a single session-interactions query when omitted.
 */
export async function finalizeAssessmentWriteback(
  opportunity: Opportunity,
  scope: AssessmentScope,
  inMemory?: WritebackInMemoryContext
): Promise<{
  opportunity: Opportunity;
  suggestedNextSteps: string;
  deltaScore: number;
  baselineScore: number;
  finalScore: number;
  writebackId: string;
}> {
  let jevResult = inMemory?.latestJevResult;
  let baseline = inMemory?.baselineJevResult;
  let system2Result = inMemory?.system2Result;

  if (!jevResult || !baseline || !system2Result) {
    const interactions = await getSessionInteractions(opportunity.id, scope.sessionId);
    const scorings = interactions.filter((i) => i.action === 'initial_scoring').map((i) => i.payload);
    const analyses = interactions.filter((i) => i.action === 'questions_generated').map((i) => i.payload);

    if (!jevResult) {
      const [latestPayload] = scorings;
      if (!latestPayload) {
        throw new Error(
          `No System 1 result for ${opportunity.id} in Assessment Session ${scope.sessionId}. run_assessment scores it first.`
        );
      }
      jevResult = JevScoringResultSchema.parse(latestPayload.jevResult);
    }

    if (!baseline) {
      const baselinePayload = scorings[scorings.length - 1];
      if (!baselinePayload) {
        throw new Error(
          `No System 1 result for ${opportunity.id} in Assessment Session ${scope.sessionId}. run_assessment scores it first.`
        );
      }
      baseline = JevScoringResultSchema.parse(baselinePayload.jevResult);
    }

    if (!system2Result) {
      const [analysisPayload] = analyses;
      if (!analysisPayload) {
        throw new Error(
          `No System 2 result for ${opportunity.id} in Assessment Session ${scope.sessionId}: run_assessment analyzes it first.`
        );
      }
      system2Result = System2AnalysisResultSchema.parse(analysisPayload.system2Result);
    }
  }

  const reconciledSystem2 = clearVerifiedDimensionGaps(system2Result, jevResult);
  const qualificationStatus = decideQualificationStatus(jevResult, reconciledSystem2);
  const suggestedNextSteps = synthesizeSuggestedNextSteps(qualificationStatus, jevResult, reconciledSystem2);
  const deltaScore = jevResult.overallScore - baseline.overallScore;
  const { opportunity: updated, writebackId } = await writebackOpportunityQualification(opportunity.id, {
    expectedAeNotes: opportunity.ae_notes,
    suggested_next_steps: suggestedNextSteps,
    qualification_status: qualificationStatus,
    meddpicc_score: jevResult.overallScore,
    meddpicc_breakdown: mergeSystem2Findings(jevResult, reconciledSystem2),
    sessionId: scope.sessionId,
    sessionStartedAt: inMemory?.sessionStartedAt,
    audit: {
      actor: 'system2_llm',
      payload: {
        ...stamp(scope),
        previousScore: baseline.overallScore,
        newScore: jevResult.overallScore,
        deltaScore,
        qualificationStatus,
        suggestedNextSteps,
        stageGate: jevResult.stageGate,
        sessionState: 'closed',
        timestamp: new Date().toISOString(),
      },
    },
  });
  return {
    opportunity: updated,
    suggestedNextSteps,
    deltaScore,
    baselineScore: baseline.overallScore,
    finalScore: jevResult.overallScore,
    writebackId,
  };
}

export async function writebackQualification(
  opportunity: Opportunity,
  scope: AssessmentScope,
  inMemory?: WritebackInMemoryContext
) {
  return finalizeAssessmentWriteback(opportunity, scope, inMemory);
}

const SessionWritebackSchema = z.object({
  previousScore: z.number(),
  newScore: z.number(),
  deltaScore: z.number(),
  suggestedNextSteps: z.string().min(1),
});

/** The writeback telemetry of a closed Assessment Session. */
export async function loadSessionWriteback(
  opportunityId: string,
  sessionId: string
): Promise<{ previousScore: number; newScore: number; deltaScore: number; suggestedNextSteps: string }> {
  const [payload] = await sessionPayloads(opportunityId, sessionId, 'writeback');
  if (!payload) throw new Error(`Assessment Session ${sessionId} has no writeback for ${opportunityId}.`);
  return SessionWritebackSchema.parse(payload);
}
