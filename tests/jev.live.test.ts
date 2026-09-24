import { describe, it, expect } from 'vitest';
import { evaluate } from 'eve/ai';
import { buildJevEvaluationRequest, interpretJevEvaluation } from '@/lib/agents/jev-scorer';
import { SCENARIO_FIXTURES } from '@/lib/db/fixtures';

// Billed: runs one real typesafe-ai/jev call. Opt in with JEV_LIVE=1 (needs AI_GATEWAY_API_KEY).
const live = process.env.JEV_LIVE === '1' && !!process.env.AI_GATEWAY_API_KEY;

describe.skipIf(!live)('System 1 (Jev) - live Acme baseline', () => {
  it('scores the Acme Netlify scenario within the spec baseline', async () => {
    const opp = SCENARIO_FIXTURES.scenario_acme_netlify.default_data;
    const input = {
      opportunityId: opp.id,
      name: opp.name,
      stageName: opp.stage_name,
      amount: opp.amount,
      aeNotes: opp.ae_notes,
      saNotes: opp.sa_notes,
    };
    const evaluation = await evaluate(buildJevEvaluationRequest(input));
    console.log('JEV_RAW', JSON.stringify({ answers: evaluation.answers, providerMetadata: evaluation.providerMetadata, usage: evaluation.usage }));
    const r = interpretJevEvaluation(input, evaluation);
    console.log('JEV_RESULT', JSON.stringify({ overall: r.overallScore, dims: Object.fromEntries(Object.entries(r.dimensions).map(([k, d]) => [k, [d.score, d.confidence]])), flags: r.competitiveFlags, gate: r.stageGate }));
    expect(r.overallScore).toBeGreaterThanOrEqual(50);
    expect(r.overallScore).toBeLessThanOrEqual(58);
    expect(r.dimensions.identifyPain.score).toBeGreaterThanOrEqual(8);
    expect(r.competitiveFlags).toContainEqual({ name: 'Netlify', threatLevel: 'high' });
    expect(r.stageGate.gateReady).toBe(false);
    expect(r.stageGate.gateBlockers.some((b) => b.includes('Economic Buyer'))).toBe(true);
  }, 60000);
});
