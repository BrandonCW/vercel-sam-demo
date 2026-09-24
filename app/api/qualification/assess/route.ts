import { NextRequest, NextResponse } from 'next/server';
import { getOpportunity } from '@/lib/db/crm';
import {
  loadLatestJevResult,
  loadLatestSystem2Result,
  requireFreshInteractions,
  snapshotInteractions,
} from '@/lib/db/assessments';
import { assertAiGatewayConfigured, getEveAgentOrigin } from '@/lib/env';
import { resolveAgentModel, System2ModelSchema } from '@/lib/models';
import { runAgentTurn } from '@/lib/eve-session';

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

    // System 1 (qualification_assessor) and System 2 (playbook_generator) run inside the eve agent.
    const before = await snapshotInteractions(opportunity.id);
    await runAgentTurn({
      origin,
      cookie: request.headers.get('cookie'),
      signal: request.signal,
      message:
        `Assess opportunity ${opportunity.id}. Delegate System 1 Jev scoring to qualification_assessor, ` +
        `then System 2 to playbook_generator with model ${model}. Do not write back to the CRM yet: ` +
        `the Solutions Architect answers the discovery form first.`,
    });
    await requireFreshInteractions(opportunity.id, before, {
      initial_scoring: 'run_jev_scoring',
      questions_generated: 'run_system2_analysis',
    });

    const [updatedOpportunity, jevResult, system2Result] = await Promise.all([
      getOpportunity(opportunity.id),
      loadLatestJevResult(opportunity.id),
      loadLatestSystem2Result(opportunity.id),
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
