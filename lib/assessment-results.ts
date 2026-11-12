import { z } from 'zod';
import type { EveAgentReducer, EveAgentReducerEvent } from 'eve/react';
import type { JevScoringResult } from '@/lib/agents/jev-schema';
import { clearVerifiedDimensionGaps, type System2AnalysisResult } from '@/lib/agents/system2';
import { AssessmentProgressSchema, AssessmentResultSchema, type AssessmentResult } from '@/lib/assessment-progress';
import { withJevScores } from '@/lib/agents/qualification-decision';
import type { Opportunity } from '@/lib/types/crm';

/**
 * The workbench view of one audit session, projected from the session event stream.
 * One audit is one `run_assessment` workflow call: its yields (`action.partial`), its discovery
 * pause (`input.requested`, answered through `respond`), its final verdict (`action.result`),
 * and turn lifecycle events. Client-safe (no server imports).
 */

export type AssessmentPhase = 'ready' | 'assessing' | 'awaiting_feedback' | 'submitting_feedback' | 'closed' | 'failed';

export interface AssessmentView {
  phase: AssessmentPhase;
  /** Analysis model and writeback mode selected when the audit started. */
  request: AssessmentRequest | null;
  /** Active workflow tool identifier while running. */
  runningTool: string | null;
  /** Baseline rubric scores have arrived and deep gap & citation synthesis is still running. */
  system2Running: boolean;
  /** Active discovery pause awaiting Solutions Architect responses; null otherwise. */
  pendingInput: { requestId: string } | null;
  /** feedbackKey of the discovery responses submitted from this workbench, verified on receipt. */
  sentFeedbackKey: string | null;
  opportunity: Opportunity | null;
  jevResult: JevScoringResult | null;
  baselineJevResult: JevScoringResult | null;
  system2Result: System2AnalysisResult | null;
  feedback: { recorded: boolean; feedbackKey: string } | null;
  /** Code-built qualification verdict once CRM writeback completes. */
  result: AssessmentResult | null;
  /** True if the session was created by an incompatible earlier deployment. */
  legacySession: boolean;
  /** True when the latest turn in the stream was cancelled via turn.cancelled. */
  turnCancelled?: boolean;
  error: string | null;
}

export interface AssessmentRequest {
  model: string;
  writebackWithoutFeedback: boolean;
}

export const LEGACY_SESSION_ERROR =
  'This audit session was created by an earlier version of Deal Desk and cannot be resumed. Start a new deal audit.';

const LEGACY_TOOLS = new Set(['run_jev_scoring', 'run_system2_analysis', 'record_sa_feedback', 'crm_update_next_steps']);
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
  baselineJevResult: null,
  system2Result: null,
  feedback: null,
  result: null,
  legacySession: false,
  turnCancelled: false,
  error: null,
};

const fail = (view: AssessmentView, error: string): AssessmentView => ({
  ...view,
  phase: 'failed',
  runningTool: null,
  system2Running: false,
  pendingInput: null,
  legacySession: view.legacySession || MISSING_WORKFLOW.test(error),
  // Preserve the root-cause error rather than overwriting with downstream outcome echoes.
  error: view.error ?? error,
});

const legacy = (view: AssessmentView): AssessmentView =>
  fail({ ...view, legacySession: true, error: null }, LEGACY_SESSION_ERROR);

const issues = (error: z.ZodError) => error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');

function applyProgress(view: AssessmentView, output: unknown): AssessmentView {
  const parsed = AssessmentProgressSchema.safeParse(output);
  if (!parsed.success) return fail(view, `Unreadable deal audit progress update: ${issues(parsed.error)}`);
  const p = parsed.data;
  switch (p.stage) {
    case 'jev_scored':
      // Baseline rubric scores are ready: immediately mark deep gap synthesis as running so Stage 1 renders progressively.
      return {
        ...view,
        jevResult: p.jevResult,
        baselineJevResult: p.round === 'baseline' ? p.jevResult : (view.baselineJevResult ?? p.jevResult),
        opportunity: view.opportunity && withJevScores(view.opportunity, p.jevResult),
        system2Result:
          p.round === 'rescore' && view.system2Result
            ? clearVerifiedDimensionGaps(view.system2Result, p.jevResult)
            : view.system2Result,
        system2Running: p.round === 'baseline',
      };
    case 'jev_saved':
      return {
        ...view,
        jevResult: p.jevResult,
        baselineJevResult: p.round === 'baseline' ? p.jevResult : (view.baselineJevResult ?? p.jevResult),
        opportunity: p.opportunity,
        system2Result:
          p.round === 'rescore' && view.system2Result
            ? clearVerifiedDimensionGaps(view.system2Result, p.jevResult)
            : view.system2Result,
        system2Running: p.round === 'baseline',
      };
    case 'system2_saved':
      if (view.request && p.system2Result.modelUsed !== view.request.model) {
        return fail(
          view,
          `Deep gap & citation analysis ran with ${p.system2Result.modelUsed} instead of the selected analysis model ${view.request.model}.`
        );
      }
      return { ...view, system2Result: p.system2Result, opportunity: p.opportunity, system2Running: false };
    case 'feedback_recorded':
      if (view.sentFeedbackKey !== null && p.feedback.feedbackKey !== view.sentFeedbackKey) {
        return fail(
          view,
          'Recorded discovery responses did not match the answers submitted from the workbench (feedbackKey mismatch).'
        );
      }
      return { ...view, feedback: p.feedback, phase: 'submitting_feedback', pendingInput: null };
  }
}

function applyResult(view: AssessmentView, output: unknown): AssessmentView {
  const parsed = AssessmentResultSchema.safeParse(output);
  if (!parsed.success) return fail(view, `Unreadable deal audit verdict: ${issues(parsed.error)}`);
  // Transition directly to 'closed' as soon as the validated writeback verdict arrives,
  // avoiding a multi-second UI freeze while the agent finishes its trailing turn completion token.
  return {
    ...view,
    phase: 'closed',
    runningTool: null,
    system2Running: false,
    pendingInput: null,
    result: parsed.data,
    opportunity: parsed.data.opportunity,
    system2Result:
      view.system2Result && view.jevResult
        ? clearVerifiedDimensionGaps(view.system2Result, view.jevResult)
        : view.system2Result,
    error: null,
  };
}

const RequestInputSchema = z.object({ model: z.string().optional(), writebackWithoutFeedback: z.boolean().optional() });

function applyCall(view: AssessmentView, input: unknown): AssessmentView {
  if (view.request) {
    return fail(view, 'The deal audit workflow was invoked more than once in this audit session. Start a new deal audit.');
  }
  const parsed = RequestInputSchema.safeParse(input ?? {});
  if (!parsed.success) return fail(view, `Unreadable deal audit request: ${issues(parsed.error)}`);
  if (!parsed.data.model) {
    return fail(view, 'No analysis model was specified for deep gap & citation analysis; select an analysis model and retry.');
  }
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
        return fail(view, 'This audit session is already closed and written back to the CRM; start a new deal audit.');
      }
      return view.phase === 'ready'
        ? { ...view, phase: 'assessing', turnCancelled: false, error: null }
        : { ...view, turnCancelled: false };
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
      if (!request || view.legacySession || view.phase === 'closed') return view;
      if (!view.system2Result) {
        return fail(view, 'Discovery answers were requested before deep gap & citation analysis produced a discovery form.');
      }
      // Also handles durable ctx.ask retries (attempts 2..3), restoring awaiting_feedback and clearing stale error state.
      return {
        ...view,
        phase: 'awaiting_feedback',
        runningTool: null,
        system2Running: false,
        pendingInput: { requestId: request.requestId },
        sentFeedbackKey: null,
        turnCancelled: false,
        error: null,
      };
    }
    case 'client.input.responded': {
      const pending = view.pendingInput;
      const response = pending && event.data.responses.find((r) => r.requestId === pending.requestId);
      if (!response) return view;
      let sent: unknown = null;
      try {
        sent = JSON.parse(('text' in response && response.text) || 'null');
      } catch {
        // Malformed JSON triggers a retry prompt or fails the workflow step with a descriptive error.
      }
      const key = SentAnswerSchema.safeParse(sent);
      return {
        ...view,
        phase: 'submitting_feedback',
        sentFeedbackKey: key.success ? key.data.feedbackKey : null,
        turnCancelled: false,
      };
    }
    case 'input.resolved': {
      const pending = view.pendingInput;
      const resolution = pending && event.data.resolutions.find((r) => r.requestId === pending.requestId);
      if (!resolution) return view;
      if (resolution.outcome !== 'answered') {
        return fail(view, `The discovery responses were not accepted (${resolution.outcome}).`);
      }
      return { ...view, phase: 'submitting_feedback', pendingInput: null };
    }
    case 'action.result': {
      const result = event.data.result as { toolName?: string; output?: unknown };
      if (result.toolName && LEGACY_TOOLS.has(result.toolName)) return legacy(view);
      if (event.data.status !== 'completed') {
        return fail(view, event.data.error?.message ?? 'The deal audit step failed without an error message.');
      }
      if (!result.toolName) return fail(view, 'Received an incomplete audit action result with no tool identifier.');
      return result.toolName === TOOL ? applyResult(view, result.output) : { ...view, runningTool: null };
    }
    case 'turn.completed':
      // Clean no-op if already closed by applyResult or already failed.
      if (view.phase === 'failed' || view.phase === 'closed') return view;
      // Turn 1 completes while parked awaiting discovery answers; session stays open.
      if (view.phase === 'awaiting_feedback' && view.pendingInput) return view;
      if (view.result) return { ...view, phase: 'closed', runningTool: null };
      return fail(view, 'The audit session ended without a CRM writeback. Retry the deal audit.');
    case 'turn.cancelled': {
      if (view.phase === 'failed' || view.phase === 'closed') return view;
      const hasAwaitingDiscovery = Boolean(
        view.pendingInput || (view.system2Result && (!view.feedback || !view.feedback.recorded))
      );
      return {
        ...view,
        phase: hasAwaitingDiscovery ? 'awaiting_feedback' : 'ready',
        runningTool: null,
        system2Running: false,
        sentFeedbackKey: hasAwaitingDiscovery ? null : view.sentFeedbackKey,
        turnCancelled: true,
        error: null,
      };
    }
    case 'session.completed':
      return {
        ...view,
        phase: 'closed',
        runningTool: null,
        system2Running: false,
        pendingInput: null,
      };
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

/**
 * Normalizes suggested next steps into a list of strings, supporting string, string[],
 * newline delimiters, or null/undefined without throwing.
 */
export function formatNextSteps(steps: string | string[] | null | undefined): string[] {
  if (!steps) return [];
  if (Array.isArray(steps)) {
    return steps.map((s) => String(s).trim()).filter((s) => s.length > 0);
  }
  if (typeof steps === 'string') {
    const trimmed = steps.trim();
    if (!trimmed) return [];
    if (trimmed.includes('\n')) {
      return trimmed
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return [trimmed];
  }
  return [];
}

export function getNextStepsCopyText(steps: string | string[] | null | undefined): string {
  const items = formatNextSteps(steps);
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}
