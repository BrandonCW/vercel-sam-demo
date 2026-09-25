import { z } from 'zod';
import type { ClientSessionState } from 'eve/client';
import type { Opportunity } from '@/lib/types/crm';

/**
 * The durable eve session of each Opportunity's Assessment Session, remembered in
 * this browser (localStorage) so a reload resumes it with `resume: true`. Saved as
 * soon as eve creates the session, so a reload mid-turn follows the running turn.
 * Only the session ID matters: the workbench replays the stream from index 0 and
 * rebuilds its view from the events, so no event log is stored.
 *
 * Each entry records the Opportunity's reset marker (`last_reset_at`) at save time.
 * A reset (from any browser, the agent or a test run) deletes the session's results,
 * so an entry whose marker no longer matches is stale and is dropped, not resumed.
 */

type OpportunityRef = Pick<Opportunity, 'id' | 'last_reset_at'>;

const PREFIX = 'deal-qual:assessment-session:';
const SavedSessionSchema = z.object({ sessionId: z.string().min(1), resetMarker: z.string().nullable() });

function storage(action: string, run: () => string | null | void): string | null | void {
  try {
    return run();
  } catch (error) {
    console.error(
      `This browser's storage is unavailable, so the workbench cannot resume Assessment Sessions after a reload (${action}): ` +
        (error instanceof Error ? error.message : String(error))
    );
    return null;
  }
}

export function loadSavedSession(opportunity: OpportunityRef): ClientSessionState | undefined {
  const raw = storage('read', () => localStorage.getItem(PREFIX + opportunity.id));
  if (!raw) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = undefined;
  }
  const parsed = SavedSessionSchema.safeParse(value);
  if (!parsed.success) {
    console.error(`Ignoring a malformed saved Assessment Session for ${opportunity.id}: ${raw}`);
    clearSavedSession(opportunity.id);
    return undefined;
  }
  if (parsed.data.resetMarker !== (opportunity.last_reset_at ?? null)) {
    console.warn(
      `${opportunity.id} was reset (${opportunity.last_reset_at}) after its Assessment Session was saved; ` +
        `not resuming ${parsed.data.sessionId}.`
    );
    clearSavedSession(opportunity.id);
    return undefined;
  }
  return { sessionId: parsed.data.sessionId, streamIndex: 0 };
}

export function saveSession(opportunity: OpportunityRef, session: ClientSessionState): void {
  const value = JSON.stringify({ sessionId: session.sessionId, resetMarker: opportunity.last_reset_at ?? null });
  storage('save', () => localStorage.setItem(PREFIX + opportunity.id, value));
}

export function clearSavedSession(opportunityId: string): void {
  storage('clear', () => localStorage.removeItem(PREFIX + opportunityId));
}
