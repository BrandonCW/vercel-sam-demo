import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeDealResult, delegationStartedAt, requireDelegatedResult, scoreDealResult } from '@/lib/agents/delegation';
import { getOpportunity, resetCrmDatabase } from '@/lib/db/crm';
import { recordJevScoring, recordSystem2Analysis } from '@/lib/db/assessments';
import assessorAgent from '@/agent/subagents/qualification_assessor/agent';
import playbookAgent from '@/agent/subagents/playbook_generator/agent';
import { scope } from './fixtures/eve-session';
import { jev, system2 } from './fixtures/qualification';

const ACME = 'opp_acme_corp_001';
const check = async (turnId: string, report = 'Composite 58', delegatedAt?: string) =>
  requireDelegatedResult({
    delegatedAt: delegatedAt ?? (await delegationStartedAt()),
    agent: 'qualification_assessor',
    tool: 'run_jev_scoring',
    action: 'initial_scoring',
    opportunityId: ACME,
    sessionId: 'wrun_D',
    turnId,
    report,
  });

const checkAnalysis = async () =>
  requireDelegatedResult({
    delegatedAt: await delegationStartedAt(),
    agent: 'playbook_generator',
    tool: 'run_system2_analysis',
    action: 'questions_generated',
    opportunityId: ACME,
    sessionId: 'wrun_D',
    turnId: 'turn_1',
    report: 'r',
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
    await expect(check('turn_1')).resolves.toMatchObject({ opportunity: { id: ACME } });
  });

  it("fails with the subagent's report when the turn persisted nothing (e.g. the tool errored)", async () => {
    await recordJevScoring((await getOpportunity(ACME))!, jev(), scope('wrun_D', 'turn_1'));
    // A score from turn 1 does not satisfy the turn-2 re-score.
    await expect(check('turn_2', 'run_jev_scoring failed: Jev 402 payment required')).rejects.toThrow(
      /did not persist a run_jev_scoring result.*Jev 402 payment required/
    );
  });

  it('names a CRM reset that deleted the session results mid-turn instead of blaming the subagent', async () => {
    const delegatedAt = await delegationStartedAt();
    await recordJevScoring((await getOpportunity(ACME))!, jev(), scope('wrun_D', 'turn_1'));
    // A concurrent reset (Reset button, a live test run) purges the session's rows before the root checks.
    await resetCrmDatabase('scenario_acme_netlify');
    const error = await check('turn_1', 'Composite 58', delegatedAt).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/opp_acme_corp_001 was reset at .* during this Assessment Session/);
    expect((error as Error).message).not.toMatch(/did not persist/);
  });

  it('does not blame a reset that happened before the delegation started', async () => {
    // beforeEach reset the deal; the delegation starts afterwards and its tool persists nothing.
    const error = await check('turn_1', 'run_jev_scoring failed: 402', await delegationStartedAt()).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/did not persist a run_jev_scoring result.*402/);
  });

  it('score_deal returns the persisted System 1 result and the updated Opportunity as typed data', async () => {
    await recordJevScoring((await getOpportunity(ACME))!, jev({ overallScore: 57 }), scope('wrun_D', 'turn_1'));
    const delegated = await check('turn_1');
    const result = scoreDealResult(delegated);
    expect(result.interactionId).toBe(delegated.interaction.id);
    expect(result.jevResult.overallScore).toBe(57);
    expect(result.opportunity).toMatchObject({ id: ACME, meddpicc_score: 57 });
  });

  it('analyze_deal returns the persisted System 2 result (form, modelUsed) and the Opportunity with evidence', async () => {
    const opp = (await getOpportunity(ACME))!;
    await recordJevScoring(opp, jev(), scope('wrun_D', 'turn_1'));
    await recordSystem2Analysis(opp, jev(), system2({ modelUsed: 'openai/gpt-5.5' }), scope('wrun_D', 'turn_1'));
    const result = analyzeDealResult(await checkAnalysis(), 'openai/gpt-5.5');
    expect(result.system2Result.modelUsed).toBe('openai/gpt-5.5');
    expect(result.system2Result.phase3Form.sections.length).toBeGreaterThan(0);
    expect(result.opportunity.id).toBe(ACME);
  });

  it('analyze_deal fails loudly when System 2 ran with a model other than the one requested', async () => {
    const opp = (await getOpportunity(ACME))!;
    await recordJevScoring(opp, jev(), scope('wrun_D', 'turn_1'));
    await recordSystem2Analysis(opp, jev(), system2({ modelUsed: 'anthropic/claude-sonnet-5' }), scope('wrun_D', 'turn_1'));
    const delegated = await checkAnalysis();
    expect(() => analyzeDealResult(delegated, 'openai/gpt-5.5')).toThrow(
      /System 2 ran with anthropic\/claude-sonnet-5, not the requested model openai\/gpt-5.5/
    );
  });
});
