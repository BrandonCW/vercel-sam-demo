'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEveAgent } from 'eve/react';
import type { Opportunity, System2ModelOption } from '@/lib/types/crm';
import { DEFAULT_SYSTEM2_MODEL } from '@/lib/types/crm';
import { assessmentReducer, type AssessmentView } from '@/lib/assessment-results';
import { assessTurnMessage, saAnswerText } from '@/lib/assessment-turns';
import {
  clearSavedSession,
  clearSubmittingRequestId,
  loadSavedSession,
  loadSubmittingRequestId,
  saveSession,
  saveSubmittingRequestId,
} from '@/lib/ui/saved-assessment-session';
import type { WorkflowState, WorkbenchMode } from '@/lib/simulation/types';

import { TopNavBar } from './TopNavBar';
import { StepperBar, type DeskOsStageId } from './StepperBar';
import { DealContextCard } from './DealContextCard';
import { MeddpiccScorecard } from './MeddpiccScorecard';
import { DynamicDiscoveryForm } from './DynamicDiscoveryForm';
import {
  MonochromeTopBar,
  SuggestedNextStepsCard,
  ProblemCauseFixBanner,
  Stage3HeaderLockup,
  STAGE_GATE_THRESHOLD,
} from './desk-os-shared';

interface LiveQualificationWorkbenchProps {
  initialOpportunity: Opportunity;
  initialScenarioId?: string;
  onModeChange?: (mode: WorkbenchMode) => void;
  hideTopNavBar?: boolean;
  scenarioId?: string;
  onScenarioChange?: (scenarioId: string) => void;
  selectedModel?: System2ModelOption;
  onModelChange?: (model: System2ModelOption) => void;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  initialStageView?: 'blank' | 'stage1' | 'stage2' | 'stage3';
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

const DIMENSION_LABELS: Record<string, string> = {
  identifyPain: 'Identify Pain',
  champion: 'Champion',
  economicBuyer: 'Economic Buyer',
  decisionCriteria: 'Decision Criteria',
  decisionProcess: 'Decision Process',
  metrics: 'Metrics',
  competition: 'Competition',
  paperProcess: 'Paper Process',
};

function formatDimensionsForScorecard(
  dimensionsInput?: Record<string, any>,
  findingsInput?: Record<string, any>,
  fallbackBreakdown?: Record<string, any>,
  baselineDimensionsInput?: Record<string, any>
) {
  if (!dimensionsInput && !fallbackBreakdown) return {};
  const source = dimensionsInput || fallbackBreakdown || {};
  const result: Record<string, any> = {};
  for (const [key, dim] of Object.entries(source)) {
    if (key === 'stageGate') continue;
    const fb = fallbackBreakdown?.[key];
    const finding = findingsInput ? findingsInput[key] : null;
    const baselineDim = baselineDimensionsInput?.[key];

    const quotes =
      finding?.citations?.length
        ? finding.citations
        : dim.evidence?.length
        ? dim.evidence
        : fb?.evidence?.length
        ? fb.evidence
        : dim.quote
        ? [dim.quote]
        : fb?.quote
        ? [fb.quote]
        : [];
    const gaps =
      finding?.gaps?.length
        ? finding.gaps
        : dim.gaps?.length
        ? dim.gaps
        : fb?.gaps?.length
        ? fb.gaps
        : dim.gap
        ? [dim.gap]
        : fb?.gap
        ? [fb.gap]
        : [];

    const currentScore = dim.score ?? fb?.score ?? 0;
    const previousScore = baselineDim?.score ?? dim.previousScore;
    const delta = previousScore !== undefined && previousScore !== null ? currentScore - previousScore : dim.delta;

    result[key] = {
      key,
      label: DIMENSION_LABELS[key] || dim.label || fb?.label || key,
      weight: dim.weight ?? fb?.weight ?? 0.1,
      score: currentScore,
      previousScore: previousScore ?? null,
      delta: delta && delta > 0 ? delta : null,
      status: dim.status || fb?.status || 'unaddressed',
      confidence: dim.confidence ?? fb?.confidence ?? 0,
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
  initialScenarioId = 'scenario_acme_netlify',
  onModeChange,
  hideTopNavBar = false,
  scenarioId: controlledScenarioId,
  onScenarioChange: controlledOnScenarioChange,
  selectedModel: controlledSelectedModel,
  onModelChange: controlledOnModelChange,
  settingsOpen,
  onSettingsOpenChange,
  initialStageView,
}: LiveQualificationWorkbenchProps) {
  const [opportunity, setOpportunity] = useState<Opportunity>(initialOpportunity);
  const [internalScenarioId, setInternalScenarioId] = useState<string>(initialScenarioId);
  const [internalSelectedModel, setInternalSelectedModel] = useState<System2ModelOption>(DEFAULT_SYSTEM2_MODEL);
  const [generation, setGeneration] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (controlledScenarioId && controlledScenarioId !== internalScenarioId) {
      setInternalScenarioId(controlledScenarioId);
      let cancelled = false;
      fetch(`/api/crm/opportunity?scenarioId=${controlledScenarioId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data && data.id) {
            setOpportunity(data);
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }
  }, [controlledScenarioId, internalScenarioId]);

  const scenarioId = controlledScenarioId !== undefined ? controlledScenarioId : internalScenarioId;
  const setScenarioId = controlledOnScenarioChange || setInternalScenarioId;
  const selectedModel = controlledSelectedModel !== undefined ? controlledSelectedModel : internalSelectedModel;
  const setSelectedModel = controlledOnModelChange || setInternalSelectedModel;

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 4000);
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
      hideTopNavBar={hideTopNavBar}
      settingsOpen={settingsOpen}
      onSettingsOpenChange={onSettingsOpenChange}
      initialStageView={initialStageView}
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
  onModeChange?: (mode: WorkbenchMode) => void;
  hideTopNavBar?: boolean;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  initialStageView?: 'blank' | 'stage1' | 'stage2' | 'stage3';
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
  hideTopNavBar = false,
  settingsOpen,
  onSettingsOpenChange,
  initialStageView,
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
  const [submittingRequestId, setSubmittingRequestId] = useState<string | null>(() =>
    loadSubmittingRequestId(baseOpportunity.id)
  );

  const turnInFlight =
    ((agent.status === 'submitted' || agent.status === 'streaming') &&
      (view.phase !== 'awaiting_feedback' || Boolean(submittingRequestId))) ||
    isResuming;

  const currentOpportunity = view.opportunity ?? baseOpportunity;

  const isAwaitingFeedback = view.phase === 'awaiting_feedback' && !submittingRequestId;

  // Map real Eve agent session state to WorkflowState
  const workflowState: WorkflowState =
    view.phase === 'assessing'
      ? 'ANALYZING'
      : view.phase === 'submitting_feedback' || (view.phase === 'awaiting_feedback' && Boolean(submittingRequestId))
      ? 'EVALUATING'
      : isAwaitingFeedback
      ? 'PENDING_FEEDBACK'
      : view.phase === 'closed' || currentOpportunity.suggested_next_steps
      ? 'COMPLETED'
      : 'READY_TO_ASSESS';

  const isComplete = workflowState === 'COMPLETED';

  // Desk OS 3-Stage State
  const [activeStageView, setActiveStageView] = useState<'blank' | 'stage1' | 'stage2' | 'stage3'>(
    initialStageView ??
      (workflowState === 'COMPLETED'
        ? 'stage3'
        : workflowState === 'PENDING_FEEDBACK'
        ? 'stage1'
        : 'blank')
  );

  const [savedFormData, setSavedFormData] = useState<Record<string, string | string[]>>({});
  const [savedManualNotes, setSavedManualNotes] = useState<string>('');
  const [baselineAssessment, setBaselineAssessment] = useState<{
    score: number;
    dimensions: any;
  } | null>(null);

  const prevWorkflowStateRef = useRef<WorkflowState>(workflowState);

  // Synchronize activeStageView with workflowState transitions
  useEffect(() => {
    const prevWorkflow = prevWorkflowStateRef.current;
    if (prevWorkflow !== workflowState || activeStageView === 'blank') {
      if (workflowState === 'PENDING_FEEDBACK') {
        if (prevWorkflow === 'ANALYZING' || activeStageView === 'blank') {
          const score = currentOpportunity.meddpicc_score ?? view.jevResult?.overallScore ?? 0;
          setBaselineAssessment({
            score,
            dimensions: formatDimensionsForScorecard(
              view.jevResult?.dimensions,
              view.system2Result?.dimensionFindings,
              currentOpportunity.meddpicc_breakdown
            ),
          });
          setActiveStageView('stage1');
        }
      } else if (workflowState === 'EVALUATING') {
        if (activeStageView === 'blank') {
          setActiveStageView('stage2');
        }
      } else if (workflowState === 'COMPLETED') {
        if (prevWorkflow === 'EVALUATING' || activeStageView === 'blank' || !baselineAssessment) {
          setActiveStageView('stage3');
        }
      }
      prevWorkflowStateRef.current = workflowState;
    }
  }, [workflowState, activeStageView, currentOpportunity.meddpicc_score, view.jevResult, baselineAssessment]);

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

  const prevPhaseRef = useRef<AssessmentView['phase']>(view.phase);

  useEffect(() => {
    const cancelledFromSubmitting =
      prevPhaseRef.current === 'submitting_feedback' && view.phase === 'awaiting_feedback';
    prevPhaseRef.current = view.phase;
    if (
      view.feedback ||
      view.phase === 'closed' ||
      view.phase === 'ready' ||
      view.phase === 'failed' ||
      cancelledFromSubmitting
    ) {
      clearSubmittingRequestId(baseOpportunity.id);
      setSubmittingRequestId(null);
    }
  }, [view.feedback, view.phase, baseOpportunity.id]);

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
    clearSubmittingRequestId(baseOpportunity.id);
    setSubmittingRequestId(null);
    setResumeError(null);
    setActiveStageView('blank');
    setBaselineAssessment(null);
    setSavedFormData({});
    setSavedManualNotes('');
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
    setSavedFormData(formResponses);
    if (notesDelta !== undefined) setSavedManualNotes(notesDelta);

    showToast('Submitting discovery findings to Eve Agent for delta re-scoring...');
    saveSubmittingRequestId(baseOpportunity.id, pending.requestId);
    setSubmittingRequestId(pending.requestId);
    const text = await saAnswerText(formResponses, notesDelta);
    await sendTurn(WRITEBACK_FAILED, async () => {
      try {
        await agent.respond([{ requestId: pending.requestId, text }]);
      } catch (err) {
        clearSubmittingRequestId(baseOpportunity.id);
        setSubmittingRequestId(null);
        throw err;
      }
    });
  }

  // Live score and dimensions
  const liveScore = currentOpportunity.meddpicc_score ?? view.jevResult?.overallScore ?? view.result?.finalScore ?? 0;

  const baselineScore =
    baselineAssessment?.score ??
    view.baselineJevResult?.overallScore ??
    view.result?.baselineScore ??
    null;

  const scoreDelta =
    baselineScore !== null ? liveScore - baselineScore : view.result?.delta ?? null;

  const liveDimensions = formatDimensionsForScorecard(
    view.jevResult?.dimensions,
    view.system2Result?.dimensionFindings,
    currentOpportunity.meddpicc_breakdown,
    view.baselineJevResult?.dimensions ?? baselineAssessment?.dimensions
  );

  // Dynamic discovery form is computed ungated by workflowState === 'PENDING_FEEDBACK'
  const dynamicForm = view.system2Result?.phase3Form ?? null;

  const discoveryQuestionCount = dynamicForm?.sections
    ? dynamicForm.sections.reduce((acc, s) => acc + (s.fields?.length || 0), 0)
    : 0;

  const gapCount = (baselineAssessment?.dimensions ?? liveDimensions)
    ? Object.values(baselineAssessment?.dimensions ?? liveDimensions).filter(
        (d: any) => d.score <= 3 || d.status === 'unaddressed'
      ).length
    : 0;

  const suggestedNextSteps =
    currentOpportunity.suggested_next_steps ??
    (view.phase === 'closed' ? view.result?.nextSteps ?? null : null);

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

  // Check if retrospectively inspecting when session is already closed or failed
  const isRetrospectiveReadOnly = (isComplete || view.phase === 'failed') && view.pendingInput === null;

  return (
    <main className="min-h-screen bg-[#F8F8F6] text-[#111215]">
      {!hideTopNavBar && (
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
          settingsOpen={settingsOpen}
          onSettingsOpenChange={onSettingsOpenChange}
        />
      )}

      <div className="mx-auto max-w-[1440px] px-4 py-6">
        {/* Desk OS 3-Stage Tactile Stepper */}
        <StepperBar
          activeStageView={activeStageView}
          workflowState={workflowState}
          isComplete={isComplete}
          onSelectStage={(stage: DeskOsStageId) => setActiveStageView(stage)}
          readOnlyRetrospective={isComplete && !baselineScore}
        />

        {/* Unified Desk OS Workbench Shell */}
        <div className="workbench-shell rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] shadow-xs overflow-hidden">
          {/* Quiet Monochrome Top Bar */}
          <MonochromeTopBar opportunity={currentOpportunity} mode="live" />

          {/* 35% / 65% Desk OS Split Workbench */}
          <div className="workbench-split grid grid-cols-1 lg:grid-cols-[35%_65%] min-h-[720px] bg-[#FFFFFF]">
            {/* Left Pane (35%): Opportunity Brief */}
            <DealContextCard opportunity={currentOpportunity} />

            {/* Right Pane (65%): Stage Canvas Router */}
            <div className="workbench-right flex flex-col p-5 gap-5 bg-[#FFFFFF]">
              {/* Failure / Alert Banner */}
              {failure && (
                <ProblemCauseFixBanner
                  problem={failure.label}
                  cause={failure.text}
                  onRetry={
                    view.pendingInput && savedFormData
                      ? () => handleSubmitFeedback(savedFormData, savedManualNotes)
                      : handleStartAssessment
                  }
                  onDismiss={() => {
                    setSendError(null);
                    setResumeError(null);
                  }}
                  onSwitchToSimulation={() => onModeChange?.('simulation')}
                />
              )}

              {/* System 2 Running Status Pill */}
              {view.system2Running && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-md border border-[#0F52BA]/20 bg-[#0F52BA]/5 p-3 text-xs text-[#0F52BA]"
                >
                  <span className="inline-block size-3.5 border-2 border-[#0F52BA] border-t-transparent rounded-full animate-spin" />
                  <span className="font-semibold">System 2 analysis running…</span>
                  <span className="text-[#52545D]">Scoring complete; formulating targeted discovery questions.</span>
                </div>
              )}

              {/* 1. Blank Start State */}
              {activeStageView === 'blank' && workflowState === 'READY_TO_ASSESS' && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                    <div className="score-lockup flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="font-mono text-2xl font-bold tracking-tight text-[#787C87]">
                          --
                        </span>
                        <span className="text-sm font-normal text-[#787C87]">/ 100</span>
                      </div>
                      <span className="mono-pill rounded border border-[#E2E0D8] bg-[#F1F0EC] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#52545D]">
                        Stage Gate 2 · Unassessed Opportunity
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartAssessment}
                      disabled={turnInFlight}
                      aria-label={turnInFlight ? 'Evaluating Opportunity...' : 'Start assessment'}
                      className="btn-action-primary flex items-center justify-center gap-2 rounded-md bg-[#0F52BA] px-4 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#0C4196] cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      {turnInFlight ? (
                        <>
                          <span className="inline-block size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Evaluating Opportunity...</span>
                        </>
                      ) : (
                        <span>Run MEDDPICC Deal Audit — Start Assessment</span>
                      )}
                    </button>
                  </div>

                  <MeddpiccScorecard
                    mode="unassessed"
                    score={0}
                    dimensions={liveDimensions}
                    hideHeader={true}
                  />
                </div>
              )}

              {/* 2. Initial Assessment Loading (ANALYZING) */}
              {workflowState === 'ANALYZING' && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                    <div className="score-lockup flex items-center gap-3">
                      {liveScore > 0 && (
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono text-2xl font-bold tracking-tight text-[#111215] tabular-nums">
                            {liveScore}
                          </span>
                          <span className="text-sm font-normal text-[#787C87]">/ 100</span>
                        </div>
                      )}
                      <div className="text-xs text-[#787C87]">
                        System 1 scoring + System 2 reasoning in progress via AI Gateway...
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={true}
                      aria-label="Evaluating Opportunity..."
                      className="rounded-md border border-[#E2E0D8] bg-[#F1F0EC] px-3 py-1.5 text-xs font-semibold text-[#787C87] cursor-not-allowed opacity-75"
                    >
                      <span>Evaluating Opportunity...</span>
                    </button>
                  </div>

                  <MeddpiccScorecard
                    mode={view.jevResult ? 'analyzing' : 'loading'}
                    score={liveScore}
                    loadingStatus="Audit in progress..."
                    dimensions={liveDimensions}
                    hideHeader={true}
                    onAbort={() => {
                      void agent.cancel();
                    }}
                  />
                </div>
              )}

              {/* 3. Stage 1: Initial Deal Audit */}
              {activeStageView === 'stage1' && workflowState !== 'ANALYZING' && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                    <div className="score-lockup flex flex-wrap items-center gap-3">
                      <span className="font-mono text-2xl font-bold tracking-tight text-[#111215] tabular-nums">
                        {baselineScore ?? liveScore}
                      </span>
                      <span className="text-sm font-normal text-[#787C87]">/ 100</span>
                      <span className="mono-pill rounded border border-[#E2E0D8] bg-[#F1F0EC] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#52545D]">
                        {view.system2Result
                          ? `Stage Gate 2 · System 2 Reasoning Complete (${baselineScore ?? liveScore}/100)`
                          : (baselineScore ?? liveScore) < STAGE_GATE_THRESHOLD
                          ? `Stage Gate 2 · ${gapCount} Gaps Identified (Score < ${STAGE_GATE_THRESHOLD})`
                          : `Stage Gate 2 · Gate Criteria Satisfied (${baselineScore ?? liveScore}/100)`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isComplete && (
                        <button
                          type="button"
                          onClick={() => setActiveStageView('stage3')}
                          className="flex items-center gap-1 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#52545D] hover:bg-[#F1F0EC] cursor-pointer"
                        >
                          <span>Return to Updated Assessment (Stage 3) →</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveStageView('stage2')}
                        className="btn-action-primary flex items-center justify-center gap-1.5 rounded-md bg-[#0F52BA] px-4 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[#0C4196] cursor-pointer shadow-2xs"
                      >
                        <span>Answer {discoveryQuestionCount > 0 ? `${discoveryQuestionCount} ` : ''}Discovery Questions →</span>
                      </button>
                    </div>
                  </div>

                  <MeddpiccScorecard
                    mode="audit"
                    score={baselineScore ?? liveScore}
                    dimensions={
                      baselineAssessment?.dimensions
                        ? (baselineAssessment.dimensions.identifyPain?.quotes
                            ? baselineAssessment.dimensions
                            : formatDimensionsForScorecard(
                                baselineAssessment.dimensions,
                                view.system2Result?.dimensionFindings,
                                currentOpportunity.meddpicc_breakdown
                              ))
                        : liveDimensions
                    }
                    hideHeader={true}
                  />

                  {/* Stage 1 Bottom Summary Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-[#E2E0D8] bg-[#FAFAF7] p-3.5">
                    <span className="text-xs text-[#787C87]">
                      {gapCount} qualification gaps blocking Stage Gate 2 advancement.
                    </span>

                    <button
                      type="button"
                      onClick={() => setActiveStageView('stage2')}
                      className="flex items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#111215] hover:bg-[#F1F0EC] cursor-pointer"
                    >
                      <span>Proceed to Stage 2: Field Discovery →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Stage 2: Field Discovery Checklist */}
              {activeStageView === 'stage2' && workflowState !== 'ANALYZING' && (
                <div className="space-y-4">
                  {workflowState === 'EVALUATING' ? (
                    <MeddpiccScorecard
                      mode="loading"
                      loadingStatus="Synthesizing Discovery Findings & Re-Scoring Deal..."
                      dimensions={liveDimensions}
                      hideHeader={true}
                      onAbort={() => {
                        clearSubmittingRequestId(baseOpportunity.id);
                        setSubmittingRequestId(null);
                        void agent.cancel();
                      }}
                    />
                  ) : (
                    <>
                      {isComplete && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setActiveStageView('stage3')}
                            className="flex items-center gap-1 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#52545D] hover:bg-[#F1F0EC] cursor-pointer"
                          >
                            <span>Return to Updated Assessment (Stage 3) →</span>
                          </button>
                        </div>
                      )}

                      <DynamicDiscoveryForm
                        dynamicForm={dynamicForm}
                        initialValues={savedFormData}
                        initialNotes={savedManualNotes}
                        dimensions={liveDimensions}
                        readOnly={isRetrospectiveReadOnly}
                        isSubmitting={turnInFlight}
                        onBack={() => setActiveStageView('stage1')}
                        onCancel={() => setActiveStageView('stage1')}
                        onDraftChange={(answers, notes) => {
                          setSavedFormData(answers);
                          setSavedManualNotes(notes);
                        }}
                        onSubmit={handleSubmitFeedback}
                      />
                    </>
                  )}
                </div>
              )}

              {/* 5. Stage 3: Updated Assessment & Next Steps */}
              {activeStageView === 'stage3' && isComplete && (
                <div className="space-y-5">
                  {/* Stage 3 Header Lockup */}
                  <Stage3HeaderLockup
                    score={liveScore}
                    baselineScore={baselineScore}
                    scoreDelta={scoreDelta}
                    gapCount={gapCount}
                    onReset={onReset}
                  />

                  {/* Suggested Next Steps Block Directly Above the Scorecard */}
                  <SuggestedNextStepsCard
                    nextSteps={suggestedNextSteps}
                    score={liveScore}
                    qualificationStatus={currentOpportunity.qualification_status}
                  />

                  {/* Upgraded 8-Row MEDDPICC Scorecard */}
                  <MeddpiccScorecard
                    mode="completed"
                    score={liveScore}
                    previousScore={baselineScore}
                    delta={scoreDelta}
                    dimensions={liveDimensions}
                    hideHeader={true}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-[#E2E0D8] bg-white px-4 py-2.5 text-xs font-medium text-[#111215] shadow-lg flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#0F52BA]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </main>
  );
}
