import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOpportunity,
  resetCrmDatabase,
  writebackOpportunityQualification,
  recordInteraction,
  getInteractions,
} from '@/lib/db/crm';
import { MEDDPICCBreakdown } from '@/lib/types/crm';

describe('Atomic CRM Writeback & Telemetry (Ticket 04)', () => {
  beforeEach(async () => {
    await resetCrmDatabase('scenario_acme_netlify');
  });

  it('atomically updates only allowed fields and preserves ae_notes and core attributes intact', async () => {
    const oppBefore = await getOpportunity('opp_acme_corp_001');
    expect(oppBefore).not.toBeNull();

    const originalId = oppBefore!.id;
    const originalName = oppBefore!.name;
    const originalAccount = oppBefore!.account_name;
    const originalAmount = oppBefore!.amount;
    const originalCloseDate = oppBefore!.close_date;
    const originalAeName = oppBefore!.ae_name;
    const originalSaName = oppBefore!.sa_name;
    const originalAeNotes = oppBefore!.ae_notes;
    const originalCreatedAt = oppBefore!.created_at;

    const sampleBreakdown: MEDDPICCBreakdown = {
      identifyPain: { score: 8, status: 'verified', confidence: 0.9 },
      champion: { score: 7, status: 'partial', confidence: 0.8 },
      economicBuyer: { score: 8, status: 'verified', confidence: 0.8 },
      decisionCriteria: { score: 7, status: 'partial', confidence: 0.8 },
      decisionProcess: { score: 5, status: 'partial', confidence: 0.7 },
      metrics: { score: 6, status: 'partial', confidence: 0.7 },
      competition: { score: 6, status: 'partial', confidence: 0.8 },
      paperProcess: { score: 3, status: 'unaddressed', confidence: 0.5 },
      stageGate: {
        gateReady: true,
        currentStage: 'Stage 2 - Discovery',
        targetStage: 'Stage 3 - Technical Validation',
        gateBlockers: [],
      },
    };

    const { opportunity: writebackResult, writebackId } = await writebackOpportunityQualification('opp_acme_corp_001', {
      expectedAeNotes: oppBefore!.ae_notes,
      suggested_next_steps:
        '[QUALIFIED] Advance to Stage 3 (Technical Validation). Schedule architecture review with VP of E-Commerce. | Owner: SA (Lead) + AE | Focus: Turborepo Remote Caching | Watch: Netlify 30% discount renewal offer.',
      qualification_status: 'qualified',
      meddpicc_score: 72,
      meddpicc_breakdown: sampleBreakdown,
      sessionId: 'wrun_wb',
      audit: { actor: 'system1_jev', payload: { sessionState: 'closed' } },
    });

    // 1. Designated writeback fields MUST be updated
    expect(writebackResult.qualification_status).toBe('qualified');
    expect(writebackResult.meddpicc_score).toBe(72);
    expect(writebackResult.suggested_next_steps).toContain('[QUALIFIED]');
    // sa_notes is appended only by record_sa_feedback; writeback never rewrites it.
    expect(writebackResult.sa_notes).toBe(oppBefore!.sa_notes);
    // Exactly one writeback audit row, written in the same statement.
    const audits = (await getInteractions('opp_acme_corp_001')).filter((i) => i.action === 'writeback');
    expect(audits).toHaveLength(1);
    expect(audits[0].payload).toMatchObject({ assessmentSessionId: 'wrun_wb', sessionState: 'closed' });
    // The same statement returns the audit row's id, so the tool can report it.
    expect(writebackId).toBe(audits[0].id);
    expect(writebackResult.meddpicc_breakdown.economicBuyer?.score).toBe(8);
    expect(writebackResult.stage_gate?.gateReady).toBe(true);

    // 2. All other fields MUST be strictly preserved and untouched
    expect(writebackResult.id).toBe(originalId);
    expect(writebackResult.name).toBe(originalName);
    expect(writebackResult.account_name).toBe(originalAccount);
    expect(writebackResult.amount).toBe(originalAmount);
    expect(writebackResult.close_date).toBe(originalCloseDate);
    expect(writebackResult.ae_name).toBe(originalAeName);
    expect(writebackResult.sa_name).toBe(originalSaName);
    expect(writebackResult.ae_notes).toBe(originalAeNotes);
    expect(writebackResult.created_at).toBe(originalCreatedAt);

    // 3. Updated at timestamp must be updated
    expect(new Date(writebackResult.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(oppBefore!.updated_at).getTime()
    );

    // 4. Persistence verification
    const fetched = await getOpportunity('opp_acme_corp_001');
    expect(fetched?.qualification_status).toBe('qualified');
    expect(fetched?.meddpicc_score).toBe(72);
    expect(fetched?.suggested_next_steps).toBe(writebackResult.suggested_next_steps);
    expect(fetched?.ae_notes).toBe(originalAeNotes);
  });

  it('records writeback audit telemetry interaction in deal_interactions table', async () => {
    const oppId = 'opp_acme_corp_001';
    const writebackText =
      '[QUALIFIED] Advance to Stage 3. | Owner: SA (Lead) + AE | Focus: ISR | Watch: Netlify';

    await recordInteraction({
      opportunity_id: oppId,
      actor: 'system1_jev',
      action: 'writeback',
      payload: {
        formResponses: { eb_auth: 'unilateral' },
        notesDelta: 'Verified in customer call',
        previousScore: 52,
        newScore: 68,
        deltaScore: 16,
        qualificationStatus: 'qualified',
        suggestedNextSteps: writebackText,
        sessionState: 'closed',
      },
    });

    const interactions = await getInteractions(oppId);
    const writebackEntry = interactions.find(
      (i) => i.actor === 'system1_jev' && i.action === 'writeback'
    );

    expect(writebackEntry).toBeDefined();
    expect(writebackEntry?.opportunity_id).toBe(oppId);
    expect(writebackEntry?.actor).toBe('system1_jev');
    expect(writebackEntry?.action).toBe('writeback');
    expect((writebackEntry?.payload as any).deltaScore).toBe(16);
    expect((writebackEntry?.payload as any).qualificationStatus).toBe('qualified');
    expect((writebackEntry?.payload as any).suggestedNextSteps).toBe(writebackText);
    expect((writebackEntry?.payload as any).sessionState).toBe('closed');
  });

  it('throws error when writing back to non-existent opportunity', async () => {
    await expect(
      writebackOpportunityQualification('opp_non_existent_id', {
        expectedAeNotes: '',
        suggested_next_steps: 'steps',
        qualification_status: 'qualified',
        meddpicc_score: 50,
        meddpicc_breakdown: {},
        sessionId: 'wrun_none',
        audit: { actor: 'system1_jev', payload: {} },
      })
    ).rejects.toThrow(/not found/i);
  });
});
