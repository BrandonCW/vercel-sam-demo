import { getSessionInteractions } from '@/lib/db/crm';
import type { DealInteraction } from '@/lib/types/crm';

/**
 * Verification step for the root agent's delegation workflow tools
 * (score_deal, analyze_deal). A subagent's reply is prose; success is decided
 * here, deterministically, by the persisted result: the delegated tool must have
 * written its row in this Assessment Session and turn. Otherwise the root tool
 * fails with the subagent's own report, which carries the tool error.
 */
export async function requireDelegatedResult(input: {
  agent: string;
  tool: string;
  action: DealInteraction['action'];
  opportunityId: string;
  sessionId: string;
  turnId: string;
  report: string;
}): Promise<{ interactionId: string; report: string }> {
  'use step';
  const rows = await getSessionInteractions(input.opportunityId, input.sessionId);
  const row = rows.find((i) => i.action === input.action && i.payload?.turnId === input.turnId);
  if (!row) {
    throw new Error(
      `${input.agent} did not persist a ${input.tool} result for ${input.opportunityId} in this turn. ` +
        `Its report: ${input.report.trim() || '(empty)'}`
    );
  }
  return { interactionId: row.id, report: input.report };
}
