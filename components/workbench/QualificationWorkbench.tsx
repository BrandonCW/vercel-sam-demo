'use client';

import React, { useCallback, useEffect, useReducer, useRef, useState, useTransition } from 'react';
import { Ban, Loader2 } from 'lucide-react';
import type { Opportunity, StageGateEvaluation } from '@/lib/types/crm';
import { DEFAULT_SYSTEM2_MODEL, type System2ModelOption } from '@/lib/types/crm';
import type { SimulationDimension, WorkflowState, WorkbenchMode } from '@/lib/simulation/types';
import type { SimulationFixture } from '@/lib/simulation/fixture-schema';
import {
  createSimulationState,
  getSimulationFixture,
  simulationReducer,
} from '@/lib/simulation/simulation-engine';

import { TopNavBar } from './TopNavBar';
import { StepperBar, type DeskOsStageId } from './StepperBar';
import { DealContextCard } from './DealContextCard';
import { MeddpiccScorecard } from './MeddpiccScorecard';
import { DynamicDiscoveryForm } from './DynamicDiscoveryForm';
import { LiveQualificationWorkbench } from './LiveQualificationWorkbench';
import {
  MonochromeTopBar,
  SuggestedNextStepsCard,
  Stage3HeaderLockup,
  formatStageGateReadout,
} from './desk-os-shared';

interface QualificationWorkbenchProps {
  initialOpportunity: Opportunity;
  initialScenarioId?: string;
}

interface SimProgressiveBaseline {
  score: number;
  stageGate: StageGateEvaluation;
  dimensions: Record<string, SimulationDimension>;
}

function buildProgressiveBaseline(fixture: SimulationFixture): SimProgressiveBaseline {
  const dimensions: Record<string, SimulationDimension> = {};
  for (const [key, dim] of Object.entries(fixture.baseline.jevResult.dimensions)) {
    dimensions[key] = {
      key,
      label: dim.label || key,
      weight: dim.weight ?? 0.1,
      score: dim.score,
      status: dim.status,
      confidence: dim.confidence,
      quotes: [],
      gaps: [],
    };
  }
  return {
    score: fixture.baseline.jevResult.overallScore,
    stageGate: fixture.baseline.jevResult.stageGate,
    dimensions,
  };
}

export function QualificationWorkbench({
  initialOpportunity,
  initialScenarioId = 'scenario_acme_netlify',
}: QualificationWorkbenchProps) {
  const [mode, setMode] = useState<WorkbenchMode>('simulation');
  const [scenarioId, setScenarioId] = useState<string>(initialScenarioId);
  const [selectedModel, setSelectedModel] = useState<System2ModelOption>(DEFAULT_SYSTEM2_MODEL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [activeFixture, setActiveFixture] = useState<SimulationFixture>(() =>
    getSimulationFixture(initialScenarioId)
  );

  // Desk OS 3-Stage State
  const [activeStageView, setActiveStageView] = useState<'blank' | 'stage1' | 'stage2' | 'stage3'>(
    'blank'
  );
  const [savedFormData, setSavedFormData] = useState<Record<string, string | string[]>>({});
  const [savedManualNotes, setSavedManualNotes] = useState<string>('');
  const [baselineAssessment, setBaselineAssessment] = useState<{
    score: number;
    stageGate?: StageGateEvaluation;
    dimensions: Record<string, SimulationDimension>;
  } | null>(null);
  const [simProgressiveBaseline, setSimProgressiveBaseline] =
    useState<SimProgressiveBaseline | null>(null);

  const [, startTransition] = useTransition();
  const step1TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step2TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulation State Machine
  const [simState, dispatch] = useReducer(
    (state: any, action: any) => simulationReducer(state, action, activeFixture),
    activeFixture,
    createSimulationState
  );

  const prevWorkflowStateRef = useRef<WorkflowState>(simState.workflowState);

  const isComplete = simState.workflowState === 'COMPLETED';
  const isBusy = simState.workflowState === 'ANALYZING' || simState.workflowState === 'EVALUATING';
  const isSynthesizingProgressive =
    simState.workflowState === 'ANALYZING' && simProgressiveBaseline !== null;

  const prevInitialScenarioIdRef = useRef(initialScenarioId);

  const clearSimTimers = useCallback(() => {
    if (step1TimerRef.current) {
      clearTimeout(step1TimerRef.current);
      step1TimerRef.current = null;
    }
    if (step2TimerRef.current) {
      clearTimeout(step2TimerRef.current);
      step2TimerRef.current = null;
    }
  }, []);

  const handleScenarioChange = useCallback(
    (newScenarioId: string) => {
      clearSimTimers();
      setSimProgressiveBaseline(null);
      const newFixture = getSimulationFixture(newScenarioId);
      setScenarioId(newScenarioId);
      setActiveFixture(newFixture);
      setSavedFormData({});
      setSavedManualNotes('');
      setBaselineAssessment(null);
      setActiveStageView('blank');

      if (mode === 'simulation') {
        dispatch({ type: 'SWITCH_SCENARIO', scenarioId: newScenarioId, fixture: newFixture });
      }
    },
    [clearSimTimers, mode]
  );

  useEffect(() => {
    if (initialScenarioId && initialScenarioId !== prevInitialScenarioIdRef.current) {
      prevInitialScenarioIdRef.current = initialScenarioId;
      handleScenarioChange(initialScenarioId);
    }
  }, [initialScenarioId, handleScenarioChange]);

  // Synchronize activeStageView with WorkflowState transitions guarded by prevWorkflowStateRef
  useEffect(() => {
    const prevWorkflow = prevWorkflowStateRef.current;
    const currentWorkflow = simState.workflowState;

    if (prevWorkflow !== currentWorkflow) {
      if (currentWorkflow === 'PENDING_FEEDBACK' && prevWorkflow === 'ANALYZING') {
        setBaselineAssessment({
          score: simState.score,
          stageGate: simState.stageGate,
          dimensions: simState.dimensions,
        });
        setActiveStageView('stage1');
      } else if (currentWorkflow === 'COMPLETED' && prevWorkflow === 'EVALUATING') {
        setActiveStageView('stage3');
      } else if (currentWorkflow === 'READY_TO_ASSESS') {
        setActiveStageView('blank');
        setBaselineAssessment(null);
        setSimProgressiveBaseline(null);
        setSavedFormData({});
        setSavedManualNotes('');
      }
      prevWorkflowStateRef.current = currentWorkflow;
    }
  }, [simState.workflowState, simState.score, simState.stageGate, simState.dimensions]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearSimTimers();
    };
  }, [clearSimTimers]);

  function handleAbortSimulation() {
    clearSimTimers();
    setSimProgressiveBaseline(null);
    if (simState.workflowState === 'ANALYZING') {
      dispatch({ type: 'STEP_BACK' });
      setActiveStageView('blank');
    } else if (simState.workflowState === 'EVALUATING') {
      dispatch({ type: 'STEP_BACK' });
      setActiveStageView('stage2');
    }
  }

  function handleReset() {
    clearSimTimers();
    setSimProgressiveBaseline(null);
    setIsResetting(true);
    setSavedFormData({});
    setSavedManualNotes('');
    setBaselineAssessment(null);
    setActiveStageView('blank');

    if (mode === 'simulation') {
      dispatch({ type: 'RESET', fixture: activeFixture });
      setTimeout(() => setIsResetting(false), 300);
    } else {
      fetch('/api/crm/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      })
        .then((res) => res.json())
        .catch(() => {})
        .finally(() => setIsResetting(false));
    }
  }

  function scheduleProgressiveAudit(fixtureForRun: SimulationFixture) {
    clearSimTimers();
    setSimProgressiveBaseline(null);

    // Step 1 (~350ms): baseline MEDDPICC rubric scores unlock Stage 1 immediately
    step1TimerRef.current = setTimeout(() => {
      step1TimerRef.current = null;
      startTransition(() => {
        setSimProgressiveBaseline(buildProgressiveBaseline(fixtureForRun));
        setActiveStageView('stage1');
      });
    }, 350);

    // Step 2 (~950ms): buyer citations & targeted discovery checklist hydrate
    step2TimerRef.current = setTimeout(() => {
      step2TimerRef.current = null;
      startTransition(() => {
        setSimProgressiveBaseline(null);
        dispatch({ type: 'ANALYSIS_COMPLETE' });
      });
    }, 950);
  }

  function handleStartAssessment() {
    dispatch({ type: 'START_ASSESSMENT' });
    scheduleProgressiveAudit(activeFixture);
  }

  function handleRerunSimulationAudit() {
    clearSimTimers();
    setSimProgressiveBaseline(null);
    setBaselineAssessment(null);
    dispatch({ type: 'JUMP_TO_STATE', target: 'ANALYZING' });
    setActiveStageView('blank');
    scheduleProgressiveAudit(activeFixture);
  }

  function handleSubmitFeedback(
    responses: Record<string, string | string[]>,
    notesDelta?: string
  ) {
    clearSimTimers();
    setSavedFormData(responses);
    if (notesDelta !== undefined) setSavedManualNotes(notesDelta);

    dispatch({ type: 'SUBMIT_FEEDBACK', formResponses: responses, notesDelta });
    step2TimerRef.current = setTimeout(() => {
      startTransition(() => {
        dispatch({ type: 'EVALUATION_COMPLETE' });
        step2TimerRef.current = null;
      });
    }, 950);
  }

  const currentOpportunity = mode === 'simulation' ? simState.opportunity : initialOpportunity;

  const stage1Dimensions =
    simProgressiveBaseline?.dimensions ??
    baselineAssessment?.dimensions ??
    simState.dimensions;

  const stage1StageGate =
    simProgressiveBaseline?.stageGate ??
    baselineAssessment?.stageGate ??
    simState.stageGate;

  // Compute blocker count for Stage 1 summary
  const gapCount = stage1Dimensions
    ? Object.values(stage1Dimensions).filter(
        (d: any) => d.score <= 3 || d.status === 'unaddressed'
      ).length
    : 0;

  const discoveryQuestionCount = simState.discoveryForm?.sections
    ? simState.discoveryForm.sections.reduce(
        (acc: number, s: any) => acc + (s.fields?.length || 0),
        0
      )
    : 0;

  const currentScore =
    simProgressiveBaseline !== null
      ? simProgressiveBaseline.score
      : activeStageView === 'blank'
      ? 0
      : activeStageView === 'stage1'
      ? baselineAssessment?.score ?? simState.score
      : simState.score;

  const previousScoreDisplay =
    baselineAssessment?.score ??
    simState.previousScore ??
    activeFixture.baseline.jevResult.overallScore;
  const scoreDeltaDisplay = simState.delta ?? simState.score - previousScoreDisplay;

  const stage1GateReadout = formatStageGateReadout({
    stageGate: stage1StageGate,
    qualificationStatus: currentOpportunity.qualification_status,
    stageName: currentOpportunity.stage_name,
    phase: 'stage1',
    fallbackBlockerCount: gapCount,
  });

  const unassessedGateReadout = formatStageGateReadout({
    stageName: currentOpportunity.stage_name,
    phase: 'unassessed',
  });

  if (mode === 'live') {
    return (
      <LiveQualificationWorkbench
        initialOpportunity={initialOpportunity}
        initialScenarioId={scenarioId}
        scenarioId={scenarioId}
        onScenarioChange={handleScenarioChange}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onModeChange={setMode}
        hideTopNavBar={false}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />
    );
  }

  const showStage1 =
    isSynthesizingProgressive ||
    (activeStageView === 'stage1' && simState.workflowState !== 'ANALYZING');

  return (
    <main className="min-h-screen bg-[#F8F8F6] text-[#111215]">
      <TopNavBar
        opportunity={currentOpportunity}
        mode={mode}
        onModeChange={setMode}
        currentScenarioId={scenarioId}
        onScenarioChange={handleScenarioChange}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onReset={handleReset}
        isResetting={isResetting}
        controlsLocked={isBusy}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-6">
        {/* Desk OS 3-Stage Tactile Stepper */}
        <StepperBar
          activeStageView={isSynthesizingProgressive ? 'stage1' : activeStageView}
          workflowState={simState.workflowState}
          isComplete={isComplete}
          hasDiscoveryQuestions={isSynthesizingProgressive || discoveryQuestionCount > 0}
          onSelectStage={(stage: DeskOsStageId) => setActiveStageView(stage)}
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
              {/* 1. Blank Start State (Pre-Audit) */}
              {activeStageView === 'blank' && simState.workflowState === 'READY_TO_ASSESS' && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex min-h-9 flex-wrap items-center gap-2.5 sm:gap-3">
                      <div className="flex items-center whitespace-nowrap font-sans tabular-nums">
                        <span className="text-sm leading-5 font-medium text-[#636772]">
                          – / 100
                        </span>
                      </div>
                      <span aria-hidden="true" className="hidden sm:block h-3.5 w-px bg-[#E2E0D8] shrink-0" />
                      <span className="font-sans text-sm leading-5 font-medium text-[#52545D] tabular-nums">
                        {unassessedGateReadout.label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartAssessment}
                      aria-label="Start assessment"
                      className="btn-action-primary inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#0F52BA] px-4 py-2 font-sans text-xs sm:text-sm font-semibold leading-none text-[#FFFFFF] hover:bg-[#0C4196] active:scale-[0.98] transition cursor-pointer"
                    >
                      <span className="ui-pill-label">Run MEDDPICC Deal Audit →</span>
                    </button>
                  </div>

                  <MeddpiccScorecard
                    mode="unassessed"
                    score={0}
                    dimensions={simState.dimensions}
                    hideHeader={true}
                  />
                </div>
              )}

              {/* 2. Phase A: Initial Rubric Scan (0–350ms before baseline scores hydrate) */}
              {simState.workflowState === 'ANALYZING' && !isSynthesizingProgressive && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex min-h-9 items-center gap-2.5">
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
                      onClick={handleAbortSimulation}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#111215] hover:bg-[#F1F0EC] transition cursor-pointer"
                    >
                      <Ban className="size-3.5 shrink-0 text-[#52545D]" aria-hidden="true" />
                      <span className="ui-pill-label">Abort</span>
                    </button>
                  </div>

                  <MeddpiccScorecard
                    mode="loading"
                    dimensions={simState.dimensions}
                    hideHeader={true}
                  />
                </div>
              )}

              {/* 3. Stage 1: Initial Deal Audit (Unlocks immediately on baseline scores) */}
              {showStage1 && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex min-h-9 flex-wrap items-center gap-2.5 sm:gap-3">
                      <div className="flex items-center whitespace-nowrap font-sans tabular-nums">
                        <span className="text-sm leading-5 font-semibold text-[#111215]">
                          {currentScore}
                        </span>
                        <span className="ml-1 text-sm leading-5 font-medium text-[#636772]">/ 100</span>
                      </div>
                      <span aria-hidden="true" className="hidden sm:block h-3.5 w-px bg-[#E2E0D8] shrink-0" />
                      <span
                        className={`font-sans text-sm leading-5 font-medium tabular-nums ${
                          stage1GateReadout.isSatisfied ? 'text-[#111215]' : 'text-[#52545D]'
                        }`}
                      >
                        {stage1GateReadout.label}
                      </span>
                    </div>

                    <div className="flex min-h-9 flex-wrap items-center gap-2">
                      {isComplete && !isSynthesizingProgressive && (
                        <button
                          type="button"
                          onClick={() => setActiveStageView('stage3')}
                          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer"
                        >
                          <span className="ui-pill-label">
                            Return to Updated Assessment (Stage 3) →
                          </span>
                        </button>
                      )}

                      {isSynthesizingProgressive ? (
                        <>
                          <button
                            type="button"
                            onClick={handleAbortSimulation}
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
                        <span className="inline-flex min-h-9 items-center font-sans text-xs sm:text-sm font-medium text-[#52545D]">
                          No Open Discovery Questions
                        </span>
                      )}
                    </div>
                  </div>

                  <MeddpiccScorecard
                    mode={isSynthesizingProgressive ? 'analyzing' : 'audit'}
                    score={currentScore}
                    dimensions={stage1Dimensions}
                    hideHeader={true}
                  />
                </div>
              )}

              {/* 4. Stage 2: Field Discovery Checklist & Phase C Re-scoring */}
              {activeStageView === 'stage2' && simState.workflowState !== 'ANALYZING' && (
                <div className="space-y-4">
                  {simState.workflowState === 'EVALUATING' ? (
                    <div className="space-y-4">
                      <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex min-h-9 items-center gap-2.5">
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
                          onClick={handleAbortSimulation}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#111215] hover:bg-[#F1F0EC] transition cursor-pointer"
                        >
                          <Ban className="size-3.5 shrink-0 text-[#52545D]" aria-hidden="true" />
                          <span className="ui-pill-label">Abort</span>
                        </button>
                      </div>

                      <MeddpiccScorecard
                        mode="loading"
                        dimensions={simState.dimensions}
                        hideHeader={true}
                      />
                    </div>
                  ) : (
                    <DynamicDiscoveryForm
                      dynamicForm={simState.discoveryForm}
                      initialValues={savedFormData}
                      initialNotes={savedManualNotes}
                      dimensions={baselineAssessment?.dimensions ?? simState.dimensions}
                      onBack={() => setActiveStageView('stage1')}
                      onCancel={() => setActiveStageView('stage1')}
                      onReturnToStage3={isComplete ? () => setActiveStageView('stage3') : undefined}
                      onDraftChange={(answers, notes) => {
                        setSavedFormData(answers);
                        setSavedManualNotes(notes);
                      }}
                      onSubmit={handleSubmitFeedback}
                    />
                  )}
                </div>
              )}

              {/* 5. Stage 3: Updated Assessment & Next Steps */}
              {activeStageView === 'stage3' && isComplete && (
                <div className="space-y-5">
                  <Stage3HeaderLockup
                    score={simState.score}
                    baselineScore={baselineAssessment?.score ?? simState.previousScore}
                    scoreDelta={scoreDeltaDisplay}
                    stageGate={simState.stageGate}
                    qualificationStatus={currentOpportunity.qualification_status}
                    stageName={currentOpportunity.stage_name}
                    gapCount={gapCount}
                    onReset={handleReset}
                    resetButtonText="Reset Opportunity Baseline"
                    onRerunAudit={handleRerunSimulationAudit}
                  />

                  <SuggestedNextStepsCard
                    nextSteps={simState.suggestedNextSteps}
                    score={simState.score}
                    qualificationStatus={currentOpportunity.qualification_status}
                    stageGate={simState.stageGate}
                    syncMode="simulation"
                    fallbackMetadata={{
                      owner: currentOpportunity.sa_name
                        ? `${currentOpportunity.sa_name} (SA)`
                        : undefined,
                      focus: activeFixture.baseline.system2Result.valueFocus,
                      watch: activeFixture.baseline.system2Result.primaryRisk,
                    }}
                  />

                  <MeddpiccScorecard
                    mode="completed"
                    score={simState.score}
                    previousScore={previousScoreDisplay}
                    delta={scoreDeltaDisplay}
                    dimensions={simState.dimensions}
                    hideHeader={true}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
