import { getDatabaseNow, getInteractions, getSessionInteractions } from '@/lib/db/crm';
import type { DealInteraction } from '@/lib/types/crm';

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
}): Promise<{ interaction: DealInteraction; report: string }> {
  'use step';
  const rows = await getSessionInteractions(input.opportunityId, input.sessionId);
  const row = rows.find((i) => i.action === input.action && i.payload?.turnId === input.turnId);
  if (row) return { interaction: row, report: input.report };

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
