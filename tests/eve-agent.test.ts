import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crmReadDealTool from '@/agent/tools/crm_read_deal';
import crmUpdateNextStepsTool from '@/agent/tools/crm_update_next_steps';
import resetCrmDataTool from '@/agent/tools/reset_crm_data';
import runJevScoringTool from '@/agent/subagents/qualification_assessor/tools/run_jev_scoring';
import assessorReadDealTool from '@/agent/subagents/qualification_assessor/tools/crm_read_deal';
import runSystem2AnalysisTool from '@/agent/subagents/playbook_generator/tools/run_system2_analysis';
import {
  getOpportunity,
  resetCrmDatabase,
  writebackOpportunityQualification,
} from '@/lib/db/crm';
import { recordJevScoring, recordSystem2Analysis } from '@/lib/db/assessments';
import { jev, system2 } from './fixtures/qualification';

const ACME = 'opp_acme_corp_001';
const ctx = {} as any;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe('eve agent tools', () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
  });

  it('every model call lives in agent/: nothing in lib/, app/ or components/ calls a model', () => {
    const modelCall = /from ['"]eve\/ai['"]|\b(generateText|generateObject|streamText|streamObject|gateway)\s*\(/;
    const offenders = ['lib', 'app', 'components']
      .flatMap(walk)
      .filter((f) => /\.(ts|tsx)$/.test(f) && modelCall.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no tool under agent/ uses z.any()', () => {
    const offenders = walk('agent').filter((f) => f.endsWith('.ts') && /z\.any\(/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('crm_read_deal reads the opportunity, and the assessor subagent exposes the same tool', async () => {
    const result = (await crmReadDealTool.execute({ opportunityId: ACME }, ctx)) as any;
    expect(result.opportunity.name).toBe('Acme Corp - Next.js Migration');
    expect(assessorReadDealTool).toBe(crmReadDealTool);
  });

  it('scoring and analysis tools take only an opportunityId (plus model choice), never retyped deal data', () => {
    expect(Object.keys((runJevScoringTool.inputSchema as any).shape)).toEqual(['opportunityId']);
    expect(Object.keys((runSystem2AnalysisTool.inputSchema as any).shape)).toEqual(['opportunityId', 'model']);
    expect(Object.keys((crmUpdateNextStepsTool.inputSchema as any).shape)).toEqual(['opportunityId']);
  });

  it('run_system2_analysis accepts current Gateway model IDs only', () => {
    const schema = runSystem2AnalysisTool.inputSchema as any;
    expect(schema.safeParse({ opportunityId: ACME, model: 'anthropic/claude-sonnet-5' }).success).toBe(true);
    expect(schema.safeParse({ opportunityId: ACME, model: 'claude-3-5-sonnet' }).success).toBe(false);
  });

  it('run_system2_analysis refuses to run before System 1 has scored the deal', async () => {
    await expect(
      Promise.resolve(runSystem2AnalysisTool.execute({ opportunityId: ACME }, ctx))
    ).rejects.toThrow(/run_jev_scoring/);
  });

  describe('without AI_GATEWAY_API_KEY', () => {
    let saved: string | undefined;
    beforeEach(() => {
      saved = process.env.AI_GATEWAY_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;
    });
    afterEach(() => {
      if (saved !== undefined) process.env.AI_GATEWAY_API_KEY = saved;
    });

    it('run_jev_scoring fails the tool action instead of returning a fallback score', async () => {
      await expect(
        Promise.resolve(runJevScoringTool.execute({ opportunityId: ACME }, ctx))
      ).rejects.toThrow(/AI_GATEWAY_API_KEY/);
    });

    it('run_system2_analysis fails the tool action instead of returning canned output', async () => {
      const opp = (await getOpportunity(ACME))!;
      await recordJevScoring(opp, jev());
      await expect(
        Promise.resolve(runSystem2AnalysisTool.execute({ opportunityId: ACME }, ctx))
      ).rejects.toThrow(/AI_GATEWAY_API_KEY/);
    });
  });

  it('crm_update_next_steps decides status and next steps in code from the latest System 1 and System 2 results', async () => {
    const opp = (await getOpportunity(ACME))!;
    await recordJevScoring(opp, jev());
    await recordSystem2Analysis(opp, jev(), system2());

    const result = (await crmUpdateNextStepsTool.execute({ opportunityId: ACME }, ctx)) as any;

    expect(result.opportunity.qualification_status).toBe('in_review');
    expect(result.opportunity.suggested_next_steps).toMatch(
      /^\[IN REVIEW\] Hold at Stage 2 - Discovery\. .* \| Owner: AE \| Focus: Turborepo Remote Caching & ISR \| Watch: Netlify \(high threat\)$/
    );
    const refreshed = (await getOpportunity(ACME))!;
    expect(refreshed.meddpicc_score).toBe(54);
    expect(refreshed.meddpicc_breakdown.economicBuyer).toMatchObject({
      evidence: ['VP of E-Commerce mentioned budget'],
      gaps: ['No confirmed sign-off authority'],
    });
    expect(refreshed.ae_notes).toBe(opp.ae_notes);
  });

  it('crm_update_next_steps fails loudly when no assessment has run', async () => {
    await expect(
      Promise.resolve(crmUpdateNextStepsTool.execute({ opportunityId: ACME }, ctx))
    ).rejects.toThrow(/run_jev_scoring/);
  });

  it('writeback rejects the write when ae_notes changed since the record was read', async () => {
    const opp = (await getOpportunity(ACME))!;
    await expect(
      writebackOpportunityQualification(ACME, {
        expectedAeNotes: `${opp.ae_notes} (stale copy)`,
        sa_notes: 'overwritten',
        suggested_next_steps: '[IN REVIEW] x | Owner: AE | Focus: y | Watch: z',
        qualification_status: 'in_review',
        meddpicc_score: 1,
        meddpicc_breakdown: {},
      })
    ).rejects.toThrow(/ae_notes/);
    const after = (await getOpportunity(ACME))!;
    expect(after.sa_notes).toBe(opp.sa_notes);
    expect(after.suggested_next_steps).toBeNull();
  });

  it('reset_crm_data restores baseline state', async () => {
    const result = (await resetCrmDataTool.execute({ scenarioId: 'scenario_acme_netlify' }, ctx)) as any;
    expect(result.opportunity.id).toBe(ACME);
    expect(result.opportunity.qualification_status).toBe('unqualified');
    expect(result.opportunity.suggested_next_steps).toBeNull();
  });
});
