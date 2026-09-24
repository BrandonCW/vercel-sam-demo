import { NextRequest, NextResponse } from 'next/server';
import { getOpportunity, updateOpportunity, recordInteraction } from '@/lib/db/crm';
import { scoreOpportunityWithJev } from '@/lib/agents/jev-scorer';
import { MEDDPICCBreakdown } from '@/lib/types/crm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { opportunityId } = body;

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

    // Run deterministic System 1 (Jev) scoring
    const jevResult = scoreOpportunityWithJev({
      dealId: opportunity.id,
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

    // Record telemetry event in deal_interactions
    await recordInteraction({
      opportunity_id: opportunity.id,
      actor: 'system1_jev',
      action: 'initial_scoring',
      payload: jevResult as unknown as Record<string, unknown>,
    });

    return NextResponse.json({
      success: true,
      opportunity: updatedOpportunity,
      jevResult,
    });
  } catch (error: any) {
    console.error('Error executing System 1 qualification assessment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error running qualification assessment',
      },
      { status: 500 }
    );
  }
}
