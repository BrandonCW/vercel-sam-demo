import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as assess } from '@/app/api/qualification/assess/route';
import { POST as feedback } from '@/app/api/qualification/feedback/route';
import { getInteractions, getOpportunity, resetCrmDatabase } from '@/lib/db/crm';

// Billed: drives the real two-turn Assessment Session through the /api/qualification routes
// against a running app that serves /eve/v1/* at EVE_AGENT_ORIGIN (e.g. `pnpm dev` started with
// the same .env.test.local), with real Jev + System 2 calls and the Postgres test branch.
// Opt in with JEV_LIVE=1 and EVE_LIVE_SESSION=1.
const live =
  process.env.JEV_LIVE === '1' && process.env.EVE_LIVE_SESSION === '1' && !!process.env.AI_GATEWAY_API_KEY;
const ACME = 'opp_acme_corp_001';

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!live)('Assessment Session - live two-turn eve session', () => {
  it('assesses in turn 1, pauses, then records feedback, re-scores and writes back in turn 2 of the same session', async () => {
    const baseline = await resetCrmDatabase('scenario_acme_netlify');

    const assessed = await assess(post('/api/qualification/assess', { opportunityId: ACME }));
    const turnOne = await assessed.json();
    expect(turnOne, JSON.stringify(turnOne.error)).toMatchObject({ success: true, sessionState: 'pending_feedback' });
    const checkpoint = (await getInteractions(ACME)).find((i) => i.action === 'questions_generated')!;
    const sessionId = checkpoint.payload.assessmentSessionId;
    expect(sessionId).toMatch(/\S/);

    const fieldIds: string[] = turnOne.form.sections.flatMap((s: any) => s.fields.map((f: any) => f.id));
    const formResponses = {
      [fieldIds[0]]:
        'Marcus Vance, VP of E-Commerce, confirmed he holds unilateral sign-off authority for the $180k budget.',
    };
    const replied = await feedback(
      post('/api/qualification/feedback', {
        opportunityId: ACME,
        formResponses,
        notesDelta: 'Economic Buyer verified on the discovery call.',
      })
    );
    const turnTwo = await replied.json();
    console.log('LIVE_SESSION', JSON.stringify({
      sessionId,
      before: turnOne.jevResult.overallScore,
      after: turnTwo.jevResult?.overallScore,
      deltaScore: turnTwo.deltaScore,
      suggestedNextSteps: turnTwo.suggestedNextSteps,
      error: turnTwo.error,
    }));
    expect(turnTwo).toMatchObject({ success: true, sessionState: 'closed' });

    const rows = (await getInteractions(ACME)).filter((i) => i.payload?.assessmentSessionId === sessionId);
    const actions = rows.map((i) => i.action);
    for (const action of ['initial_scoring', 'questions_generated', 'sa_feedback', 'writeback']) {
      expect(actions).toContain(action);
    }
    expect(actions.filter((a) => a === 'writeback')).toHaveLength(1);
    expect(actions.filter((a) => a === 'sa_feedback')).toHaveLength(1);
    // Two System 1 runs in one session: the baseline in turn 1 and the delta re-score in turn 2.
    expect(new Set(rows.filter((i) => i.action === 'initial_scoring').map((i) => i.payload.turnId)).size).toBe(2);

    const after = (await getOpportunity(ACME))!;
    expect(after.ae_notes).toBe(baseline.ae_notes);
    expect(after.sa_notes).toContain('Economic Buyer verified on the discovery call.');
    expect(after.suggested_next_steps).toBe(turnTwo.suggestedNextSteps);
  }, 600_000);
});
