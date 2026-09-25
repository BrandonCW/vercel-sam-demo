import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getOpportunity } from '@/lib/db/crm';
import {
  findOpenAssessmentSession,
  loadLatestJevResult,
  loadSessionWriteback,
  OpenSessionError,
  requireFreshSessionInteractions,
  requireRecordedSaFeedback,
  snapshotSessionInteractions,
} from '@/lib/db/assessments';
import { assertAiGatewayConfigured, getEveAgentOrigin } from '@/lib/env';
import { runAssessmentTurn } from '@/lib/eve-session';
import { feedbackTurnMessage } from '@/lib/assessment-turns';
import { SaFeedbackPayloadSchema, saFeedbackKey } from '@/lib/agents/feedback-schema';

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

    const payload = parseResult.data;
    const { opportunityId } = payload;

    const opportunity = await getOpportunity(opportunityId);
    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: `Opportunity '${opportunityId}' not found` },
        { status: 404 }
      );
    }

    let sessionId: string;
    try {
      sessionId = await findOpenAssessmentSession(opportunity.id);
    } catch (error) {
      if (error instanceof OpenSessionError) {
        return NextResponse.json({ success: false, error: error.message }, { status: 409 });
      }
      throw error;
    }
    assertAiGatewayConfigured();
    const origin = getEveAgentOrigin();

    // Turn 2 of the same Assessment Session. The agent records the answers (record_sa_feedback appends
    // the SA notes atomically and idempotently), re-scores with Jev and writes back in code.
    const feedbackKey = await saFeedbackKey(payload.formResponses, payload.notesDelta);
    const before = await snapshotSessionInteractions(opportunity.id, sessionId);
    await runAssessmentTurn({
      origin,
      sessionId,
      cookie: request.headers.get('cookie'),
      signal: request.signal,
      message: feedbackTurnMessage(payload, feedbackKey),
    });
    await requireRecordedSaFeedback(opportunity.id, sessionId, feedbackKey);
    await requireFreshSessionInteractions(opportunity.id, sessionId, before, {
      initial_scoring: 'run_jev_scoring',
      writeback: 'crm_update_next_steps',
    });

    const [updatedOpportunity, jevResult, writeback] = await Promise.all([
      getOpportunity(opportunity.id),
      loadLatestJevResult(opportunity.id, sessionId),
      loadSessionWriteback(opportunity.id, sessionId),
    ]);
    if (!updatedOpportunity?.suggested_next_steps) {
      throw new Error(`crm_update_next_steps wrote no Suggested Next Steps for ${opportunity.id}`);
    }

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
      deltaScore: writeback.deltaScore,
      suggestedNextSteps: writeback.suggestedNextSteps,
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
