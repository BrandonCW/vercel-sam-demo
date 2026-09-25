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
import { System2AnalysisResult, System2AnalysisResultSchema } from '@/lib/agents/system2';
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

/** Persists a System 1 result: scores, flags and stage gate on the Opportunity plus its `initial_scoring` row, atomically. */
export async function recordJevScoring(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  scope: AssessmentScope
): Promise<RecordedStep> {
  return recordAssessmentStep(
    opportunity.id,
    { ...jevOpportunityFields(jevResult), markInReview: true },
    { actor: 'system1_jev', action: 'initial_scoring', payload: { ...stamp(scope), jevResult } }
  );
}

/** Persists a System 2 result: citations and gaps merged into the breakdown plus its `questions_generated` checkpoint row, atomically. */
export async function recordSystem2Analysis(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  system2Result: System2AnalysisResult,
  scope: AssessmentScope
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
        sessionState: 'pending_feedback',
        checkpointTimestamp: new Date().toISOString(),
      },
    }
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
  scope: AssessmentScope
): Promise<{ recorded: boolean; feedbackKey: string }> {
  await loadLatestSystem2Result(opportunityId, scope.sessionId);
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
    notesDelta: formatSaDiscoveryDelta(feedback.formResponses, feedback.notesDelta, new Date().toISOString()),
    payload: {
      ...stamp(scope),
      feedbackKey,
      formResponses: feedback.formResponses,
      notesDelta: feedback.notesDelta ?? null,
    },
  });
  return { recorded, feedbackKey };
}

/**
 * Decide status and Suggested Next Steps in code, then write back atomically
 * with the single `writeback` audit row that closes the Assessment Session.
 * The write is rejected if ae_notes changed since `opportunity` was read.
 */
export async function writebackQualification(
  opportunity: Opportunity,
  scope: AssessmentScope
): Promise<{
  opportunity: Opportunity;
  suggestedNextSteps: string;
  deltaScore: number;
  baselineScore: number;
  finalScore: number;
  writebackId: string;
}> {
  // Sequential so a missing step fails with the earliest tool to run.
  const jevResult = await loadLatestJevResult(opportunity.id, scope.sessionId);
  const baseline = await loadBaselineJevResult(opportunity.id, scope.sessionId);
  const system2Result = await loadLatestSystem2Result(opportunity.id, scope.sessionId);
  const qualificationStatus = decideQualificationStatus(jevResult, system2Result);
  const suggestedNextSteps = synthesizeSuggestedNextSteps(qualificationStatus, jevResult, system2Result);
  const deltaScore = jevResult.overallScore - baseline.overallScore;
  const { opportunity: updated, writebackId } = await writebackOpportunityQualification(opportunity.id, {
    expectedAeNotes: opportunity.ae_notes,
    suggested_next_steps: suggestedNextSteps,
    qualification_status: qualificationStatus,
    meddpicc_score: jevResult.overallScore,
    meddpicc_breakdown: mergeSystem2Findings(jevResult, system2Result),
    sessionId: scope.sessionId,
    audit: {
      actor: 'system1_jev',
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
