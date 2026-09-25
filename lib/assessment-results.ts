import { z } from 'zod';
import type { EveAgentReducer, EveAgentReducerEvent } from 'eve/react';
import { JevScoringResultSchema, type JevScoringResult } from '@/lib/agents/jev-schema';
import { System2AnalysisResultSchema, type System2AnalysisResult, type System2Draft } from '@/lib/agents/system2';
import { withDraftFindings, withJevScores } from '@/lib/agents/qualification-decision';
import { DimensionTargetSchema, JsonRenderFormSchema } from '@/lib/ui/json-render-schema';
import { parseTurnRequest, TurnOutcomeSchema, type TurnOutcome, type TurnRequest } from '@/lib/assessment-turns';
import type { Opportunity } from '@/lib/types/crm';

/**
 * The workbench view of one Assessment Session, projected from the root eve
 * session's stream: the typed results of the root tools (`action.result`), their
 * preliminary snapshots (`action.partial`: Jev scores before the CRM write, System 2
 * drafts while it streams), the
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
  /** What the latest turn message asked for (System 2 model or feedbackKey); results are checked against it. */
  request: TurnRequest | null;
  /** Root tool currently running (e.g. run_jev_scoring, run_system2_analysis), for progress. */
  runningTool: string | null;
  opportunity: Opportunity | null;
  jevResult: JevScoringResult | null;
  system2Result: System2AnalysisResult | null;
  /** What System 2 has written so far while it streams; display-only, replaced by system2Result. */
  system2Draft: System2Draft | null;
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
  run_jev_scoring: projector(
    z.object({ interactionId: z.string(), jevResult: JevScoringResultSchema, opportunity: OpportunitySchema }),
    (v, r) => ({ ...v, jevResult: r.jevResult, opportunity: r.opportunity })
  ),
  run_system2_analysis: projector(
    z.object({ interactionId: z.string(), system2Result: System2AnalysisResultSchema, opportunity: OpportunitySchema }),
    (v, r) =>
      v.request?.turn === 'assess' && r.system2Result.modelUsed !== v.request.model
        ? fail(v, `System 2 ran with ${r.system2Result.modelUsed}, not the requested model ${v.request.model}.`)
        : { ...v, system2Result: r.system2Result, system2Draft: null, opportunity: r.opportunity }
  ),
  record_sa_feedback: projector(z.object({ recorded: z.boolean(), feedbackKey: z.string() }), (v, r) =>
    v.request?.turn === 'feedback' && r.feedbackKey !== v.request.feedbackKey
      ? fail(v, 'The agent recorded different SA answers than the workbench submitted (feedbackKey mismatch).')
      : { ...v, feedback: r }
  ),
  crm_update_next_steps: projector(
    z.object({ suggestedNextSteps: z.string().min(1), deltaScore: z.number(), opportunity: OpportunitySchema }),
    (v, r) => ({ ...v, writeback: { suggestedNextSteps: r.suggestedNextSteps, deltaScore: r.deltaScore }, opportunity: r.opportunity })
  ),
};

const DimensionFindingSchema = z.object({ citations: z.array(z.string()), gaps: z.array(z.string()) });
const System2DraftSchema = z.object({
  dimensionFindings: z.record(DimensionTargetSchema, DimensionFindingSchema),
  form: JsonRenderFormSchema.nullable(),
});

/** Preliminary snapshots (`action.partial`) the workbench renders before the tool's final result. */
const PARTIAL_PROJECTORS = {
  // Jev has answered; the CRM write is still in flight. A failed write fails the view via action.result.
  run_jev_scoring: projector(z.object({ jevResult: JevScoringResultSchema }), (v, r) => ({
    ...v,
    jevResult: r.jevResult,
    opportunity: v.opportunity && withJevScores(v.opportunity, r.jevResult),
  })),
  run_system2_analysis: projector(z.object({ draft: System2DraftSchema }), (v, r) => ({
    ...v,
    system2Draft: r.draft,
    opportunity: v.opportunity && {
      ...v.opportunity,
      meddpicc_breakdown: withDraftFindings(v.opportunity.meddpicc_breakdown, r.draft),
    },
  })),
};

const INITIAL: AssessmentView = {
  phase: 'ready',
  turn: null,
  outcome: null,
  request: null,
  runningTool: null,
  opportunity: null,
  jevResult: null,
  system2Result: null,
  system2Draft: null,
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

function applyToolPartial(view: AssessmentView, tool: string, output: unknown): AssessmentView {
  if (!Object.hasOwn(PARTIAL_PROJECTORS, tool)) return view;
  const { schema, apply } = PARTIAL_PROJECTORS[tool as keyof typeof PARTIAL_PROJECTORS] as ReturnType<typeof projector<unknown>>;
  const parsed = schema.safeParse(output);
  // A System 2 draft is display-only and superseded by the validated result, so an unreadable
  // one is skipped (the last good draft stays). A Jev snapshot is the scores themselves: fail.
  if (!parsed.success && tool === 'run_system2_analysis') return view;
  if (!parsed.success) {
    return fail(view, `Unreadable ${tool} snapshot: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return apply(view, parsed.data);
}

/** Phase once a turn settles without error. */
function settledPhase(view: AssessmentView): AssessmentView {
  if (view.phase === 'failed') return view;
  if (view.writeback) return { ...view, phase: 'closed', runningTool: null };
  if (view.turn === 'feedback') {
    return fail(view, 'The SA feedback turn ended without a CRM writeback (crm_update_next_steps did not complete).');
  }
  if (view.system2Result) return { ...view, phase: 'awaiting_feedback', runningTool: null };
  return fail(view, 'The assessment turn ended without a System 2 discovery form (run_system2_analysis did not complete).');
}

function reduce(view: AssessmentView, event: EveAgentReducerEvent): AssessmentView {
  switch (event.type) {
    case 'message.received': {
      const request = parseTurnRequest(event.data.message);
      return request ? { ...view, request } : view;
    }
    case 'client.message.submitted':
    case 'turn.started': {
      const request = event.type === 'client.message.submitted' ? parseTurnRequest(event.data.message) : null;
      if (request) view = { ...view, request };
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
    case 'action.partial': {
      if (view.phase === 'failed') return view;
      const result = event.data.result as { toolName?: string; output?: unknown };
      return result.toolName ? applyToolPartial(view, result.toolName, result.output) : view;
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
