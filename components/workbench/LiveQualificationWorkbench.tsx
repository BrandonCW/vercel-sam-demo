'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, Loader2 } from 'lucide-react';
import { useEveAgent } from 'eve/react';
import type { Opportunity, StageGateEvaluation, System2ModelOption } from '@/lib/types/crm';
import { DEFAULT_SYSTEM2_MODEL } from '@/lib/types/crm';
import { DEMO_SCENARIOS, INITIAL_MEDDPICC_BREAKDOWN } from '@/lib/db/scenarios';
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
  formatStageGateReadout,
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

function isSeededInitialBreakdown(breakdown?: Record<string, any> | null): boolean {
  if (!breakdown) return true;
  if (breakdown === INITIAL_MEDDPICC_BREAKDOWN) return true;
  const painGap = breakdown.identifyPain?.gaps?.[0];
  const ebGap = breakdown.economicBuyer?.gaps?.[0];
  return (
    painGap === INITIAL_MEDDPICC_BREAKDOWN.identifyPain?.gaps?.[0] &&
    ebGap === INITIAL_MEDDPICC_BREAKDOWN.economicBuyer?.gaps?.[0] &&
    breakdown.identifyPain?.score === 0
  );
}

export function formatDimensionsForScorecard(
  dimensionsInput?: Record<string, any>,
  findingsInput?: Record<string, any>,
  fallbackBreakdown?: Record<string, any>,
  baselineDimensionsInput?: Record<string, any>,
  options?: { allowFallbackFindings?: boolean }
) {
  if (!dimensionsInput && !fallbackBreakdown) return {};
  const source = dimensionsInput || fallbackBreakdown || {};
  const allowFallbackFindings =
    (options?.allowFallbackFindings ?? true) && !isSeededInitialBreakdown(fallbackBreakdown);

  const result: Record<string, any> = {};
  for (const [key, dim] of Object.entries(source)) {
    if (key === 'stageGate') continue;
    const fb = fallbackBreakdown?.[key];
    const finding = findingsInput ? findingsInput[key] : null;
    const baselineDim = baselineDimensionsInput?.[key];

    const quotes =
      finding?.citations?.length
        ? finding.citations
        : dim.quotes?.length
        ? dim.quotes
        : dim.evidence?.length
        ? dim.evidence
        : allowFallbackFindings && fb?.evidence?.length
        ? fb.evidence
        : dim.quote
        ? [dim.quote]
        : allowFallbackFindings && fb?.quote
        ? [fb.quote]
        : [];

    const gaps =
      finding?.gaps?.length
        ? finding.gaps
        : dim.gaps?.length
        ? dim.gaps
        : allowFallbackFindings && fb?.gaps?.length
        ? fb.gaps
        : dim.gap
        ? [dim.gap]
        : allowFallbackFindings && fb?.gap
        ? [fb.gap]
        : [];

    const currentScore = dim.score ?? fb?.score ?? 0;
    const previousScore = baselineDim?.score ?? dim.previousScore;
    const delta =
      previousScore !== undefined && previousScore !== null
        ? currentScore - previousScore
        : dim.delta;

    result[key] = {
      key,
      label: DIMENSION_LABELS[key] || dim.label || fb?.label || key,
      weight: dim.weight ?? fb?.weight ?? 0.1,
      score: currentScore,
      previousScore: previousScore ?? null,
      delta: delta !== undefined && delta !== null && delta !== 0 ? delta : null,
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
  const effectiveInitialScenarioId = controlledScenarioId ?? initialScenarioId;
  const expectedInitialOppId = DEMO_SCENARIOS[effectiveInitialScenarioId]?.default_data.id;
  const initialMatchesScenario =
    !expectedInitialOppId || initialOpportunity.id === expectedInitialOppId;

  const [opportunity, setOpportunity] = useState<Opportunity>(() => {
    if (initialMatchesScenario) return initialOpportunity;
    const scenarioTemplate = DEMO_SCENARIOS[effectiveInitialScenarioId]?.default_data;
    return scenarioTemplate
      ? {
          ...scenarioTemplate,
          created_at: initialOpportunity.created_at,
          updated_at: initialOpportunity.updated_at,
        }
      : initialOpportunity;
  });

  const [internalScenarioId, setInternalScenarioId] = useState<string>(effectiveInitialScenarioId);
  const [internalSelectedModel, setInternalSelectedModel] =
    useState<System2ModelOption>(DEFAULT_SYSTEM2_MODEL);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deduplicates scenario fetches across mount sync & controlled scenario updates
  const syncedScenarioRef = useRef<string | null>(
    initialMatchesScenario ? effectiveInitialScenarioId : null
  );

  const scenarioId = controlledScenarioId !== undefined ? controlledScenarioId : internalScenarioId;
  const setScenarioId = controlledOnScenarioChange || setInternalScenarioId;
  const selectedModel =
    controlledSelectedModel !== undefined ? controlledSelectedModel : internalSelectedModel;
  const setSelectedModel = controlledOnModelChange || setInternalSelectedModel;
  const effectiveSettingsOpen = settingsOpen !== undefined ? settingsOpen : internalSettingsOpen;
  const effectiveOnSettingsOpenChange = onSettingsOpenChange || setInternalSettingsOpen;

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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Hydrate CRM opportunity when mounting with an out-of-sync scenario (e.g., Simulation -> Live)
  // or when parent controlledScenarioId changes externally without double-fetching.
  useEffect(() => {
    if (!scenarioId || syncedScenarioRef.current === scenarioId) {
      return;
    }

    syncedScenarioRef.current = scenarioId;
    setInternalScenarioId(scenarioId);
    setScenarioError(null);
    let cancelled = false;

    fetch(`/api/crm/opportunity?scenarioId=${encodeURIComponent(scenarioId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        if (!cancelled && data && data.id) {
          setOpportunity(data);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        syncedScenarioRef.current = null;
        const msg = err instanceof Error ? err.message : String(err);
        setScenarioError(msg);
        showToast(`Failed to load opportunity: ${msg}`);
      });

    return () => {
      cancelled = true;
    };
  }, [scenarioId, showToast]);

  async function handleScenarioChange(newScenarioId: string) {
    setScenarioError(null);
    syncedScenarioRef.current = newScenarioId;
    setInternalScenarioId(newScenarioId);
    try {
      const res = await fetch(`/api/crm/opportunity?scenarioId=${encodeURIComponent(newScenarioId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setScenarioId(newScenarioId);
      setOpportunity(data);
    } catch (err) {
      syncedScenarioRef.current = scenarioId;
      setInternalScenarioId(scenarioId);
      const msg = err instanceof Error ? err.message : String(err);
      setScenarioError(msg);
      showToast(`Failed to switch opportunity: ${msg}`);
    }
  }

  async function handleReset() {
    setIsResetting(true);
    setScenarioError(null);
    try {
      const res = await fetch('/api/crm/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      clearSavedSession(data.opportunity.id);
      clearSubmittingRequestId(data.opportunity.id);
      setOpportunity(data.opportunity);
      setGeneration((g) => g + 1);
      showToast('Opportunity reset to default unqualified baseline in CRM');
    } catch (err) {
      showToast(`Failed to reset opportunity: ${err instanceof Error ? err.message : String(err)}`);
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
      scenarioError={scenarioError}
      onClearScenarioError={() => setScenarioError(null)}
      onRetryScenarioLoad={() => {
        syncedScenarioRef.current = null;
        void handleScenarioChange(scenarioId);
      }}
      showToast={showToast}
      toastMessage={toastMessage}
      onModeChange={onModeChange}
      hideTopNavBar={hideTopNavBar}
      settingsOpen={effectiveSettingsOpen}
      onSettingsOpenChange={effectiveOnSettingsOpenChange}
      initialStageView={initialStageView}
    />
  );
}

interface LiveAssessmentSessionProps {
  baseOpportunity: Opportunity;
  scenarioId: string;
  onScenarioChange: (scenarioId: string) => Promise<void> | void;
  selectedModel: System2ModelOption;
  onModelChange: (model: System2ModelOption) => void;
  onReset: () => Promise<void>;
  isResetting: boolean;
  scenarioError: string | null;
  onClearScenarioError: () => void;
  onRetryScenarioLoad: () => void;
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
  scenarioError,
  onClearScenarioError,
  onRetryScenarioLoad,
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
  const [auditRerunActive, setAuditRerunActive] = useState(false);
  const statusRef = useRef<string>(savedSession ? 'resuming' : 'ready');

  const agent = useEveAgent({
    reducer: assessmentReducer,
    prewarm: true,
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

  const isSubmittingPending = Boolean(
    submittingRequestId &&
      view.pendingInput?.requestId === submittingRequestId &&
      !view.turnCancelled
  );

  const turnInFlight =
    ((agent.status === 'submitted' || agent.status === 'streaming') &&
      (view.phase !== 'awaiting_feedback' || isSubmittingPending)) ||
    isResuming;

  const currentOpportunity = view.opportunity ?? baseOpportunity;

  const isAwaitingFeedback = view.phase === 'awaiting_feedback' && !isSubmittingPending;

  const hasPersistedCompletion =
    !auditRerunActive && Boolean(currentOpportunity.suggested_next_steps);

  // Map real agent session state to WorkflowState
  const workflowState: WorkflowState =
    view.phase === 'assessing'
      ? 'ANALYZING'
      : view.phase === 'submitting_feedback' || (view.phase === 'awaiting_feedback' && isSubmittingPending)
      ? 'EVALUATING'
      : isAwaitingFeedback
      ? 'PENDING_FEEDBACK'
      : view.phase === 'closed' || hasPersistedCompletion
      ? 'COMPLETED'
      : 'READY_TO_ASSESS';

  const isComplete = workflowState === 'COMPLETED';
  const isSynthesizingDiscovery =
    workflowState === 'ANALYZING' && view.jevResult !== null;

  // Desk OS 3-Stage State
  const [activeStageView, setActiveStageView] = useState<'blank' | 'stage1' | 'stage2' | 'stage3'>(
    initialStageView ??
      (workflowState === 'COMPLETED'
        ? 'stage3'
        : workflowState === 'EVALUATING'
        ? 'stage2'
        : workflowState === 'PENDING_FEEDBACK' || isSynthesizingDiscovery
        ? 'stage1'
        : 'blank')
  );

  const [savedFormData, setSavedFormData] = useState<Record<string, string | string[]>>({});
  const [savedManualNotes, setSavedManualNotes] = useState<string>('');
  const [baselineAssessment, setBaselineAssessment] = useState<{
    score: number;
    stageGate?: StageGateEvaluation;
    dimensions: Record<string, any>;
  } | null>(null);

  const prevWorkflowStateRef = useRef<WorkflowState>(workflowState);

  // Synchronize activeStageView with progressive baseline scores & workflowState transitions
  useEffect(() => {
    const prevWorkflow = prevWorkflowStateRef.current;

    if (isSynthesizingDiscovery && activeStageView === 'blank') {
      setActiveStageView('stage1');
    }

    if (prevWorkflow !== workflowState || activeStageView === 'blank') {
      if (workflowState === 'PENDING_FEEDBACK') {
        if (prevWorkflow === 'ANALYZING' || activeStageView === 'blank' || !baselineAssessment) {
          const score = view.jevResult?.overallScore ?? currentOpportunity.meddpicc_score ?? 0;
          const stageGate =
            view.baselineJevResult?.stageGate ??
            view.jevResult?.stageGate ??
            currentOpportunity.stage_gate ??
            currentOpportunity.meddpicc_breakdown?.stageGate;
          setBaselineAssessment({
            score,
            stageGate,
            dimensions: formatDimensionsForScorecard(
              view.jevResult?.dimensions,
              view.system2Result?.dimensionFindings,
              currentOpportunity.meddpicc_breakdown,
              undefined,
              { allowFallbackFindings: Boolean(view.system2Result) }
            ),
          });
          if (activeStageView === 'blank' || prevWorkflow === 'ANALYZING') {
            setActiveStageView('stage1');
          }
        }
      } else if (workflowState === 'EVALUATING') {
        if (activeStageView === 'blank') {
          setActiveStageView('stage2');
        }
      } else if (workflowState === 'COMPLETED') {
        setAuditRerunActive(false);
        if (prevWorkflow === 'EVALUATING' || activeStageView === 'blank' || !baselineAssessment) {
          setActiveStageView('stage3');
        }
      } else if (workflowState === 'READY_TO_ASSESS' && prevWorkflow === 'ANALYZING') {
        // Aborted during initial audit
        setActiveStageView('blank');
        setBaselineAssessment(null);
      }
      prevWorkflowStateRef.current = workflowState;
    }
  }, [
    workflowState,
    isSynthesizingDiscovery,
    activeStageView,
    currentOpportunity.meddpicc_score,
    currentOpportunity.meddpicc_breakdown,
    currentOpportunity.stage_gate,
    view.jevResult,
    view.baselineJevResult,
    view.system2Result,
    baselineAssessment,
  ]);

  const [sendError, setSendError] = useState<{ label: string; text: string } | null>(null);
  const failure = scenarioError
    ? { label: 'Failed to load opportunity:', text: scenarioError }
    : resumeError
    ? { label: 'Could not resume the saved Assessment Session:', text: resumeError }
    : view.phase === 'failed' && view.error
    ? { label: failureLabel(view), text: view.error }
    : sendError ??
      (agent.status === 'error' && agent.error && (view.phase !== 'ready' || Boolean(view.request))
        ? { label: failureLabel(view), text: agent.error.message }
        : null);

  useEffect(() => {
    if (view.legacySession) clearSavedSession(baseOpportunity.id);
  }, [view.legacySession, baseOpportunity.id]);

  const prevPhaseRef = useRef<AssessmentView['phase']>(view.phase);

  useEffect(() => {
    const cancelledFromSubmitting =
      prevPhaseRef.current === 'submitting_feedback' && view.phase === 'awaiting_feedback';
    const staleRequestId = Boolean(
      submittingRequestId && view.pendingInput && view.pendingInput.requestId !== submittingRequestId
    );
    prevPhaseRef.current = view.phase;
    if (
      view.feedback ||
      view.phase === 'closed' ||
      view.phase === 'ready' ||
      view.phase === 'failed' ||
      view.turnCancelled ||
      cancelledFromSubmitting ||
      staleRequestId
    ) {
      clearSubmittingRequestId(baseOpportunity.id);
      setSubmittingRequestId(null);
    }
  }, [view.feedback, view.phase, view.turnCancelled, view.pendingInput, submittingRequestId, baseOpportunity.id]);

  const stopActiveRun = useCallback(async () => {
    const isRunActive =
      turnInFlight ||
      view.phase === 'assessing' ||
      view.phase === 'submitting_feedback';
    if (!isRunActive) return;

    const maybeStop = (agent as unknown as { stop?: () => Promise<unknown> }).stop;
    try {
      if (typeof maybeStop === 'function') {
        await maybeStop();
      } else {
        await agent.cancel();
      }
    } catch {
      // Ignore transport errors when stopping an in-flight run before reset or navigation.
    }
    agent.reset();
  }, [agent, turnInFlight, view.phase]);

  async function handleSafeReset() {
    await stopActiveRun();
    clearSubmittingRequestId(baseOpportunity.id);
    setSubmittingRequestId(null);
    setAuditRerunActive(false);
    await onReset();
  }

  async function handleSafeScenarioChange(nextScenarioId: string) {
    await stopActiveRun();
    clearSubmittingRequestId(baseOpportunity.id);
    setSubmittingRequestId(null);
    setAuditRerunActive(false);
    await onScenarioChange(nextScenarioId);
  }

  async function handleSafeModeChange(nextMode: WorkbenchMode) {
    if (nextMode !== 'live') {
      await stopActiveRun();
      clearSubmittingRequestId(baseOpportunity.id);
      setSubmittingRequestId(null);
    }
    onModeChange?.(nextMode);
  }

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
    const isFreshIdleSession =
      view.phase === 'ready' &&
      !view.request &&
      !view.error &&
      !view.turnCancelled &&
      agent.status === 'ready';

    if (!isFreshIdleSession) {
      agent.reset();
    }

    setAuditRerunActive(true);
    clearSubmittingRequestId(baseOpportunity.id);
    setSubmittingRequestId(null);
    setResumeError(null);
    onClearScenarioError();
    setActiveStageView('blank');
    setBaselineAssessment(null);
    setSavedFormData({});
    setSavedManualNotes('');
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
  const liveScore =
    view.result?.finalScore ??
    view.opportunity?.meddpicc_score ??
    view.jevResult?.overallScore ??
    (auditRerunActive ? 0 : baseOpportunity.meddpicc_score) ??
    0;

  const baselineScore =
    baselineAssessment?.score ??
    view.baselineJevResult?.overallScore ??
    view.result?.baselineScore ??
    null;

  const scoreDelta =
    baselineScore !== null ? liveScore - baselineScore : view.result?.delta ?? null;

  const allowLiveFallbackFindings =
    !isSynthesizingDiscovery &&
    view.phase !== 'assessing' &&
    (Boolean(view.system2Result) || isComplete);

  const liveDimensions = formatDimensionsForScorecard(
    view.jevResult?.dimensions,
    view.system2Result?.dimensionFindings,
    auditRerunActive && !view.opportunity ? undefined : currentOpportunity.meddpicc_breakdown,
    view.baselineJevResult?.dimensions ?? baselineAssessment?.dimensions,
    { allowFallbackFindings: allowLiveFallbackFindings }
  );

  // Baseline Stage 1 dimensions (never polluted by post-rescore 8/10 scores or seeded breakdown gaps)
  const stage1Dimensions = isSynthesizingDiscovery
    ? formatDimensionsForScorecard(
        view.jevResult?.dimensions,
        view.system2Result?.dimensionFindings,
        undefined,
        undefined,
        { allowFallbackFindings: false }
      )
    : baselineAssessment?.dimensions
    ? baselineAssessment.dimensions.identifyPain?.quotes?.length || view.system2Result === null
      ? baselineAssessment.dimensions
      : formatDimensionsForScorecard(
          view.baselineJevResult?.dimensions ?? baselineAssessment.dimensions,
          view.system2Result?.dimensionFindings,
          currentOpportunity.meddpicc_breakdown,
          undefined,
          { allowFallbackFindings: true }
        )
    : formatDimensionsForScorecard(
        view.baselineJevResult?.dimensions ?? view.jevResult?.dimensions,
        view.system2Result?.dimensionFindings,
        currentOpportunity.meddpicc_breakdown,
        undefined,
        { allowFallbackFindings: Boolean(view.system2Result) }
      );

  // Dynamic discovery form is computed ungated by workflowState === 'PENDING_FEEDBACK'
  const dynamicForm = view.system2Result?.phase3Form ?? null;

  const discoveryQuestionCount = dynamicForm?.sections
    ? dynamicForm.sections.reduce((acc, s) => acc + (s.fields?.length || 0), 0)
    : 0;

  const gapCount = stage1Dimensions
    ? Object.values(stage1Dimensions).filter(
        (d: any) => d.score <= 3 || d.status === 'unaddressed'
      ).length
    : 0;

  const stage1StageGate =
    view.baselineJevResult?.stageGate ??
    (isComplete ? baselineAssessment?.stageGate : view.jevResult?.stageGate) ??
    baselineAssessment?.stageGate ??
    currentOpportunity.stage_gate ??
    currentOpportunity.meddpicc_breakdown?.stageGate;

  const stage3StageGate =
    view.jevResult?.stageGate ??
    view.opportunity?.stage_gate ??
    view.opportunity?.meddpicc_breakdown?.stageGate ??
    currentOpportunity.stage_gate ??
    currentOpportunity.meddpicc_breakdown?.stageGate;

  const stage1Score = baselineScore ?? liveScore;

  const unassessedGateReadout = formatStageGateReadout({
    stageName: currentOpportunity.stage_name,
    phase: 'unassessed',
  });

  const stage1GateReadout = formatStageGateReadout({
    stageGate: stage1StageGate,
    qualificationStatus: isComplete ? 'in_review' : currentOpportunity.qualification_status,
    stageName: currentOpportunity.stage_name,
    phase: 'stage1',
    fallbackBlockerCount: gapCount,
  });

  const suggestedNextSteps =
    (auditRerunActive && view.phase !== 'closed' ? null : currentOpportunity.suggested_next_steps) ??
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

  const showStage1 =
    isSynthesizingDiscovery ||
    (activeStageView === 'stage1' && workflowState !== 'ANALYZING');

  return (
    <main className="min-h-screen bg-[#F8F8F6] text-[#111215]">
      {!hideTopNavBar && (
        <TopNavBar
          opportunity={currentOpportunity}
          mode="live"
          onModeChange={handleSafeModeChange}
          currentScenarioId={scenarioId}
          onScenarioChange={handleSafeScenarioChange}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          onReset={handleSafeReset}
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
          activeStageView={isSynthesizingDiscovery ? 'stage1' : activeStageView}
          workflowState={workflowState}
          isComplete={isComplete}
          hasDiscoveryQuestions={isSynthesizingDiscovery || discoveryQuestionCount > 0}
          onSelectStage={(stage: DeskOsStageId) => setActiveStageView(stage)}
          readOnlyRetrospective={isComplete && baselineScore === null}
        />

        {/* Unified Desk OS Workbench Shell */}
        <div className="workbench-shell rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] overflow-hidden">
          {/* Quiet Monochrome Top Bar */}
          <MonochromeTopBar opportunity={currentOpportunity} />

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
                    scenarioError
                      ? onRetryScenarioLoad
                      : view.pendingInput && Object.keys(savedFormData).length > 0
                      ? () => handleSubmitFeedback(savedFormData, savedManualNotes)
                      : handleStartAssessment
                  }
                  onDismiss={() => {
                    setSendError(null);
                    setResumeError(null);
                    onClearScenarioError();
                  }}
                  onSwitchToSimulation={
                    onModeChange ? () => void handleSafeModeChange('simulation') : undefined
                  }
                />
              )}

              {/* 1. Blank Start State */}
              {activeStageView === 'blank' && workflowState === 'READY_TO_ASSESS' && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <div className="flex items-baseline whitespace-nowrap font-sans tabular-nums">
                        <span className="text-2xl font-semibold tracking-[-0.02em] text-[#636772]">
                          --
                        </span>
                        <span className="ml-1 text-sm font-normal text-[#636772]">/ 100</span>
                      </div>
                      <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-[#E2E0D8] shrink-0" />
                      <span className="font-sans text-xs sm:text-sm font-medium text-[#52545D] tabular-nums">
                        {unassessedGateReadout.label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartAssessment}
                      disabled={turnInFlight}
                      aria-label={turnInFlight ? 'Evaluating Opportunity…' : 'Start assessment'}
                      className="btn-action-primary inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#0F52BA] px-4 py-2 font-sans text-xs sm:text-sm font-semibold leading-none text-[#FFFFFF] hover:bg-[#0C4196] active:scale-[0.98] transition cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed"
                    >
                      {turnInFlight ? (
                        <>
                          <span
                            className="inline-block size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                            aria-hidden="true"
                          />
                          <span>Evaluating Opportunity…</span>
                        </>
                      ) : (
                        <span className="ui-pill-label">Run MEDDPICC Deal Audit →</span>
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

              {/* 2. Phase A: Initial Rubric Scan (before jevResult arrives) */}
              {workflowState === 'ANALYZING' && !isSynthesizingDiscovery && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                    <div className="flex items-center gap-2.5">
                      <Loader2
                        className="size-4 shrink-0 animate-spin text-[#52545D]"
                        aria-hidden="true"
                      />
                      <span
                        className="font-sans text-sm font-medium text-[#111215]"
                        role="status"
                        aria-live="polite"
                      >
                        Scanning MEDDPICC rubric…
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void agent.cancel();
                      }}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#111215] hover:bg-[#F1F0EC] transition cursor-pointer"
                    >
                      <Ban className="size-3.5 shrink-0 text-[#52545D]" aria-hidden="true" />
                      <span className="ui-pill-label">Abort</span>
                    </button>
                  </div>

                  <MeddpiccScorecard
                    mode="loading"
                    score={0}
                    dimensions={liveDimensions}
                    hideHeader={true}
                  />
                </div>
              )}

              {/* 3. Stage 1: Initial Deal Audit (Unblocks IMMEDIATELY on jevResult!) */}
              {showStage1 && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <div className="flex items-baseline whitespace-nowrap font-sans tabular-nums">
                        <span className="text-2xl font-semibold tracking-[-0.02em] text-[#111215]">
                          {stage1Score}
                        </span>
                        <span className="ml-1 text-sm font-normal text-[#636772]">/ 100</span>
                      </div>
                      <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-[#E2E0D8] shrink-0" />
                      <span
                        className={`font-sans text-xs sm:text-sm font-medium tabular-nums ${
                          stage1GateReadout.isSatisfied ? 'text-[#111215]' : 'text-[#52545D]'
                        }`}
                      >
                        {stage1GateReadout.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isComplete && !isSynthesizingDiscovery && (
                        <button
                          type="button"
                          onClick={() => setActiveStageView('stage3')}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer"
                        >
                          <span className="ui-pill-label">
                            Return to Updated Assessment (Stage 3) →
                          </span>
                        </button>
                      )}

                      {isSynthesizingDiscovery ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void agent.cancel();
                            }}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-2 font-sans text-xs font-medium leading-none text-[#111215] hover:bg-[#F1F0EC] transition cursor-pointer"
                          >
                            <Ban className="size-3.5 shrink-0 text-[#52545D]" aria-hidden="true" />
                            <span className="ui-pill-label">Abort</span>
                          </button>

                          <button
                            type="button"
                            disabled={true}
                            aria-busy="true"
                            className="btn-action-primary inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#0F52BA] px-4 py-2 font-sans text-xs sm:text-sm font-semibold leading-none text-[#FFFFFF] cursor-not-allowed"
                          >
                            <span
                              className="inline-block size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
                              aria-hidden="true"
                            />
                            <span role="status">Generating Discovery Checklist…</span>
                          </button>
                        </>
                      ) : discoveryQuestionCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setActiveStageView('stage2')}
                          className="btn-action-primary inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-[#0F52BA] px-4 py-2 font-sans text-xs sm:text-sm font-semibold leading-none text-[#FFFFFF] hover:bg-[#0C4196] active:scale-[0.98] transition cursor-pointer"
                        >
                          <span className="ui-pill-label">
                            Answer {discoveryQuestionCount} Discovery{' '}
                            {discoveryQuestionCount === 1 ? 'Question' : 'Questions'} →
                          </span>
                        </button>
                      ) : (
                        <span className="font-sans text-xs sm:text-sm font-medium text-[#52545D]">
                          No Open Discovery Questions
                        </span>
                      )}
                    </div>
                  </div>

                  <MeddpiccScorecard
                    mode={isSynthesizingDiscovery ? 'analyzing' : 'audit'}
                    score={stage1Score}
                    dimensions={stage1Dimensions}
                    hideHeader={true}
                  />
                </div>
              )}

              {/* 4. Stage 2: Field Discovery Checklist & Phase C Re-scoring */}
              {activeStageView === 'stage2' && workflowState !== 'ANALYZING' && (
                <div className="space-y-4">
                  {workflowState === 'EVALUATING' ? (
                    <div className="space-y-4">
                      <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                        <div className="flex items-center gap-2.5">
                          <Loader2
                            className="size-4 shrink-0 animate-spin text-[#52545D]"
                            aria-hidden="true"
                          />
                          <span
                            className="font-sans text-sm font-medium text-[#111215]"
                            role="status"
                            aria-live="polite"
                          >
                            Re-scoring Deal &amp; Updating CRM…
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            clearSubmittingRequestId(baseOpportunity.id);
                            setSubmittingRequestId(null);
                            void agent.cancel();
                          }}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#111215] hover:bg-[#F1F0EC] transition cursor-pointer"
                        >
                          <Ban className="size-3.5 shrink-0 text-[#52545D]" aria-hidden="true" />
                          <span className="ui-pill-label">Abort</span>
                        </button>
                      </div>

                      <MeddpiccScorecard
                        mode="loading"
                        dimensions={liveDimensions}
                        hideHeader={true}
                      />
                    </div>
                  ) : (
                    <>
                      {isComplete && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setActiveStageView('stage3')}
                            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer"
                          >
                            <span className="ui-pill-label">
                              Return to Updated Assessment (Stage 3) →
                            </span>
                          </button>
                        </div>
                      )}

                      <DynamicDiscoveryForm
                        dynamicForm={dynamicForm}
                        initialValues={savedFormData}
                        initialNotes={savedManualNotes}
                        dimensions={stage1Dimensions}
                        readOnly={isRetrospectiveReadOnly}
                        isLocked={turnInFlight}
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
                    stageGate={stage3StageGate}
                    qualificationStatus={currentOpportunity.qualification_status}
                    stageName={currentOpportunity.stage_name}
                    gapCount={gapCount}
                    onReset={handleSafeReset}
                    resetButtonText="Reset Opportunity Baseline"
                    onRerunAudit={handleStartAssessment}
                    rerunDisabled={turnInFlight}
                  />

                  {/* Suggested Next Steps Block Directly Above the Scorecard */}
                  <SuggestedNextStepsCard
                    nextSteps={suggestedNextSteps}
                    score={liveScore}
                    qualificationStatus={currentOpportunity.qualification_status}
                    stageGate={stage3StageGate}
                    syncMode="live"
                    fallbackMetadata={
                      view.system2Result
                        ? {
                            owner: currentOpportunity.sa_name
                              ? `${currentOpportunity.sa_name} (SA)`
                              : undefined,
                            focus: view.system2Result.valueFocus,
                            watch: view.system2Result.primaryRisk,
                          }
                        : undefined
                    }
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
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-[#E2E0D8] bg-white px-4 py-2.5 font-sans text-xs font-medium leading-none text-[#111215] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-[#111215]" aria-hidden="true" />
          <span className="ui-pill-label">{toastMessage}</span>
        </div>
      )}
    </main>
  );
}
