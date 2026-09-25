import { describe, it, expect, beforeEach } from 'vitest';
import { requireDelegatedResult } from '@/lib/agents/delegation';
import { getOpportunity, resetCrmDatabase } from '@/lib/db/crm';
import { recordJevScoring } from '@/lib/db/assessments';
import assessorAgent from '@/agent/subagents/qualification_assessor/agent';
import playbookAgent from '@/agent/subagents/playbook_generator/agent';
import { scope } from './fixtures/eve-session';
import { jev } from './fixtures/qualification';

const ACME = 'opp_acme_corp_001';
const check = (turnId: string, report = 'Composite 58') =>
  requireDelegatedResult({
    agent: 'qualification_assessor',
    tool: 'run_jev_scoring',
    action: 'initial_scoring',
    opportunityId: ACME,
    sessionId: 'wrun_D',
    turnId,
    report,
  });

describe('root delegation to subagents (one turn per Assessment Session step)', { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
  });

  it('subagents are reachable only through the waiting workflow tools, not as background tools', () => {
    expect((assessorAgent as any).tool).toBe(false);
    expect((playbookAgent as any).tool).toBe(false);
  });

  it('succeeds only when the delegated tool persisted a result in this session and turn', async () => {
    await recordJevScoring((await getOpportunity(ACME))!, jev(), scope('wrun_D', 'turn_1'));
    await expect(check('turn_1')).resolves.toMatchObject({ report: 'Composite 58' });
  });

  it("fails with the subagent's report when the turn persisted nothing (e.g. the tool errored)", async () => {
    await recordJevScoring((await getOpportunity(ACME))!, jev(), scope('wrun_D', 'turn_1'));
    // A score from turn 1 does not satisfy the turn-2 re-score.
    await expect(check('turn_2', 'run_jev_scoring failed: Jev 402 payment required')).rejects.toThrow(
      /did not persist a run_jev_scoring result.*Jev 402 payment required/
    );
  });
});
