import { getInteractions, recordInteraction, updateOpportunity, writebackOpportunityQualification } from './crm';
import { JevScoringResult, JevScoringResultSchema } from '@/lib/agents/jev-schema';
import { System2AnalysisResult, System2AnalysisResultSchema } from '@/lib/agents/system2';
import {
  decideQualificationStatus,
  mergeSystem2Findings,
  synthesizeSuggestedNextSteps,
} from '@/lib/agents/qualification-decision';
import type { DealInteraction, Opportunity } from '@/lib/types/crm';

/**
 * Persistence of System 1 / System 2 results, so tools pass only an
 * opportunityId and load everything else from Postgres.
 */

export async function recordJevScoring(opportunity: Opportunity, jevResult: JevScoringResult): Promise<Opportunity> {
  const updated = await updateOpportunity(opportunity.id, {
    meddpicc_score: jevResult.overallScore,
    meddpicc_breakdown: { ...jevResult.dimensions, stageGate: jevResult.stageGate },
    competitive_flags: jevResult.competitiveFlags.map((c) => c.name),
    stage_gate: jevResult.stageGate,
    qualification_status:
      opportunity.qualification_status === 'unqualified' ? 'in_review' : opportunity.qualification_status,
  });
  await recordInteraction({
    opportunity_id: opportunity.id,
    actor: 'system1_jev',
    action: 'initial_scoring',
    payload: { jevResult },
  });
  return updated;
}

export async function recordSystem2Analysis(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  system2Result: System2AnalysisResult
): Promise<Opportunity> {
  const updated = await updateOpportunity(opportunity.id, {
    meddpicc_breakdown: mergeSystem2Findings(jevResult, system2Result),
  });
  await recordInteraction({
    opportunity_id: opportunity.id,
    actor: 'system2_llm',
    action: 'questions_generated',
    payload: {
      system2Result,
      form: system2Result.phase3Form,
      model: system2Result.modelUsed,
      sessionState: 'pending_feedback',
      checkpointTimestamp: new Date().toISOString(),
    },
  });
  return updated;
}

async function latestPayload(opportunityId: string, action: 'initial_scoring' | 'questions_generated') {
  const interactions = await getInteractions(opportunityId);
  return interactions.find((i) => i.action === action)?.payload;
}

export async function loadLatestJevResult(opportunityId: string): Promise<JevScoringResult> {
  const payload = await latestPayload(opportunityId, 'initial_scoring');
  if (!payload) {
    throw new Error(`No System 1 result for ${opportunityId}. Run run_jev_scoring first.`);
  }
  return JevScoringResultSchema.parse(payload.jevResult);
}

export async function loadLatestSystem2Result(opportunityId: string): Promise<System2AnalysisResult> {
  const payload = await latestPayload(opportunityId, 'questions_generated');
  if (!payload) {
    throw new Error(`No System 2 result for ${opportunityId}. Run run_system2_analysis first.`);
  }
  return System2AnalysisResultSchema.parse(payload.system2Result);
}

/**
 * Decide status and Suggested Next Steps in code, then write back atomically.
 * The write is rejected if ae_notes changed since `opportunity` was read.
 */
export async function writebackQualification(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  system2Result: System2AnalysisResult,
  saNotes: string = opportunity.sa_notes
): Promise<{ opportunity: Opportunity; suggestedNextSteps: string }> {
  const qualificationStatus = decideQualificationStatus(jevResult, system2Result);
  const suggestedNextSteps = synthesizeSuggestedNextSteps(qualificationStatus, jevResult, system2Result);
  const updated = await writebackOpportunityQualification(opportunity.id, {
    expectedAeNotes: opportunity.ae_notes,
    sa_notes: saNotes,
    suggested_next_steps: suggestedNextSteps,
    qualification_status: qualificationStatus,
    meddpicc_score: jevResult.overallScore,
    meddpicc_breakdown: mergeSystem2Findings(jevResult, system2Result),
  });
  await recordInteraction({
    opportunity_id: opportunity.id,
    actor: 'system2_llm',
    action: 'writeback',
    payload: {
      suggested_next_steps: suggestedNextSteps,
      qualification_status: qualificationStatus,
      meddpicc_score: jevResult.overallScore,
    },
  });
  return { opportunity: updated, suggestedNextSteps };
}

type InteractionAction = DealInteraction['action'];

/** Latest interaction id per action, used to prove an eve turn persisted fresh results. */
export async function snapshotInteractions(opportunityId: string): Promise<Partial<Record<InteractionAction, string>>> {
  const snapshot: Partial<Record<InteractionAction, string>> = {};
  for (const interaction of await getInteractions(opportunityId)) {
    snapshot[interaction.action] ??= interaction.id;
  }
  return snapshot;
}

/** Throws unless each action has a newer interaction than in `before`, naming the tool that should have run. */
export async function requireFreshInteractions(
  opportunityId: string,
  before: Partial<Record<InteractionAction, string>>,
  expected: Partial<Record<InteractionAction, string>>
): Promise<void> {
  const after = await snapshotInteractions(opportunityId);
  const missing = (Object.entries(expected) as [InteractionAction, string][])
    .filter(([action]) => !after[action] || after[action] === before[action])
    .map(([, tool]) => tool);
  if (missing.length > 0) {
    throw new Error(
      `The eve agent finished without running ${missing.join(', ')} for ${opportunityId}; no fresh result was persisted.`
    );
  }
}
