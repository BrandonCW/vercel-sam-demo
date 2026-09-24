import { describe, it, expect } from 'vitest';
import runJevScoringTool from '@/agent/subagents/qualification_assessor/tools/run_jev_scoring';
import runSystem2AnalysisTool from '@/agent/subagents/playbook_generator/tools/run_system2_analysis';
import crmUpdateNextStepsTool from '@/agent/tools/crm_update_next_steps';
import { getOpportunity, resetCrmDatabase } from '@/lib/db/crm';

// Billed: one real typesafe-ai/jev call and one System 2 model call through AI Gateway,
// against the Postgres test branch. Opt in with JEV_LIVE=1.
const live = process.env.JEV_LIVE === '1' && !!process.env.AI_GATEWAY_API_KEY;
const ACME = 'opp_acme_corp_001';
const ctx = {} as any;

describe.skipIf(!live)('eve tools - live Acme assessment through writeback', () => {
  it('scores with Jev, cites with System 2, and writes back a code-decided next step', async () => {
    const baseline = await resetCrmDatabase('scenario_acme_netlify');

    const { jevResult } = (await runJevScoringTool.execute({ opportunityId: ACME }, ctx)) as any;
    expect(jevResult.stageGate.gateReady).toBe(false);
    expect(jevResult.stageGate.blockingDimensions).toContain('economicBuyer');

    const { system2Result } = (await runSystem2AnalysisTool.execute({ opportunityId: ACME }, ctx)) as any;
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

    const result = (await crmUpdateNextStepsTool.execute({ opportunityId: ACME }, ctx)) as any;
    expect(result.opportunity.qualification_status).toBe('in_review');
    expect(result.suggestedNextSteps).toMatch(
      /^\[IN REVIEW\] Hold at Stage 2 - Discovery\. [^|]+ \| Owner: AE \| Focus: [^|]+ \| Watch: Netlify \(high threat\)$/
    );

    const after = (await getOpportunity(ACME))!;
    expect(after.ae_notes).toBe(baseline.ae_notes);
    expect(after.meddpicc_breakdown.economicBuyer?.gaps?.length).toBeGreaterThan(0);
  }, 240_000);
});
