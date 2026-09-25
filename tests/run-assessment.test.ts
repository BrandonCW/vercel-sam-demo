import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOpportunity, getSessionInteractions, resetCrmDatabase } from '@/lib/db/crm';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';
import { rootCtx } from './fixtures/eve-session';
import { AssessmentResultSchema } from '@/lib/assessment-progress';
import type { System2ModelOutput } from '@/lib/agents/system2';

// Transport-level stand-ins for the Gateway calls; everything else (Postgres test branch) is real.
// Outside eve's compiler the "use workflow" body is a plain async generator and each
// "use step" helper a plain function, so the test drives the body the way eve does.
const gatewayCalls = vi.hoisted(() => ({ evaluate: vi.fn(), generateText: vi.fn() }));
vi.mock('eve/ai', () => ({ evaluate: gatewayCalls.evaluate }));
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: gatewayCalls.generateText,
}));

const { default: runAssessmentTool } = await import('@/agent/tools/run_assessment');

const ACME = 'opp_acme_corp_001';
const score = (s: number) => ({ type: 'score', score: s });
const choice = (c: string) => ({ type: 'choice', choice: c });
/** Jev answers: composite 56 (Netlify high, Gate 2 blocked on Economic Buyer), then 89 after SA feedback. */
function jevAnswers(eb: number, pp: number) {
  return {
    answers: {
      identifyPain: score(7.47),
      champion: score(5.94),
      economicBuyer: score(eb),
      decisionCriteria: score(6.3),
      decisionProcess: score(3.6),
      metrics: score(4.68),
      competition: score(3.6),
      paperProcess: score(pp),
      competitor_netlify: choice('high'),
      competitor_awsAmplify: choice('absent'),
      competitor_cloudflarePages: choice('absent'),
      competitor_akamaiFastly: choice('absent'),
      competitor_diyKubernetes: choice('absent'),
    },
    providerMetadata: { typesafe: { confidence: 0.8 } },
  };
}
const DIMENSIONS = ['metrics', 'economicBuyer', 'decisionCriteria', 'decisionProcess', 'paperProcess', 'identifyPain', 'champion', 'competition'];
const modelOutput: System2ModelOutput = {
  dimensionFindings: Object.fromEntries(
    DIMENSIONS.map((k) => [k, k === 'economicBuyer' ? { citations: ['VP mentioned budget'], gaps: ['No sign-off authority'] } : { citations: [], gaps: [] }])
  ) as System2ModelOutput['dimensionFindings'],
  phase3Form: {
    title: 'Discovery',
    summary: 'Confirm the economic buyer.',
    sections: [
      {
        id: 'blockers',
        title: 'Stage Gate Blockers',
        description: null,
        calloutType: null,
        calloutText: null,
        fields: [
          { id: 'eb', name: 'eb', label: 'Who signs?', description: null, type: 'text', placeholder: null, required: true, options: [], dimensionTarget: 'economicBuyer', helpCallout: null },
        ],
      },
    ],
  },
  fatalBlocker: null,
  phase1Gaps: [],
  phase2Competitive: [],
  valueFocus: 'Build speed',
  primaryRisk: 'Budget',
  nextMilestone: 'Meet the CFO.',
  summary: 'Blocked on the economic buyer.',
};

/** An SA answer, as the workbench sends it through `respond([{ requestId, text }])`. */
async function answerText(formResponses: Record<string, string>, notesDelta?: string) {
  return JSON.stringify({ formResponses, notesDelta, feedbackKey: await saFeedbackKey(formResponses, notesDelta) });
}

/**
 * Drives the workflow body like eve: every yield is an `action.partial`, `ctx.ask` is the durable
 * pause (answered by `answer`), and the return value is the action result. `onYield` runs before
 * the body resumes.
 */
async function drive(
  input: Record<string, unknown>,
  answer: (request: unknown) => Promise<{ text?: string }>,
  onYield: (value: any) => Promise<void> = async () => {}
) {
  const asks: any[] = [];
  const ctx = {
    ...rootCtx('wrun_A', 'turn_0'),
    abortSignal: new AbortController().signal,
    ask: vi.fn(async (request: unknown) => {
      asks.push(request);
      return answer(request);
    }),
  };
  const iterator = (runAssessmentTool.execute as any)(input, ctx)[Symbol.asyncIterator]();
  const partials: any[] = [];
  for (let step = await iterator.next(); ; step = await iterator.next()) {
    if (step.done) return { partials, result: step.value, asks };
    partials.push(step.value);
    await onYield(step.value);
  }
}

const actions = async () => (await getSessionInteractions(ACME, 'wrun_A')).map((i) => i.action).reverse();

describe('run_assessment: one workflow tool sequences the Assessment Session in code', { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
    gatewayCalls.evaluate.mockReset();
    gatewayCalls.generateText.mockReset();
  });

  it('scores, analyzes, pauses for the SA, then re-scores and writes back once', async () => {
    gatewayCalls.evaluate.mockResolvedValueOnce(jevAnswers(2.61, 1.44)).mockResolvedValueOnce(jevAnswers(9.5, 9));
    gatewayCalls.generateText.mockResolvedValue({ output: modelOutput });
    const before = (await getOpportunity(ACME))!;
    const rowsAtYield: string[][] = [];

    const { partials, result, asks } = await drive(
      { opportunityId: ACME, model: 'anthropic/claude-sonnet-5' },
      async () => ({ text: await answerText({ eb: 'CFO Mark Ellis signs; $180k approved.' }, 'Paper process mapped.') }),
      async () => {
        rowsAtYield.push(await actions());
      }
    );

    expect(partials.map((p) => p.stage)).toEqual([
      'jev_scored',
      'jev_saved',
      'system2_saved',
      'feedback_recorded',
      'jev_scored',
      'jev_saved',
    ]);
    // The Jev scores reach the workbench before the CRM write, in both rounds.
    expect(partials[0]).toMatchObject({ round: 'baseline', jevResult: { overallScore: 56 } });
    expect(rowsAtYield[0]).toEqual([]);
    expect(partials[1].opportunity.meddpicc_score).toBe(56);
    expect(rowsAtYield[1]).toEqual(['initial_scoring']);
    // The validated System 2 result, with its discovery form, before the pause.
    expect(partials[2].system2Result.modelUsed).toBe('anthropic/claude-sonnet-5');
    expect(partials[2].system2Result.phase3Form.sections[0].fields[0].id).toBe('eb');
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ display: 'text', allowFreeform: true });
    expect(partials[4]).toMatchObject({ round: 'rescore' });
    expect(partials[5].jevResult.overallScore).toBeGreaterThan(56);

    // Pass or fail and the next steps are decided in code; the session closes with one writeback.
    const finalScore = partials[5].jevResult.overallScore;
    const [writebackRow] = (await getSessionInteractions(ACME, 'wrun_A')).filter((i) => i.action === 'writeback');
    expect(AssessmentResultSchema.parse(result)).toMatchObject({
      status: 'written_back',
      opportunityId: ACME,
      qualificationStatus: 'qualified',
      baselineScore: 56,
      finalScore,
      delta: finalScore - 56,
      writebackId: writebackRow.id,
      feedback: 'recorded',
    });
    expect(result.nextSteps).toMatch(/^\[QUALIFIED\] /);
    expect(result.opportunity.qualification_status).toBe('qualified');
    expect(await actions()).toEqual(['initial_scoring', 'questions_generated', 'sa_feedback', 'initial_scoring', 'writeback']);
    const after = (await getOpportunity(ACME))!;
    expect(after.ae_notes).toBe(before.ae_notes);
    expect(after.sa_notes).toContain('CFO Mark Ellis signs');
  });

  it('writes back right after System 2 without pausing when asked to skip SA feedback', async () => {
    gatewayCalls.evaluate.mockResolvedValue(jevAnswers(2.61, 1.44));
    gatewayCalls.generateText.mockResolvedValue({ output: modelOutput });
    const { result, asks } = await drive({ opportunityId: ACME, writebackWithoutFeedback: true }, async () => ({}));
    expect(asks).toEqual([]);
    expect(result).toMatchObject({ status: 'written_back', qualificationStatus: 'in_review', delta: 0, feedback: 'skipped' });
    expect(result.nextSteps).toMatch(/^\[IN REVIEW\] /);
    expect(await actions()).toEqual(['initial_scoring', 'questions_generated', 'writeback']);
  });

  it('fails loudly when Jev fails: nothing is written and nothing is asked', async () => {
    gatewayCalls.evaluate.mockRejectedValue(new Error('Jev 503 Service temporarily unavailable'));
    await expect(drive({ opportunityId: ACME }, async () => ({}))).rejects.toThrow(/Jev 503/);
    expect(gatewayCalls.generateText).not.toHaveBeenCalled();
    expect(await actions()).toEqual([]);
  });

  it('fails loudly when System 2 output does not match the schema: no checkpoint, no pause', async () => {
    gatewayCalls.evaluate.mockResolvedValue(jevAnswers(2.61, 1.44));
    gatewayCalls.generateText.mockRejectedValue(new Error('No object generated: response did not match schema.'));
    const answer = vi.fn(async () => ({}));
    await expect(drive({ opportunityId: ACME }, answer)).rejects.toThrow(/did not match schema/);
    expect(answer).not.toHaveBeenCalled();
    expect(await actions()).toEqual(['initial_scoring']);
  });

  it.each([
    ['an empty answer', undefined, /empty/],
    ['text that is not JSON', 'CFO signs', /not JSON/],
    ['JSON without a feedbackKey', JSON.stringify({ formResponses: { eb: 'CFO' } }), /feedbackKey/],
    ['answers that do not match their feedbackKey', JSON.stringify({ formResponses: { eb: 'CFO' }, feedbackKey: 'f00' }), /does not match its feedbackKey/],
  ])('fails loudly on %s and records no feedback and no writeback', async (_name, text, error) => {
    gatewayCalls.evaluate.mockResolvedValue(jevAnswers(2.61, 1.44));
    gatewayCalls.generateText.mockResolvedValue({ output: modelOutput });
    const before = (await getOpportunity(ACME))!;
    await expect(drive({ opportunityId: ACME }, async () => ({ text }))).rejects.toThrow(error);
    expect(await actions()).toEqual(['initial_scoring', 'questions_generated']);
    expect((await getOpportunity(ACME))!.sa_notes).toBe(before.sa_notes);
  });
});
