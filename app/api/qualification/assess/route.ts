import { NextRequest, NextResponse } from 'next/server';
import { getOpportunity, updateOpportunity, recordInteraction } from '@/lib/db/crm';
import { scoreOpportunityWithJev } from '@/lib/agents/jev-scorer';
import { runSystem2Analysis } from '@/lib/agents/system2-runner';
import { MEDDPICCBreakdown, System2ModelOption } from '@/lib/types/crm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { opportunityId, model: requestedModel } = body;
    const model = requestedModel || process.env.SYSTEM2_MODEL_ID || 'claude-3-5-sonnet';

    if (!opportunityId || typeof opportunityId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'opportunityId is required and must be a string' },
        { status: 400 }
      );
    }

    const opportunity = await getOpportunity(opportunityId);
    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: `Opportunity '${opportunityId}' not found` },
        { status: 404 }
      );
    }

    // 1. Run deterministic System 1 (Jev) baseline scoring
    const jevResult = scoreOpportunityWithJev({
      opportunityId: opportunity.id,
      name: opportunity.name,
      accountName: opportunity.account_name,
      stageName: opportunity.stage_name,
      amount: opportunity.amount,
      aeNotes: opportunity.ae_notes,
      saNotes: opportunity.sa_notes,
    });

    const breakdown: MEDDPICCBreakdown = {
      ...jevResult.dimensions,
      stageGate: jevResult.stageGate,
    };

    // Update Opportunity in CRM persistence
    const updatedOpportunity = await updateOpportunity(opportunity.id, {
      meddpicc_score: jevResult.overallScore,
      meddpicc_breakdown: breakdown,
      competitive_flags: jevResult.competitiveFlags.map((c) => c.name),
      stage_gate: jevResult.stageGate,
      qualification_status:
        opportunity.qualification_status === 'unqualified'
          ? 'in_review'
          : opportunity.qualification_status,
    });

    // Record System 1 telemetry event in deal_interactions
    await recordInteraction({
      opportunity_id: opportunity.id,
      actor: 'system1_jev',
      action: 'initial_scoring',
      payload: jevResult as unknown as Record<string, unknown>,
    });

    // 2. Run Phased System 2 Deep Reasoning
    const system2Result = await runSystem2Analysis(
      {
        opportunity: {
          id: updatedOpportunity.id,
          name: updatedOpportunity.name,
          stageName: updatedOpportunity.stage_name,
          amount: Number(updatedOpportunity.amount),
          aeNotes: updatedOpportunity.ae_notes,
          saNotes: updatedOpportunity.sa_notes,
        },
        jevResult,
        model: model as System2ModelOption,
      },
      { model: model as System2ModelOption }
    );

    // 3. Checkpoint active Assessment Session state and generated form in persistence
    await recordInteraction({
      opportunity_id: opportunity.id,
      actor: 'system2_llm',
      action: 'questions_generated',
      payload: {
        form: system2Result.phase3Form,
        model: system2Result.modelUsed,
        sessionState: 'pending_feedback',
        gapsIdentified: system2Result.phase1Gaps.length,
        competitiveAngles: system2Result.phase2Competitive.length,
        checkpointTimestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      opportunity: updatedOpportunity,
      jevResult,
      form: system2Result.phase3Form,
      sessionState: 'pending_feedback',
    });
  } catch (error: any) {
    console.error('Error executing System 1 and System 2 qualification assessment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error running qualification assessment',
      },
      { status: 500 }
    );
  }
}

