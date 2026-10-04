'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useEveAgent } from 'eve/react';
import type { Opportunity, System2ModelOption } from '@/lib/types/crm';
import { DEFAULT_SYSTEM2_MODEL } from '@/lib/types/crm';
import { assessmentReducer, type AssessmentView } from '@/lib/assessment-results';
import { assessTurnMessage, saAnswerText } from '@/lib/assessment-turns';
import {
  clearSavedSession,
  loadSavedSession,
  saveSession,
} from '@/lib/ui/saved-assessment-session';
import type { WorkflowState, WorkbenchMode } from '@/lib/simulation/types';

import { TopNavBar } from './TopNavBar';
import { StepperBar, JumpToStateButtons } from './StepperBar';
import { WorkflowBanners } from './Banners';
import { DealContextCard } from './DealContextCard';
import { MeddpiccScorecard } from './MeddpiccScorecard';
import { StageGateCard } from './StageGateCard';
import { DealSummaryCard } from './DealSummaryCard';
import { ActionPanel } from './ActionPanel';
import { DynamicDiscoveryForm } from './DynamicDiscoveryForm';

interface LiveQualificationWorkbenchProps {
  initialOpportunity: Opportunity;
  initialScenarioId: string;
  onModeChange: (mode: WorkbenchMode) => void;
}

const ASSESS_FAILED = 'Assessment failed:';
const WRITEBACK_FAILED = 'Writeback failed:';

function isSessionGone(error: Error): boolean {
  const { code, status } = error as Error & { code?: string; status?: number };
  return (
    code === 'session_not_active' ||
    code === 'session_not_found' ||
    status === 404 ||
    status === 410 ||
    /is not registered as a workflow in this deployment/.test(error.message)
  );
}

function failureLabel(view: AssessmentView): string {
  if (view.legacySession) return 'Saved Assessment Session unavailable:';
  return view.feedback || view.sentFeedbackKey !== null ? WRITEBACK_FAILED : ASSESS_FAILED;
}

function formatDimensionsForScorecard(
  dimensionsInput?: Record<string, any>,
  findingsInput?: Record<string, any>
) {
  if (!dimensionsInput) return {};
  const result: Record<string, any> = {};
  for (const [key, dim] of Object.entries(dimensionsInput)) {
    const finding = findingsInput ? findingsInput[key] : null;
    const quotes = finding?.citations || dim.evidence || (dim.quote ? [dim.quote] : []);
    const gaps = finding?.gaps || dim.gaps || (dim.gap ? [dim.gap] : []);
    result[key] = {
      key,
      label: dim.label || key,
      weight: dim.weight ?? 0.1,
      score: dim.score ?? 0,
      status: dim.status || 'unaddressed',
      confidence: dim.confidence ?? 0,
      quote: quotes[0],
      quotes,
      gap: gaps[0],
      gaps,
    };
  }
  return result;
}

export function LiveQualificationWorkbench({
  initialOpportunity,
  initialScenarioId,
  onModeChange,
}: LiveQualificationWorkbenchProps) {
  const [opportunity, setOpportunity] = useState<Opportunity>(initialOpportunity);
  const [scenarioId, setScenarioId] = useState<string>(initialScenarioId);
  const [selectedModel, setSelectedModel] = useState<System2ModelOption>(DEFAULT_SYSTEM2_MODEL);
  const [generation, setGeneration] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      showToast(`Switched scenario to: ${data.name}`);
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
      clearSavedSession(data.opportunity.id);
      setOpportunity(data.opportunity);
      setGeneration((g) => g + 1);
      showToast('Demo state reset to default unqualified baseline in CRM');
    } catch (err) {
      showToast(`Failed to reset: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <LiveAssessmentSession
      key={`${opportunity.id}:${generation}`}
      baseOpportunity={opportunity}
      scenarioId={scenarioId}
      onScenarioChange={handleScenarioChange}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      onReset={handleReset}
      isResetting={isResetting}
      showToast={showToast}
      toastMessage={toastMessage}
      onModeChange={onModeChange}
    />
  );
}

interface LiveAssessmentSessionProps {
  baseOpportunity: Opportunity;
  scenarioId: string;
  onScenarioChange: (scenarioId: string) => void;
  selectedModel: System2ModelOption;
  onModelChange: (model: System2ModelOption) => void;
  onReset: () => Promise<void>;
  isResetting: boolean;
  showToast: (msg: string) => void;
  toastMessage: string | null;
  onModeChange: (mode: WorkbenchMode) => void;
}

function LiveAssessmentSession({
  baseOpportunity,
  scenarioId,
  onScenarioChange,
  selectedModel,
  onModelChange,
  onReset,
  isResetting,
  showToast,
  toastMessage,
  onModeChange,
}: LiveAssessmentSessionProps) {
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
      if (isSessionGone(err)) clearSavedSession(baseOpportunity.id);
    },
  });

  statusRef.current = agent.status;
  const view = agent.data;
  const isResuming = agent.status === 'resuming';
  const turnInFlight =
    ((agent.status === 'submitted' || agent.status === 'streaming') &&
      view.phase !== 'awaiting_feedback') ||
    isResuming;

  const currentOpportunity = view.opportunity ?? baseOpportunity;

  const [sendError, setSendError] = useState<{ label: string; text: string } | null>(null);
  const failure = resumeError
    ? { label: 'Could not resume the saved Assessment Session:', text: resumeError }
    : view.phase === 'failed' && view.error
    ? { label: failureLabel(view), text: view.error }
    : sendError ??
      (agent.status === 'error' && agent.error
        ? { label: failureLabel(view), text: agent.error.message }
        : null);

  useEffect(() => {
    if (view.legacySession) clearSavedSession(baseOpportunity.id);
  }, [view.legacySession, baseOpportunity.id]);

  async function sendTurn(label: string, submit: () => Promise<void>) {
    setSendError(null);
    try {
      await submit();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setSendError({ label, text });
      showToast(`${label} ${text}`);
    }
  }

  async function handleStartAssessment() {
    agent.reset();
    setResumeError(null);
    showToast('Executing System 1 (Jev) scoring & System 2 deep reasoning via AI Gateway...');
    await sendTurn(ASSESS_FAILED, () =>
      agent.send(assessTurnMessage(baseOpportunity.id, selectedModel))
    );
  }

  async function handleSubmitFeedback(
    formResponses: Record<string, string | string[]>,
    notesDelta?: string
  ) {
    const pending = view.pendingInput;
    if (!pending) {
      setSendError({
        label: WRITEBACK_FAILED,
        text: 'This Assessment Session is not waiting for SA answers.',
      });
      return;
    }
    showToast('Submitting discovery findings to Eve Agent for delta re-scoring...');
    const text = await saAnswerText(formResponses, notesDelta);
    await sendTurn(WRITEBACK_FAILED, () =>
      agent.respond([{ requestId: pending.requestId, text }])
    );
  }

  // Map real Eve agent session state to WorkflowState
  const workflowState: WorkflowState =
    view.phase === 'assessing'
      ? 'ANALYZING'
      : view.phase === 'awaiting_feedback'
      ? 'PENDING_FEEDBACK'
      : view.phase === 'submitting_feedback'
      ? 'EVALUATING'
      : view.phase === 'closed' || currentOpportunity.suggested_next_steps
      ? 'COMPLETED'
      : 'READY_TO_ASSESS';

  const isComplete = workflowState === 'COMPLETED';

  // Live score and dimensions
  const liveScore = currentOpportunity.meddpicc_score ?? (isComplete ? 76 : 0);

  const liveDimensions = view.jevResult
    ? formatDimensionsForScorecard(
        view.jevResult.dimensions,
        view.system2Result?.dimensionFindings
      )
    : formatDimensionsForScorecard(currentOpportunity.meddpicc_breakdown);

  const liveStageGate = view.jevResult?.stageGate ?? currentOpportunity.stage_gate;

  const dynamicForm =
    workflowState === 'PENDING_FEEDBACK' ? view.system2Result?.phase3Form ?? null : null;

  const suggestedNextSteps =
    currentOpportunity.suggested_next_steps ??
    (view.phase === 'closed' ? view.result?.nextSteps ?? null : null);

  const statusLabel =
    currentOpportunity.qualification_status === 'qualified'
      ? '[QUALIFIED]'
      : workflowState === 'PENDING_FEEDBACK'
      ? '[IN REVIEW]'
      : '[READY TO ASSESS]';

  const runtimeStatus = isResuming
    ? 'RESUMING'
    : workflowState === 'ANALYZING'
    ? 'ANALYZING'
    : workflowState === 'EVALUATING'
    ? 'EVALUATING'
    : workflowState === 'PENDING_FEEDBACK'
    ? 'PENDING_FEEDBACK'
    : isComplete
    ? 'COMPLETED'
    : 'READY_TO_ASSESS';

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#152238]">
      <TopNavBar
        opportunity={currentOpportunity}
        mode="live"
        onModeChange={onModeChange}
        currentScenarioId={scenarioId}
        onScenarioChange={onScenarioChange}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        onReset={onReset}
        isResetting={isResetting}
        controlsLocked={turnInFlight}
        runtimeStatus={runtimeStatus}
      />

      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        {failure && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"
          >
            <span className="font-semibold text-red-900 mr-1.5">{failure.label}</span>
            {failure.text}
          </div>
        )}

        {/* Breadcrumbs and Title Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#718097]">
              <span>PIPELINE</span>
              <ChevronRight className="size-3" aria-hidden="true" />
              <span>{currentOpportunity.account_name?.toUpperCase() || 'ACME CORP'}</span>
              <ChevronRight className="size-3" aria-hidden="true" />
              <span className="text-[#152238]">QUALIFICATION</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[#152238]">
              {currentOpportunity.name || 'Acme Corp — Platform Migration'}
            </h2>
            <p className="mt-1 text-sm text-[#718097]">
              MEDDPICC assessment workspace <span className="mx-2 text-[#c4ccd7]">•</span> Live connected (AI Gateway & Salesforce CRM)
            </p>
          </div>

          <JumpToStateButtons
            currentWorkflow={workflowState}
            onJumpToState={() => {}}
            mode="live"
          />
        </div>

        {/* 5-Step Stepper Bar */}
        <StepperBar
          currentWorkflow={workflowState}
          onJumpToState={() => {}}
          isComplete={isComplete}
        />

        {/* Status / Alert Banners */}
        <WorkflowBanners
          workflow={workflowState}
          isComplete={isComplete}
          statusLabel={statusLabel}
          isLive={true}
        />

        {/* Main 2-Column Split Workbench */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left Column: Deal Context + (Discovery Form OR MEDDPICC Scorecard) */}
          <div className="min-w-0 space-y-6">
            <DealContextCard opportunity={currentOpportunity} />

            {workflowState === 'PENDING_FEEDBACK' && dynamicForm ? (
              <DynamicDiscoveryForm
                dynamicForm={dynamicForm}
                onSubmit={handleSubmitFeedback}
                isSubmitting={turnInFlight}
              />
            ) : (
              <MeddpiccScorecard
                score={liveScore}
                dimensions={liveDimensions}
              />
            )}
          </div>

          {/* Right Column: Stage Gate 2 + Summary + Workflow Controls */}
          <aside className="space-y-6">
            <StageGateCard
              score={liveScore}
              complete={isComplete}
              stageGate={liveStageGate}
              dimensions={liveDimensions}
            />

            <DealSummaryCard score={liveScore} statusLabel={statusLabel} />

            <ActionPanel
              workflow={workflowState}
              isComplete={isComplete}
              nextSteps={suggestedNextSteps}
              onAdvance={handleStartAssessment}
              onReset={onReset}
              isBusy={turnInFlight}
            />
          </aside>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-[#dfe5ed] bg-white px-4 py-2.5 text-xs font-medium text-[#152238] shadow-lg flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#0070f3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </main>
  );
}
