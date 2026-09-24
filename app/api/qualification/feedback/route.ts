import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getOpportunity, writebackOpportunityQualification, recordInteraction } from '@/lib/db/crm';
import { scoreOpportunityWithJevAI } from '@/lib/agents/jev-scorer';
import { SaFeedbackPayloadSchema, formatSaDiscoveryNotes } from '@/lib/agents/feedback-schema';
import { synthesizeSuggestedNextSteps } from '@/lib/agents/next-steps-synthesizer';
import { MEDDPICCBreakdown, QualificationStatus } from '@/lib/types/crm';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parseResult = SaFeedbackPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid feedback payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { opportunityId, formResponses, notesDelta } = parseResult.data;

    const opportunity = await getOpportunity(opportunityId);
    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: `Opportunity '${opportunityId}' not found` },
        { status: 404 }
      );
    }

    // 1. Structured discovery note formatter: append to sa_notes; leave ae_notes strictly immutable
    const originalAeNotes = opportunity.ae_notes;
    const updatedSaNotes = formatSaDiscoveryNotes(formResponses, notesDelta, opportunity.sa_notes);

    // 2. System 1 Delta Re-scoring trigger via AI Gateway
    const previousScore = opportunity.meddpicc_score ?? 0;
    const jevResult = await scoreOpportunityWithJevAI({
      opportunityId: opportunity.id,
      name: opportunity.name,
      accountName: opportunity.account_name,
      stageName: opportunity.stage_name,
      amount: opportunity.amount,
      aeNotes: opportunity.ae_notes,
      saNotes: updatedSaNotes,
    }, { abortSignal: request.signal });

    const deltaScore = jevResult.overallScore - previousScore;
    const combinedNotes = `${opportunity.ae_notes}\n${updatedSaNotes}`.toLowerCase();

    // 3. Qualification Status transition logic
    let qualificationStatus: QualificationStatus;
    const hasFatalBlocker =
      /(strict on-premise|on-premise container mandate|locked into \d+-year competitor renewal|cannot adopt cloud|fatal blocker|disqualif)/i.test(
        combinedNotes
      ) ||
      Object.values(formResponses).some((val) =>
        /(fatal blocker|disqualified|strict on-premise|cannot migrate)/i.test(
          Array.isArray(val) ? val.join(' ') : String(val)
        )
      );

    if (hasFatalBlocker) {
      qualificationStatus = 'disqualified';
    } else if (jevResult.stageGate.gateReady) {
      qualificationStatus = 'qualified';
    } else if (deltaScore > 0 || (previousScore !== 0 && jevResult.overallScore > 0)) {
      qualificationStatus = 'in_review';
    } else {
      qualificationStatus = opportunity.qualification_status;
    }

    // 4. Standardized Suggested Next Steps synthesis
    const suggestedNextSteps = synthesizeSuggestedNextSteps({
      opportunity: {
        ...opportunity,
        sa_notes: updatedSaNotes,
      },
      qualificationStatus,
      stageGate: jevResult.stageGate,
      jevResult,
      formResponses,
      notesDelta,
    });

    const updatedBreakdown: MEDDPICCBreakdown = {
      ...jevResult.dimensions,
      stageGate: jevResult.stageGate,
    };

    // 5. Atomic database Writeback: updates ONLY designated fields, leaves ae_notes intact
    const updatedOpportunity = await writebackOpportunityQualification(opportunity.id, {
      sa_notes: updatedSaNotes,
      suggested_next_steps: suggestedNextSteps,
      qualification_status: qualificationStatus,
      meddpicc_score: jevResult.overallScore,
      meddpicc_breakdown: updatedBreakdown,
    });

    // Verify invariant that ae_notes remained strictly identical
    if (updatedOpportunity.ae_notes !== originalAeNotes) {
      console.error('CRITICAL: ae_notes was modified during writeback!');
    }

    // 6. Audit telemetry interaction in deal_interactions
    await recordInteraction({
      opportunity_id: opportunity.id,
      actor: 'system1_jev',
      action: 'writeback',
      payload: {
        formResponses,
        notesDelta: notesDelta ?? null,
        previousScore,
        newScore: jevResult.overallScore,
        deltaScore,
        qualificationStatus,
        suggestedNextSteps,
        stageGate: jevResult.stageGate,
        sessionState: 'closed',
        timestamp: new Date().toISOString(),
      },
    });

    // 7. Assessment Session marked as closed and revalidate Next.js path
    try {
      revalidatePath('/');
    } catch {
      // Ignore during unit tests without Next.js server context
    }

    return NextResponse.json({
      success: true,
      opportunity: updatedOpportunity,
      sessionState: 'closed',
      jevResult,
      deltaScore,
      suggestedNextSteps,
    });
  } catch (error: any) {
    console.error('Error processing SA feedback and CRM writeback:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error processing feedback',
      },
      { status: 500 }
    );
  }
}
