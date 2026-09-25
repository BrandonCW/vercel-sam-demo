import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import { getInteractions, getOpportunity, getSessionInteractions, resetCrmDatabase } from '@/lib/db/crm';
import { recordJevScoring } from '@/lib/db/assessments';
import { rootCtx, runTool, scope } from './fixtures/eve-session';
import { jev } from './fixtures/qualification';
import type { System2ModelOutput } from '@/lib/agents/system2';

// Transport-level stand-ins for the two Gateway calls; everything else (Postgres test branch) is real.
const gatewayCalls = vi.hoisted(() => ({ evaluate: vi.fn(), streamText: vi.fn() }));
vi.mock('eve/ai', () => ({ evaluate: gatewayCalls.evaluate }));
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  streamText: gatewayCalls.streamText,
}));

const { default: runJevScoringTool } = await import('@/agent/tools/run_jev_scoring');
const { default: runSystem2AnalysisTool } = await import('@/agent/tools/run_system2_analysis');

const ACME = 'opp_acme_corp_001';
const score = (s: number) => ({ type: 'score', score: s });
const choice = (c: string) => ({ type: 'choice', choice: c });
/** Jev answers that map to composite 56, Netlify high, Gate 2 blocked on Economic Buyer. */
const acmeEvaluation = {
  answers: {
    identifyPain: score(7.47),
    champion: score(5.94),
    economicBuyer: score(2.61),
    decisionCriteria: score(6.3),
    decisionProcess: score(3.6),
    metrics: score(4.68),
    competition: score(3.6),
    paperProcess: score(1.44),
    competitor_netlify: choice('high'),
    competitor_awsAmplify: choice('absent'),
    competitor_cloudflarePages: choice('absent'),
    competitor_akamaiFastly: choice('absent'),
    competitor_diyKubernetes: choice('absent'),
  },
  providerMetadata: { typesafe: { confidence: 0.8 } },
};

describe('root agent tools: System 1 and System 2 run directly on the root (no subagents)', { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
    gatewayCalls.evaluate.mockReset();
    gatewayCalls.streamText.mockReset();
  });

  it('the root agent owns run_jev_scoring and run_system2_analysis; the subagents and wrappers are gone', () => {
    expect(fs.existsSync('agent/tools/run_jev_scoring.ts')).toBe(true);
    expect(fs.existsSync('agent/tools/run_system2_analysis.ts')).toBe(true);
    expect(fs.existsSync('agent/tools/score_deal.ts')).toBe(false);
    expect(fs.existsSync('agent/tools/analyze_deal.ts')).toBe(false);
    expect(fs.existsSync('agent/subagents')).toBe(false);
  });

  describe('run_jev_scoring', () => {
    it('shows the Jev scores before the CRM writes, then returns the persisted result and updated Opportunity', async () => {
      gatewayCalls.evaluate.mockResolvedValue(acmeEvaluation);
      const ctx = rootCtx('wrun_J', 'turn_0');
      const rowsAtEachYield: number[] = [];

      const { partials, result } = await runTool(runJevScoringTool, { opportunityId: ACME }, ctx, async () => {
        rowsAtEachYield.push((await getSessionInteractions(ACME, 'wrun_J')).length);
      });

      // The preliminary snapshot carries the scores while nothing is written yet.
      expect(partials).toHaveLength(1);
      expect(partials[0].jevResult.overallScore).toBe(56);
      expect(rowsAtEachYield[0]).toBe(0);
      // The final result is the persisted row and the Opportunity after the write.
      expect(rowsAtEachYield[1]).toBe(1);
      expect(result.jevResult.overallScore).toBe(56);
      expect(result.opportunity.meddpicc_score).toBe(56);
      expect(result.opportunity.qualification_status).toBe('in_review');
      const [row] = await getSessionInteractions(ACME, 'wrun_J');
      expect(result.interactionId).toBe(row.id);
      expect(row.payload.turnId).toBe('turn_0');
    });

    it('fails the action when Jev fails, and writes nothing', async () => {
      gatewayCalls.evaluate.mockRejectedValue(new Error('Jev 402 payment required'));
      await expect(runTool(runJevScoringTool, { opportunityId: ACME }, rootCtx('wrun_J', 'turn_0'))).rejects.toThrow(
        /Jev 402/
      );
      expect(await getSessionInteractions(ACME, 'wrun_J')).toEqual([]);
    });
  });

  describe('run_system2_analysis', () => {
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
    /** A streamed structured-output call: partial objects as they grow, then the validated object. */
    function streamed(partials: unknown[], final: Promise<unknown>) {
      final.catch(() => {});
      return {
        partialOutputStream: (async function* () {
          for (const p of partials) yield p;
        })(),
        output: final,
      };
    }

    async function scoredIn(sessionId: string) {
      await recordJevScoring((await getOpportunity(ACME))!, jev(), scope(sessionId, 'turn_0'));
    }

    it('streams citations and form sections as drafts before the CRM write, then returns the persisted result', async () => {
      await scoredIn('wrun_S');
      gatewayCalls.streamText.mockReturnValue(
        streamed(
          [
            { dimensionFindings: { metrics: { citations: [] }, economicBuyer: { citations: ['VP mentioned budget'] } } },
            { dimensionFindings: modelOutput.dimensionFindings, phase3Form: modelOutput.phase3Form },
          ],
          Promise.resolve(modelOutput)
        )
      );
      const rowsAtEachYield: string[][] = [];
      const { partials, result } = await runTool(
        runSystem2AnalysisTool,
        { opportunityId: ACME, model: 'anthropic/claude-sonnet-5' },
        rootCtx('wrun_S', 'turn_0'),
        async () => {
          rowsAtEachYield.push((await getSessionInteractions(ACME, 'wrun_S')).map((i) => i.action));
        }
      );

      expect(gatewayCalls.streamText).toHaveBeenCalledOnce();
      expect(partials.length).toBeGreaterThanOrEqual(1);
      const draft = partials[partials.length - 1].draft;
      expect(draft.dimensionFindings.economicBuyer.citations).toEqual(['VP mentioned budget']);
      expect(draft.form.sections[0].fields[0]).toMatchObject({ id: 'eb', label: 'Who signs?', type: 'text' });
      // Drafts arrive while only System 1's row exists; the checkpoint lands with the final result.
      expect(rowsAtEachYield.slice(0, -1).every((rows) => !rows.includes('questions_generated'))).toBe(true);
      expect(rowsAtEachYield[rowsAtEachYield.length - 1]).toContain('questions_generated');

      expect(result.system2Result.modelUsed).toBe('anthropic/claude-sonnet-5');
      expect(result.system2Result.phase3Form.opportunityId).toBe(ACME);
      expect(result.opportunity.meddpicc_breakdown.economicBuyer.evidence).toEqual(['VP mentioned budget']);
      const checkpoint = (await getSessionInteractions(ACME, 'wrun_S')).find((i) => i.action === 'questions_generated')!;
      expect(result.interactionId).toBe(checkpoint.id);
    });

    it('sends a draft only when what the workbench shows changed (not while System 2 writes gaps and playbook)', async () => {
      await scoredIn('wrun_S');
      const shown = { dimensionFindings: modelOutput.dimensionFindings, phase3Form: modelOutput.phase3Form };
      gatewayCalls.streamText.mockReturnValue(
        streamed(
          [shown, { ...shown, fatalBlocker: null }, { ...shown, fatalBlocker: null, phase1Gaps: [] }],
          Promise.resolve(modelOutput)
        )
      );
      const { partials } = await runTool(runSystem2AnalysisTool, { opportunityId: ACME }, rootCtx('wrun_S', 'turn_0'));
      expect(partials).toHaveLength(1);
    });

    it('fails the action and persists nothing when the model output does not match the schema', async () => {
      await scoredIn('wrun_S');
      gatewayCalls.streamText.mockReturnValue(
        streamed([{ dimensionFindings: {} }], Promise.reject(new Error('No object generated: response did not match schema.')))
      );
      await expect(
        runTool(runSystem2AnalysisTool, { opportunityId: ACME }, rootCtx('wrun_S', 'turn_0'))
      ).rejects.toThrow(/did not match schema/);
      const actions = (await getSessionInteractions(ACME, 'wrun_S')).map((i) => i.action);
      expect(actions).not.toContain('questions_generated');
    });
  });
});
