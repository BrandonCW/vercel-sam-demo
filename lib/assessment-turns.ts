import { saFeedbackKey } from '@/lib/agents/feedback-schema';

/**
 * The Assessment Session contract shared by the workbench and the live evals: the one message
 * that starts a session (the root agent calls `run_assessment`, which sequences everything in
 * code) and the SA answer the workbench sends to the tool's discovery pause. No structured turn
 * outcome is requested: code decides pass or fail from the run_assessment action (issue 20).
 */

/** The one assess message: call run_assessment. Writeback without SA feedback only when asked. */
export function assessTurnMessage(opportunityId: string, model: string, options: { writeback?: boolean } = {}): string {
  const call = `Assess opportunity ${opportunityId}: call run_assessment with opportunityId ${opportunityId} and model ${model}`;
  return options.writeback ? `${call} and writebackWithoutFeedback true.` : `${call}.`;
}

/**
 * The SA's discovery answers as the JSON text run_assessment parses from its `ctx.ask` pause.
 * The feedbackKey lets the tool reject answers that were altered on the way.
 */
export async function saAnswerText(formResponses: Record<string, string | string[]>, notesDelta?: string): Promise<string> {
  const feedbackKey = await saFeedbackKey(formResponses, notesDelta);
  return JSON.stringify({ formResponses, ...(notesDelta ? { notesDelta } : {}), feedbackKey });
}
