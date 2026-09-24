import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getOpportunity, recordInteraction, updateOpportunity } from '@/lib/db/crm';
import {
  loadLatestJevResult,
  loadLatestSystem2Result,
  requireFreshInteractions,
  snapshotInteractions,
} from '@/lib/db/assessments';
import { assertAiGatewayConfigured } from '@/lib/env';
import { runAgentTurn } from '@/lib/eve-session';
import { SaFeedbackPayloadSchema, formatSaDiscoveryNotes } from '@/lib/agents/feedback-schema';

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

    // Fail fast on missing config and on feedback with no System 2 analysis to answer.
    assertAiGatewayConfigured();
    await loadLatestSystem2Result(opportunity.id);
    const previousScore = opportunity.meddpicc_score ?? 0;

    // 1. Append timestamped SA discovery notes; ae_notes is never touched.
    await updateOpportunity(opportunity.id, {
      sa_notes: formatSaDiscoveryNotes(formResponses, notesDelta, opportunity.sa_notes),
    });
    await recordInteraction({
      opportunity_id: opportunity.id,
      actor: 'sa_user',
      action: 'sa_feedback',
      payload: { formResponses, notesDelta: notesDelta ?? null },
    });

    // 2. Delta re-scoring (qualification_assessor) and the code-decided writeback (crm_update_next_steps) run in eve.
    const before = await snapshotInteractions(opportunity.id);
    await runAgentTurn({
      origin: request.nextUrl.origin,
      cookie: request.headers.get('cookie'),
      signal: request.signal,
      message:
        `The Solutions Architect's discovery answers for opportunity ${opportunity.id} are now in its SA notes. ` +
        `Delegate delta re-scoring to qualification_assessor, then call crm_update_next_steps for ${opportunity.id}.`,
    });
    await requireFreshInteractions(opportunity.id, before, {
      initial_scoring: 'run_jev_scoring',
      writeback: 'crm_update_next_steps',
    });

    const [updatedOpportunity, jevResult] = await Promise.all([
      getOpportunity(opportunity.id),
      loadLatestJevResult(opportunity.id),
    ]);
    if (!updatedOpportunity?.suggested_next_steps) {
      throw new Error(`crm_update_next_steps wrote no Suggested Next Steps for ${opportunity.id}`);
    }
    const suggestedNextSteps = updatedOpportunity.suggested_next_steps;
    const qualificationStatus = updatedOpportunity.qualification_status;
    const deltaScore = jevResult.overallScore - previousScore;

    // 3. Audit telemetry: the Assessment Session closes.
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
