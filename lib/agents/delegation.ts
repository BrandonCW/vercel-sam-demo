import { getDatabaseNow, getInteractions, getSessionInteractions, requireOpportunity } from '@/lib/db/crm';
import { JevScoringResultSchema, type JevScoringResult } from '@/lib/agents/jev-schema';
import { System2AnalysisResultSchema, type System2AnalysisResult } from '@/lib/agents/system2';
import type { System2ModelOption } from '@/lib/models';
import type { DealInteraction, Opportunity } from '@/lib/types/crm';

/**
 * Verification step for the root agent's delegation workflow tools
 * (score_deal, analyze_deal). A subagent's reply is prose; success is decided
 * here, deterministically, by the persisted result: the delegated tool must have
 * written its row in this Assessment Session and turn. Otherwise the root tool
 * fails with the subagent's own report, which carries the tool error, or, when
 * the Opportunity was reset after the delegation started (the reset purges the
 * session's rows), with that reset named as the cause.
 */
/**
 * The database time a delegation starts, as a workflow step so a replay reuses the recorded value.
 * Database time because reset events are stamped by the database, whichever host ran the reset.
 */
export async function delegationStartedAt(): Promise<string> {
  'use step';
  return getDatabaseNow();
}

/** The delegated tool's persisted row and the Opportunity as it stands after it. */
export interface DelegatedResult {
  interaction: DealInteraction;
  opportunity: Opportunity;
}

export async function requireDelegatedResult(input: {
  agent: string;
  tool: string;
  action: DealInteraction['action'];
  opportunityId: string;
  sessionId: string;
  turnId: string;
  /** Database time the delegation started (delegationStartedAt); a reset after it explains a missing row. */
  delegatedAt: string;
  report: string;
}): Promise<DelegatedResult> {
  'use step';
  const rows = await getSessionInteractions(input.opportunityId, input.sessionId);
  const row = rows.find((i) => i.action === input.action && i.payload?.turnId === input.turnId);
  if (row) return { interaction: row, opportunity: await requireOpportunity(input.opportunityId) };

  const reset = (await getInteractions(input.opportunityId)).find(
    (i) => i.action === 'reset' && Date.parse(i.created_at) >= Date.parse(input.delegatedAt)
  );
  if (reset) {
    throw new Error(
      `${input.opportunityId} was reset at ${reset.created_at} during this Assessment Session, which deleted its ` +
        `${input.tool} result. Nothing is wrong with ${input.agent}; start a new assessment (and do not reset the CRM ` +
        `or run live tests against the same database while an assessment is running).`
    );
  }
  throw new Error(
    `${input.agent} did not persist a ${input.tool} result for ${input.opportunityId} in this turn. ` +
      `Its report: ${input.report.trim() || '(empty)'}`
  );
}

/** score_deal's typed result: the persisted System 1 result and the Opportunity it updated. Pure. */
export function scoreDealResult({ interaction, opportunity }: DelegatedResult): {
  interactionId: string;
  jevResult: JevScoringResult;
  opportunity: Opportunity;
} {
  return { interactionId: interaction.id, jevResult: JevScoringResultSchema.parse(interaction.payload.jevResult), opportunity };
}

/**
 * analyze_deal's typed result: the persisted System 2 result (citations, gaps, playbook,
 * discovery form, modelUsed) and the Opportunity with the merged evidence. Pure, so a
 * model mismatch fails the tool at once instead of being retried as a step. Throws when
 * System 2 ran with a model other than the one requested.
 */
export function analyzeDealResult(
  { interaction, opportunity }: DelegatedResult,
  requestedModel: System2ModelOption | undefined
): { interactionId: string; system2Result: System2AnalysisResult; opportunity: Opportunity } {
  const system2Result = System2AnalysisResultSchema.parse(interaction.payload.system2Result);
  if (requestedModel && system2Result.modelUsed !== requestedModel) {
    throw new Error(`System 2 ran with ${system2Result.modelUsed}, not the requested model ${requestedModel}.`);
  }
  return { interactionId: interaction.id, system2Result, opportunity };
}
