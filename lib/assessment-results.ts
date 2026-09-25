import { z } from 'zod';
import type { EveAgentReducer, EveAgentReducerEvent } from 'eve/react';
import { JevScoringResultSchema, type JevScoringResult } from '@/lib/agents/jev-schema';
import { System2AnalysisResultSchema, type System2AnalysisResult } from '@/lib/agents/system2';
import { TurnOutcomeSchema, type TurnOutcome } from '@/lib/assessment-turns';
import type { Opportunity } from '@/lib/types/crm';

/**
 * The workbench view of one Assessment Session, projected from the root eve
 * session's stream: the typed results of the root tools (`action.result`), the
 * structured turn outcome (`result.completed`) and turn lifecycle events. A
 * resumed session replays the same stream, so the view rebuilds itself.
 *
 * Client-safe (no server imports). Fails loudly: a failed step, a failed
 * outcome or a result that does not parse puts the view in `failed` with the
 * error verbatim; nothing is defaulted.
 */

export type AssessmentPhase =
  | 'ready'
  | 'assessing'
  | 'awaiting_feedback'
  | 'submitting_feedback'
  | 'closed'
  | 'failed';

export interface AssessmentView {
  phase: AssessmentPhase;
  /** The turn in progress or last settled: turn 1 assesses, turn 2 records SA feedback and writes back. */
  turn: 'assess' | 'feedback' | null;
  /** Structured outcome the agent reported for the last turn. */
  outcome: TurnOutcome | null;
  /** Root tool currently running (e.g. score_deal, analyze_deal), for progress. */
  runningTool: string | null;
  opportunity: Opportunity | null;
  jevResult: JevScoringResult | null;
  system2Result: System2AnalysisResult | null;
  feedback: { recorded: boolean; feedbackKey: string } | null;
  writeback: { suggestedNextSteps: string; deltaScore: number } | null;
  error: string | null;
}

// The Opportunity is a CRM row the tools read from Postgres; check the fields the workbench relies on.
const OpportunitySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    meddpicc_score: z.number().nullable(),
    qualification_status: z.enum(['unqualified', 'in_review', 'qualified', 'disqualified']),
    suggested_next_steps: z.string().nullable(),
    meddpicc_breakdown: z.record(z.unknown()),
  })
  .passthrough()
  .transform((o) => o as unknown as Opportunity);

/** One root tool's typed output and how it updates the view. */
function projector<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, apply: (view: AssessmentView, result: T) => AssessmentView) {
  return { schema, apply };
}

/** Typed outputs of the root tools the workbench renders, keyed by tool name. */
const PROJECTORS = {
  crm_read_deal: projector(z.object({ opportunity: OpportunitySchema }), (v, r) => ({ ...v, opportunity: r.opportunity })),
  score_deal: projector(
    z.object({ interactionId: z.string(), jevResult: JevScoringResultSchema, opportunity: OpportunitySchema }),
    (v, r) => ({ ...v, jevResult: r.jevResult, opportunity: r.opportunity })
  ),
  analyze_deal: projector(
    z.object({ interactionId: z.string(), system2Result: System2AnalysisResultSchema, opportunity: OpportunitySchema }),
    (v, r) => ({ ...v, system2Result: r.system2Result, opportunity: r.opportunity })
  ),
  record_sa_feedback: projector(z.object({ recorded: z.boolean(), feedbackKey: z.string() }), (v, r) => ({ ...v, feedback: r })),
  crm_update_next_steps: projector(
    z.object({ suggestedNextSteps: z.string().min(1), deltaScore: z.number(), opportunity: OpportunitySchema }),
    (v, r) => ({ ...v, writeback: { suggestedNextSteps: r.suggestedNextSteps, deltaScore: r.deltaScore }, opportunity: r.opportunity })
  ),
};

const INITIAL: AssessmentView = {
  phase: 'ready',
  turn: null,
  outcome: null,
  runningTool: null,
  opportunity: null,
  jevResult: null,
  system2Result: null,
  feedback: null,
  writeback: null,
  error: null,
};

const fail = (view: AssessmentView, error: string): AssessmentView => ({
  ...view,
  phase: 'failed',
  runningTool: null,
  // The first error is the cause; later ones (the outcome restating it) do not overwrite it.
  error: view.error ?? error,
});

function applyToolResult(view: AssessmentView, tool: string, output: unknown): AssessmentView {
  if (!Object.hasOwn(PROJECTORS, tool)) return { ...view, runningTool: null };
  const { schema, apply } = PROJECTORS[tool as keyof typeof PROJECTORS] as ReturnType<typeof projector<unknown>>;
  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    return fail(view, `Unreadable ${tool} result: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return apply({ ...view, runningTool: null }, parsed.data);
}

/** Phase once a turn settles without error. */
function settledPhase(view: AssessmentView): AssessmentView {
  if (view.phase === 'failed') return view;
  if (view.writeback) return { ...view, phase: 'closed', runningTool: null };
  if (view.turn === 'feedback') {
    return fail(view, 'The SA feedback turn ended without a CRM writeback (crm_update_next_steps did not complete).');
  }
  if (view.system2Result) return { ...view, phase: 'awaiting_feedback', runningTool: null };
  return fail(view, 'The assessment turn ended without a System 2 discovery form (analyze_deal did not complete).');
}

function reduce(view: AssessmentView, event: EveAgentReducerEvent): AssessmentView {
  switch (event.type) {
    case 'client.message.submitted':
    case 'turn.started': {
      if (view.phase === 'assessing' || view.phase === 'submitting_feedback') return view;
      if (view.writeback) {
        return fail(view, 'This Assessment Session is already closed (written back); start a new assessment.');
      }
      // A turn on a session that already has a discovery form is the SA feedback turn.
      // The error and outcome describe the latest turn, so a retried turn starts clean.
      return view.system2Result
        ? { ...view, phase: 'submitting_feedback', turn: 'feedback', error: null, outcome: null }
        : { ...view, phase: 'assessing', turn: 'assess', error: null, outcome: null };
    }
    case 'actions.requested': {
      const call = event.data.actions.find((a) => a.kind === 'tool-call');
      return call && 'toolName' in call ? { ...view, runningTool: call.toolName } : view;
    }
    case 'action.result': {
      const result = event.data.result as { toolName?: string; output?: unknown };
      if (event.data.status !== 'completed') {
        return fail(view, event.data.error?.message ?? `${result.toolName ?? 'A tool'} failed without an error message`);
      }
      if (!result.toolName) return fail(view, 'The eve stream sent a completed action result that names no tool.');
      return applyToolResult(view, result.toolName, result.output);
    }
    case 'result.completed': {
      const outcome = TurnOutcomeSchema.safeParse(event.data.result);
      if (!outcome.success) return fail(view, 'The eve agent returned no structured turn outcome.');
      const next = { ...view, outcome: outcome.data };
      return outcome.data.outcome === 'failed' ? fail(next, outcome.data.error ?? 'The eve agent reported a failed turn.') : next;
    }
    case 'turn.completed':
      return settledPhase(view);
    case 'turn.failed':
    case 'session.failed':
      return fail(view, event.data.message);
    case 'client.message.failed':
      return fail(view, event.data.error.message);
    default:
      return view;
  }
}

export const assessmentReducer: EveAgentReducer<AssessmentView> = {
  initial: () => INITIAL,
  reduce,
};
