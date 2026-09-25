import { z } from 'zod';
import type { EveAgentReducer, EveAgentReducerEvent } from 'eve/react';
import type { JevScoringResult } from '@/lib/agents/jev-schema';
import type { System2AnalysisResult } from '@/lib/agents/system2';
import { AssessmentProgressSchema, AssessmentResultSchema, type AssessmentResult } from '@/lib/assessment-progress';
import { withJevScores } from '@/lib/agents/qualification-decision';
import type { Opportunity } from '@/lib/types/crm';

/**
 * The workbench view of one Assessment Session, projected from the root eve session's stream.
 * The session is one `run_assessment` workflow call: its yields (`action.partial`: Jev scores
 * before their CRM write, then each persisted result), its discovery pause (`input.requested`,
 * answered through `respond`), its final result (`action.result`) and turn lifecycle events.
 * Pass or fail is decided by code, from that one action: a completed `run_assessment` whose
 * output parses as `AssessmentResultSchema` is a pass; a failed one is a failure, with eve's
 * error verbatim. Nothing the root model says is read. A resumed session replays the same stream,
 * so the view rebuilds itself, including a pending pause.
 *
 * Client-safe (no server imports). Fails loudly: a failed run_assessment action, a second call,
 * a missing or mismatched System 2 model, or anything that does not parse puts the view in
 * `failed` with the error verbatim; nothing is defaulted.
 */

export type AssessmentPhase = 'ready' | 'assessing' | 'awaiting_feedback' | 'submitting_feedback' | 'closed' | 'failed';

export interface AssessmentView {
  phase: AssessmentPhase;
  /** What run_assessment was called with (System 2 model, writeback mode); results are checked against it. */
  request: AssessmentRequest | null;
  /** Root tool currently running, for progress. */
  runningTool: string | null;
  /** Jev has scored and System 2 is still running (the "System 2 analysis running…" indicator). */
  system2Running: boolean;
  /** The discovery pause the SA answers; null when nothing is pending. */
  pendingInput: { requestId: string } | null;
  /** feedbackKey of the answers this workbench sent, checked against what the tool recorded. */
  sentFeedbackKey: string | null;
  opportunity: Opportunity | null;
  jevResult: JevScoringResult | null;
  system2Result: System2AnalysisResult | null;
  feedback: { recorded: boolean; feedbackKey: string } | null;
  /** run_assessment's code-built verdict: set only when the action completed and its output parsed. */
  result: AssessmentResult | null;
  /** The session was started by an older deployment this one cannot continue: start a fresh one. */
  legacySession: boolean;
  error: string | null;
}

/** The run_assessment call, read from its action input in the stream. */
export interface AssessmentRequest {
  model: string;
  writebackWithoutFeedback: boolean;
}

export const LEGACY_SESSION_ERROR =
  'This Assessment Session was started by an older version of the agent and cannot be resumed. Start a new assessment.';

/** Root tools of the per-step design (issue 18) that run_assessment replaced (issue 19). */
const LEGACY_TOOLS = new Set(['run_jev_scoring', 'run_system2_analysis', 'record_sa_feedback', 'crm_update_next_steps']);
/** eve's error for a run whose workflow this deployment no longer has. */
const MISSING_WORKFLOW = /is not registered as a workflow in this deployment/;
const TOOL = 'run_assessment';

const SentAnswerSchema = z.object({ feedbackKey: z.string() });

const INITIAL: AssessmentView = {
  phase: 'ready',
  request: null,
  runningTool: null,
  system2Running: false,
  pendingInput: null,
  sentFeedbackKey: null,
  opportunity: null,
  jevResult: null,
  system2Result: null,
  feedback: null,
  result: null,
  legacySession: false,
  error: null,
};

const fail = (view: AssessmentView, error: string): AssessmentView => ({
  ...view,
  phase: 'failed',
  runningTool: null,
  system2Running: false,
  pendingInput: null,
  legacySession: view.legacySession || MISSING_WORKFLOW.test(error),
  // The first error is the cause; later ones (the outcome restating it) do not overwrite it.
  error: view.error ?? error,
});

// The legacy message replaces any earlier error: it is what the user must act on.
const legacy = (view: AssessmentView): AssessmentView => fail({ ...view, legacySession: true, error: null }, LEGACY_SESSION_ERROR);

const issues = (error: z.ZodError) => error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');

function applyProgress(view: AssessmentView, output: unknown): AssessmentView {
  const parsed = AssessmentProgressSchema.safeParse(output);
  if (!parsed.success) return fail(view, `Unreadable ${TOOL} progress: ${issues(parsed.error)}`);
  const p = parsed.data;
  switch (p.stage) {
    case 'jev_scored':
      // Jev has answered; the CRM write is in flight. A failed write fails the action.
      return { ...view, jevResult: p.jevResult, opportunity: view.opportunity && withJevScores(view.opportunity, p.jevResult) };
    case 'jev_saved':
      return { ...view, jevResult: p.jevResult, opportunity: p.opportunity, system2Running: p.round === 'baseline' };
    case 'system2_saved':
      if (view.request && p.system2Result.modelUsed !== view.request.model) {
        return fail(view, `System 2 ran with ${p.system2Result.modelUsed}, not the requested model ${view.request.model}.`);
      }
      return { ...view, system2Result: p.system2Result, opportunity: p.opportunity, system2Running: false };
    case 'feedback_recorded':
      if (view.sentFeedbackKey !== null && p.feedback.feedbackKey !== view.sentFeedbackKey) {
        return fail(view, 'run_assessment recorded different SA answers than the workbench submitted (feedbackKey mismatch).');
      }
      // eve 0.64 sends no input.resolved for a workflow question: the recorded answers settle it.
      return { ...view, feedback: p.feedback, phase: 'submitting_feedback', pendingInput: null };
  }
}

function applyResult(view: AssessmentView, output: unknown): AssessmentView {
  const parsed = AssessmentResultSchema.safeParse(output);
  if (!parsed.success) return fail(view, `Unreadable ${TOOL} result: ${issues(parsed.error)}`);
  return { ...view, runningTool: null, pendingInput: null, result: parsed.data, opportunity: parsed.data.opportunity };
}

const RequestInputSchema = z.object({ model: z.string().optional(), writebackWithoutFeedback: z.boolean().optional() });

/** The run_assessment call starts the session; its input is what the results are checked against. */
function applyCall(view: AssessmentView, input: unknown): AssessmentView {
  if (view.request) return fail(view, `${TOOL} was called more than once in this Assessment Session.`);
  const parsed = RequestInputSchema.safeParse(input ?? {});
  if (!parsed.success) return fail(view, `Unreadable ${TOOL} input: ${issues(parsed.error)}`);
  if (!parsed.data.model) return fail(view, `${TOOL} was called without a System 2 model; the workbench always selects one.`);
  return {
    ...view,
    runningTool: TOOL,
    request: { model: parsed.data.model, writebackWithoutFeedback: parsed.data.writebackWithoutFeedback === true },
  };
}

function reduce(view: AssessmentView, event: EveAgentReducerEvent): AssessmentView {
  switch (event.type) {
    case 'client.message.submitted':
    case 'turn.started':
      if (view.phase === 'closed') {
        return fail(view, 'This Assessment Session is already closed (written back); start a new assessment.');
      }
      return view.phase === 'ready' ? { ...view, phase: 'assessing', error: null } : view;
    case 'actions.requested': {
      const call = event.data.actions.find((a) => a.kind === 'tool-call');
      if (!call || !('toolName' in call)) return view;
      if (LEGACY_TOOLS.has(call.toolName)) return legacy(view);
      if (view.phase === 'failed') return view;
      return call.toolName === TOOL ? applyCall(view, 'input' in call ? call.input : undefined) : { ...view, runningTool: call.toolName };
    }
    case 'action.partial': {
      if (view.phase === 'failed') return view;
      const result = event.data.result as { toolName?: string; output?: unknown };
      if (result.toolName && LEGACY_TOOLS.has(result.toolName)) return legacy(view);
      return result.toolName === TOOL ? applyProgress(view, result.output) : view;
    }
    case 'input.requested': {
      const request = event.data.requests.find((r) => r.kind === 'question' && r.action.toolName === TOOL);
      if (!request || view.phase === 'failed') return view;
      if (!view.system2Result) return fail(view, `${TOOL} asked for SA answers before it produced a discovery form.`);
      return { ...view, phase: 'awaiting_feedback', runningTool: null, pendingInput: { requestId: request.requestId } };
    }
    case 'client.input.responded': {
      const pending = view.pendingInput;
      const response = pending && event.data.responses.find((r) => r.requestId === pending.requestId);
      if (!response) return view;
      let sent: unknown = null;
      try {
        sent = JSON.parse(('text' in response && response.text) || 'null');
      } catch {
        // Not JSON: run_assessment rejects it and fails the action with the reason.
      }
      const key = SentAnswerSchema.safeParse(sent);
      return { ...view, phase: 'submitting_feedback', sentFeedbackKey: key.success ? key.data.feedbackKey : null };
    }
    case 'input.resolved': {
      const pending = view.pendingInput;
      const resolution = pending && event.data.resolutions.find((r) => r.requestId === pending.requestId);
      if (!resolution) return view;
      if (resolution.outcome !== 'answered') {
        return fail(view, `The SA discovery answer was not accepted (${resolution.outcome}).`);
      }
      return { ...view, phase: 'submitting_feedback', pendingInput: null };
    }
    case 'action.result': {
      const result = event.data.result as { toolName?: string; output?: unknown };
      if (result.toolName && LEGACY_TOOLS.has(result.toolName)) return legacy(view);
      if (event.data.status !== 'completed') {
        return fail(view, event.data.error?.message ?? `${result.toolName ?? 'A tool'} failed without an error message`);
      }
      if (!result.toolName) return fail(view, 'The eve stream sent a completed action result that names no tool.');
      return result.toolName === TOOL ? applyResult(view, result.output) : { ...view, runningTool: null };
    }
    case 'turn.completed':
      if (view.phase === 'failed') return view;
      // The turn completes as run_assessment parks on its question; the run itself is still open.
      if (view.phase === 'awaiting_feedback' && view.pendingInput) return view;
      if (view.result) return { ...view, phase: 'closed', runningTool: null };
      return fail(view, `The Assessment Session ended without a CRM writeback (${TOOL} did not complete).`);
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
