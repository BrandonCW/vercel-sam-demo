'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEveAgent } from 'eve/react';
import {
  Opportunity,
  System2ModelOption,
  DEFAULT_SYSTEM2_MODEL,
  AssessmentSessionState,
} from '@/lib/types/crm';
import { assessmentReducer, type AssessmentView } from '@/lib/assessment-results';
import { assessTurnMessage, feedbackTurnMessage, TURN_OUTCOME_JSON_SCHEMA } from '@/lib/assessment-turns';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';
import { clearSavedSession, loadSavedSession, saveSession } from '@/lib/ui/saved-assessment-session';
import { TopNavBar } from './TopNavBar';
import { ContextColumn } from './ContextColumn';
import { ActionStage } from './ActionStage';

interface WorkbenchShellProps {
  initialOpportunity: Opportunity;
  initialScenarioId: string;
}

/**
 * The split workbench. Scenario, model selection and demo resets live here; the
 * Assessment Session itself runs in `AssessmentWorkbench`, one durable eve
 * session per Opportunity, keyed so switching Opportunity remounts the hook.
 */
export function WorkbenchShell({ initialOpportunity, initialScenarioId }: WorkbenchShellProps) {
  const [opportunity, setOpportunity] = useState<Opportunity>(initialOpportunity);
  const [scenarioId, setScenarioId] = useState<string>(initialScenarioId);
  const [selectedModel, setSelectedModel] = useState<System2ModelOption>(DEFAULT_SYSTEM2_MODEL);
  // Bumped by a reset: remounts the Assessment Session so the next assessment starts a new one.
  const [generation, setGeneration] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // The saved sessions live in this browser's localStorage, so the Assessment Session mounts
  // only after hydration (the server render has no saved session to resume).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  async function handleScenarioChange(newScenarioId: string) {
    try {
      const res = await fetch(`/api/crm/opportunity?scenarioId=${newScenarioId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setScenarioId(newScenarioId);
      setOpportunity(data);
      showToast(`Switched to scenario: ${newScenarioId}`);
    } catch (err) {
      showToast(`Failed to switch scenario: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleReset() {
    setIsResetting(true);
    try {
      const res = await fetch('/api/crm/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      // The reset deleted the session's results: forget it, and start the next assessment fresh.
      clearSavedSession(data.opportunity.id);
      setOpportunity(data.opportunity);
      setGeneration((g) => g + 1);
      showToast('Demo state reset to default unqualified baseline');
    } catch (err) {
      showToast(`Failed to reset demo state: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-[#f4f4f5]">
      {!hydrated && (
        <main className="flex-1 flex items-center justify-center text-xs text-zinc-500">Loading workbench…</main>
      )}
      {hydrated && (
        <AssessmentWorkbench
          key={`${opportunity.id}:${generation}`}
          baseOpportunity={opportunity}
          scenarioId={scenarioId}
          onScenarioChange={handleScenarioChange}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onReset={handleReset}
          isResetting={isResetting}
          showToast={showToast}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#18181b] border border-blue-500/50 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-[#0070f3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

interface AssessmentWorkbenchProps {
  baseOpportunity: Opportunity;
  scenarioId: string;
  onScenarioChange: (scenarioId: string) => void;
  selectedModel: System2ModelOption;
  onModelChange: (model: System2ModelOption) => void;
  onReset: () => Promise<void>;
  isResetting: boolean;
  showToast: (msg: string) => void;
}

/** The Assessment Session of one Opportunity, driven through `useEveAgent` (same-origin `/eve/v1`). */
function AssessmentWorkbench({
  baseOpportunity,
  scenarioId,
  onScenarioChange,
  selectedModel,
  onModelChange,
  onReset,
  isResetting,
  showToast,
}: AssessmentWorkbenchProps) {
  // Read once per mount: the key remounts this component for another Opportunity or after a reset.
  const [savedSession] = useState(() => loadSavedSession(baseOpportunity));
  const [resumeError, setResumeError] = useState<string | null>(null);
  const statusRef = useRef<string>(savedSession ? 'resuming' : 'ready');
  const agent = useEveAgent({
    reducer: assessmentReducer,
    initialSession: savedSession,
    resume: savedSession !== undefined,
    onSessionChange: (session) =>
      session ? saveSession(baseOpportunity, session) : clearSavedSession(baseOpportunity.id),
    onError: (err) => {
      if (statusRef.current !== 'resuming') return;
      setResumeError(err.message);
      // eve no longer has the saved session (expired, retired): forget it. Other errors keep it for a retry.
      if (isSessionGone(err)) clearSavedSession(baseOpportunity.id);
    },
  });
  statusRef.current = agent.status;
  const view = agent.data;
  const isResuming = agent.status === 'resuming';
  const turnInFlight = agent.status === 'submitted' || agent.status === 'streaming' || isResuming;
  // Stream results win over the page-load / reset snapshot of the Opportunity.
  const opportunity = view.opportunity ?? baseOpportunity;
  // A send that never reached the stream (network, 401, a turn already running) has no projected failure.
  const [sendError, setSendError] = useState<{ label: string; text: string } | null>(null);
  const failure = resumeError
    ? { label: 'Could not resume the saved Assessment Session:', text: resumeError }
    : view.phase === 'failed' && view.error
      ? { label: failureLabel(view), text: view.error }
      : sendError ??
        (agent.status === 'error' && agent.error ? { label: failureLabel(view), text: agent.error.message } : null);

  useToastOnPhaseChange(view, isResuming, showToast);

  async function sendTurn(message: string, label: string) {
    setSendError(null);
    try {
      await agent.send(message, { outputSchema: TURN_OUTCOME_JSON_SCHEMA });
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setSendError({ label, text });
      showToast(`${label} ${text}`);
    }
  }

  async function handleStartAssessment() {
    // Every assessment is a new Assessment Session; the previous session stays in eve.
    agent.reset();
    setResumeError(null);
    showToast('Executing System 1 (Jev) scoring & System 2 deep reasoning...');
    await sendTurn(assessTurnMessage(baseOpportunity.id, selectedModel), ASSESS_FAILED);
  }

  async function handleSubmitFeedback(formResponses: Record<string, string | string[]>, notesDelta?: string) {
    const payload = { opportunityId: baseOpportunity.id, formResponses, ...(notesDelta ? { notesDelta } : {}) };
    showToast('Submitting discovery findings...');
    await sendTurn(feedbackTurnMessage(payload, await saFeedbackKey(formResponses, notesDelta)), WRITEBACK_FAILED);
  }

  const stage = toActionStage(view);

  const runtimeStatus = isResuming
    ? 'RESUMING'
    : stage.isAssessing
    ? 'ANALYZING'
    : stage.isSubmittingFeedback
    ? 'EVALUATING'
    : stage.sessionState === 'pending_feedback'
    ? 'PENDING_FEEDBACK'
    : opportunity.suggested_next_steps || stage.sessionState === 'closed'
    ? 'COMPLETED'
    : 'READY_TO_ASSESS';

  return (
    <>
      <TopNavBar
        opportunity={opportunity}
        currentScenarioId={scenarioId}
        onScenarioChange={onScenarioChange}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        onReset={onReset}
        isResetting={isResetting}
        controlsLocked={turnInFlight}
        runtimeStatus={runtimeStatus}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6">
        {failure && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-xs text-red-200">
            <span className="font-bold text-red-300 mr-1.5">{failure.label}</span>
            {failure.text}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-6 items-start">
          <ContextColumn opportunity={opportunity} />
          <ActionStage
            opportunity={opportunity}
            selectedModel={view.system2Result?.modelUsed ?? selectedModel}
            sessionState={stage.sessionState}
            dynamicForm={stage.form}
            onStartAssessment={handleStartAssessment}
            isAssessing={stage.isAssessing || turnInFlight}
            onSubmitFeedback={handleSubmitFeedback}
            isSubmittingFeedback={stage.isSubmittingFeedback}
            isFormLocked={turnInFlight}
          />
        </div>
      </main>
    </>
  );
}

/** Maps the projected Assessment Session onto the ActionStage stages. */
function toActionStage(view: AssessmentView) {
  const form = view.system2Result?.phase3Form ?? null;
  // A failed feedback turn keeps the paused form so the SA can resubmit to the same session.
  const paused =
    view.phase === 'awaiting_feedback' || (view.phase === 'failed' && view.turn === 'feedback' && !view.writeback);
  const sessionState: AssessmentSessionState =
    view.phase === 'closed' ? 'closed' : paused || view.phase === 'submitting_feedback' ? 'pending_feedback' : 'initiated';
  return {
    sessionState,
    form: sessionState === 'pending_feedback' ? form : null,
    isAssessing: view.phase === 'assessing',
    isSubmittingFeedback: view.phase === 'submitting_feedback',
  };
}

/** eve's answer for a session ID it can no longer serve (unknown, terminal or expired). */
function isSessionGone(error: Error): boolean {
  const { code, status } = error as Error & { code?: string; status?: number };
  return code === 'session_not_active' || code === 'session_not_found' || status === 404 || status === 410;
}

const ASSESS_FAILED = 'Assessment failed:';
const WRITEBACK_FAILED = 'Writeback failed:';

/** Failure heading for the turn that failed. */
function failureLabel(view: AssessmentView): string {
  return view.turn === 'feedback' ? WRITEBACK_FAILED : ASSESS_FAILED;
}

/** Toasts for live phase changes (not while a resumed session replays its history). */
function useToastOnPhaseChange(view: AssessmentView, isResuming: boolean, showToast: (msg: string) => void) {
  const previous = useRef(view.phase);
  useEffect(() => {
    const from = previous.current;
    previous.current = view.phase;
    if (isResuming || from === view.phase) return;
    if (view.phase === 'awaiting_feedback' && view.system2Result && view.opportunity) {
      showToast(
        `Assessment complete (${view.system2Result.modelUsed}, Score ${view.opportunity.meddpicc_score}/100). Paused at $0 compute.`
      );
    } else if (view.phase === 'closed') {
      showToast('Delta Re-scoring complete & Suggested Next Steps written back to CRM!');
    } else if (view.phase === 'failed') {
      showToast(`${failureLabel(view)} ${view.error}`);
    }
  }, [view, isResuming, showToast]);
}
