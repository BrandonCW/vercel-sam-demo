import { NextRequest, NextResponse } from 'next/server';
import { getOpportunity } from '@/lib/db/crm';
import { loadLatestJevResult, loadLatestSystem2Result, requireFreshSessionInteractions } from '@/lib/db/assessments';
import { assertAiGatewayConfigured, getEveAgentOrigin } from '@/lib/env';
import { resolveAgentModel, System2ModelSchema } from '@/lib/models';
import { runAssessmentTurn } from '@/lib/eve-session';
import { assessTurnMessage } from '@/lib/assessment-turns';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { opportunityId, model: requestedModel } = body;
    const parsedModel = System2ModelSchema.safeParse(requestedModel ?? resolveAgentModel());
    if (!parsedModel.success) {
      return NextResponse.json(
        { success: false, error: `Unsupported model '${requestedModel}'. Use one of: ${System2ModelSchema.options.join(', ')}` },
        { status: 400 }
      );
    }
    const model = parsedModel.data;

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
    assertAiGatewayConfigured();
    const origin = getEveAgentOrigin();

    // Turn 1 of a new Assessment Session: System 1 (qualification_assessor) and System 2
    // (playbook_generator) run inside the eve agent; the session then idles until SA feedback.
    const { sessionId } = await runAssessmentTurn({
      origin,
      cookie: request.headers.get('cookie'),
      signal: request.signal,
      message: assessTurnMessage(opportunity.id, model),
    });
    await requireFreshSessionInteractions(opportunity.id, sessionId, {}, {
      initial_scoring: 'run_jev_scoring',
      questions_generated: 'run_system2_analysis',
    });

    const [updatedOpportunity, jevResult, system2Result] = await Promise.all([
      getOpportunity(opportunity.id),
      loadLatestJevResult(opportunity.id, sessionId),
      loadLatestSystem2Result(opportunity.id, sessionId),
    ]);
    if (system2Result.modelUsed !== model) {
      throw new Error(`System 2 ran with ${system2Result.modelUsed}, not the selected model ${model}.`);
    }

    return NextResponse.json({
      success: true,
      opportunity: updatedOpportunity,
      jevResult,
      form: system2Result.phase3Form,
      modelUsed: system2Result.modelUsed,
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
