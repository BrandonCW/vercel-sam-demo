import { describe, it, expect } from 'vitest';
import runAssessmentTool from '@/agent/tools/run_assessment';
import { getOpportunity, resetCrmDatabase } from '@/lib/db/crm';
import { rootCtx } from './fixtures/eve-session';

// Billed: one real typesafe-ai/jev call and one System 2 model call through AI Gateway,
// against the Postgres test branch. Opt in with JEV_LIVE=1.
const live = process.env.JEV_LIVE === '1' && !!process.env.AI_GATEWAY_API_KEY;
const ACME = 'opp_acme_corp_001';
const ctx = rootCtx(`wrun_live_tools_${Date.now()}`, 'turn_1');

describe.skipIf(!live)('run_assessment - live Acme assessment through writeback (no SA pause)', () => {
  it('scores with Jev, cites with System 2, and writes back a code-decided next step', async () => {
    const baseline = await resetCrmDatabase('scenario_acme_netlify');

    const yields: any[] = [];
    const body = (runAssessmentTool.execute as any)({ opportunityId: ACME, writebackWithoutFeedback: true }, ctx);
    let step = await body.next();
    for (; !step.done; step = await body.next()) yields.push(step.value);
    const result = step.value;

    const { jevResult } = yields.find((y) => y.stage === 'jev_saved');
    expect(jevResult.stageGate.gateReady).toBe(false);
    expect(jevResult.stageGate.blockingDimensions).toContain('economicBuyer');

    const { system2Result } = yields.find((y) => y.stage === 'system2_saved');
    console.log('SYSTEM2_FINDINGS', JSON.stringify({
      findings: system2Result.dimensionFindings,
      fatalBlocker: system2Result.fatalBlocker,
      valueFocus: system2Result.valueFocus,
      primaryRisk: system2Result.primaryRisk,
    }));
    expect(system2Result.fatalBlocker).toBeNull();
    const notes = `${baseline.ae_notes}\n${baseline.sa_notes}`;
    const citations: string[] = Object.values(system2Result.dimensionFindings).flatMap((f: any) => f.citations);
    expect(citations.length).toBeGreaterThan(0);
    expect(system2Result.dimensionFindings.economicBuyer.gaps.length).toBeGreaterThan(0);
    const verbatim = citations.filter((c) => notes.includes(c.trim()));
    console.log('CITATIONS_VERBATIM', `${verbatim.length}/${citations.length}`);

    expect(result.opportunity.qualification_status).toBe('in_review');
    expect(result.writeback.suggestedNextSteps).toMatch(
      /^\[IN REVIEW\] Hold at Stage 2 - Discovery\. [^|]+ \| Owner: AE \| Focus: [^|]+ \| Watch: Netlify \(high threat\)$/
    );

    const after = (await getOpportunity(ACME))!;
    expect(after.ae_notes).toBe(baseline.ae_notes);
    expect(after.meddpicc_breakdown.economicBuyer?.gaps?.length).toBeGreaterThan(0);
  }, 240_000);
});
