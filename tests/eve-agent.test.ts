import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crmReadDealTool from '@/agent/tools/crm_read_deal';
import resetCrmDataTool from '@/agent/tools/reset_crm_data';
import runAssessmentTool from '@/agent/tools/run_assessment';
import { analyzeWithSystem2, scoreWithJev, writeBack } from '@/agent/lib/assessment-steps';
import {
  getInteractions,
  getOpportunity,
  resetCrmDatabase,
  writebackOpportunityQualification,
} from '@/lib/db/crm';
import { recordJevScoring, recordSystem2Analysis } from '@/lib/db/assessments';
import { jev, system2 } from './fixtures/qualification';
import { rootCtx, scope } from './fixtures/eve-session';

const ACME = 'opp_acme_corp_001';
const ctx = rootCtx('wrun_test', 'turn_1');
const S = scope('wrun_test', 'turn_1');

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

  it('crm_read_deal reads the opportunity', async () => {
    const result = (await crmReadDealTool.execute({ opportunityId: ACME }, ctx)) as any;
    expect(result.opportunity.name).toBe('Acme Corp - Next.js Migration');
  });

  it('the Assessment Session is one run_assessment workflow tool; the per-step root tools are gone', () => {
    expect(fs.existsSync('agent/tools/run_assessment.ts')).toBe(true);
    for (const retired of ['run_jev_scoring', 'run_system2_analysis', 'record_sa_feedback', 'crm_update_next_steps', 'score_deal', 'analyze_deal']) {
      expect(fs.existsSync(`agent/tools/${retired}.ts`)).toBe(false);
    }
    expect(fs.existsSync('agent/subagents')).toBe(false);
    expect(fs.readFileSync('agent/tools/run_assessment.ts', 'utf8')).toMatch(/"use workflow"/);
  });

  it('run_assessment takes only an opportunityId, the System 2 model and the writeback mode, never retyped deal data', () => {
    expect(Object.keys((runAssessmentTool.inputSchema as any).shape)).toEqual(['opportunityId', 'model', 'writebackWithoutFeedback']);
  });

  it('run_assessment accepts current Gateway model IDs only', () => {
    const schema = runAssessmentTool.inputSchema as any;
    expect(schema.safeParse({ opportunityId: ACME, model: 'anthropic/claude-haiku-4.5' }).success).toBe(true);
    expect(schema.safeParse({ opportunityId: ACME, model: 'google/gemini-3.8-flash' }).success).toBe(true);
    expect(schema.safeParse({ opportunityId: ACME, model: 'claude-3-5-sonnet' }).success).toBe(false);
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

    it('the Jev step fails instead of returning a fallback score', async () => {
      await expect(scoreWithJev(ACME)).rejects.toThrow(/AI_GATEWAY_API_KEY/);
    });

    it('the System 2 step fails instead of returning canned output, and persists nothing', async () => {
      const opp = (await getOpportunity(ACME))!;
      await recordJevScoring(opp, jev(), S);
      await expect(analyzeWithSystem2(opp, jev(), 'google/gemini-3.8-flash', S)).rejects.toThrow(/AI_GATEWAY_API_KEY/);
      expect((await getInteractions(ACME)).some((i) => i.action === 'questions_generated')).toBe(false);
    });
  });

  it('the writeback decides status and next steps in code from the latest System 1 and System 2 results', async () => {
    const opp = (await getOpportunity(ACME))!;
    await recordJevScoring(opp, jev(), S);
    await recordSystem2Analysis(opp, jev(), system2(), S);

    const result = await writeBack(ACME, S);

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

  it('the writeback fails loudly when no assessment has run', async () => {
    await expect(writeBack(ACME, S)).rejects.toThrow(/No System 1 result/);
  });

  it('writeback rejects the write when ae_notes changed since the record was read', async () => {
    const opp = (await getOpportunity(ACME))!;
    await expect(
      writebackOpportunityQualification(ACME, {
        expectedAeNotes: `${opp.ae_notes} (stale copy)`,
        suggested_next_steps: '[IN REVIEW] x | Owner: AE | Focus: y | Watch: z',
        qualification_status: 'in_review',
        meddpicc_score: 1,
        meddpicc_breakdown: {},
        sessionId: 'wrun_stale',
        audit: { actor: 'system1_jev', payload: {} },
      })
    ).rejects.toThrow(/ae_notes/);
    const after = (await getOpportunity(ACME))!;
    expect(after.sa_notes).toBe(opp.sa_notes);
    expect(after.suggested_next_steps).toBeNull();
    expect((await getInteractions(ACME)).some((i) => i.action === 'writeback')).toBe(false);
  });

  it('reset_crm_data restores baseline state', async () => {
    const result = (await resetCrmDataTool.execute({ scenarioId: 'scenario_acme_netlify' }, ctx)) as any;
    expect(result.opportunity.id).toBe(ACME);
    expect(result.opportunity.qualification_status).toBe('unqualified');
    expect(result.opportunity.suggested_next_steps).toBeNull();
  });
});
