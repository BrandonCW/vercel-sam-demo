'use client';

import React, { useCallback, useEffect, useReducer, useRef, useState, useTransition } from 'react';
import { Ban } from 'lucide-react';
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
  const [activeStageView, setActiveStageView] = useState<'blank' | 'stage1' | 'stage2' | 'stage3'>('blank');
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
    ? simState.discoveryForm.sections.reduce((acc: number, s: any) => acc + (s.fields?.length || 0), 0)
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
    baselineAssessment?.score ?? simState.previousScore ?? activeFixture.baseline.jevResult.overallScore;
  const scoreDeltaDisplay = simState.delta ?? (simState.score - previousScoreDisplay);

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
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                    <div className="score-lockup flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="font-mono text-2xl font-bold tracking-tight text-[#787C87]">
                          --
                        </span>
                        <span className="text-sm font-normal text-[#787C87]">/ 100</span>
                      </div>
                      <span className="mono-pill rounded-[4px] border border-[#E2E0D8] bg-[#F1F0EC] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#52545D]">
                        {unassessedGateReadout.label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartAssessment}
                      aria-label="Start assessment"
                      className="btn-action-primary flex items-center justify-center gap-2 rounded-md bg-[#0F52BA] px-4 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#0C4196] cursor-pointer"
                    >
                      <span>Run MEDDPICC Deal Audit →</span>
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

              {/* 2. Baseline Rubric Scoring Loading (0–350ms before baseline scores hydrate) */}
              {simState.workflowState === 'ANALYZING' && !isSynthesizingProgressive && (
                <div className="space-y-4">
                  <MeddpiccScorecard
                    mode="loading"
                    loadingStatus="Scanning AE & SA notes against MEDDPICC rubric…"
                    dimensions={simState.dimensions}
                    hideHeader={true}
                    onAbort={handleAbortSimulation}
                  />
                </div>
              )}

              {/* 3. Stage 1: Initial Deal Audit (Unlocks immediately on baseline scores) */}
              {showStage1 && (
                <div className="space-y-4">
                  <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                    <div className="score-lockup flex flex-wrap items-center gap-3">
                      <span className="font-mono text-2xl font-bold tracking-tight text-[#111215] tabular-nums">
                        {currentScore}
                      </span>
                      <span className="text-sm font-normal text-[#787C87]">/ 100</span>
                      <span
                        className={`mono-pill rounded-[4px] border border-[#E2E0D8] bg-[#F1F0EC] px-2.5 py-1 font-mono text-[11px] font-semibold ${
                          stage1GateReadout.isSatisfied ? 'text-[#111215]' : 'text-[#52545D]'
                        }`}
                      >
                        {stage1GateReadout.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isComplete && !isSynthesizingProgressive && (
                        <button
                          type="button"
                          onClick={() => setActiveStageView('stage3')}
                          className="flex items-center gap-1 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#52545D] hover:bg-[#F1F0EC] cursor-pointer"
                        >
                          <span>Return to Updated Assessment (Stage 3) →</span>
                        </button>
                      )}

                      {isSynthesizingProgressive ? (
                        <>
                          <button
                            type="button"
                            onClick={handleAbortSimulation}
                            className="flex items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#111215] hover:bg-[#F1F0EC] cursor-pointer"
                          >
                            <Ban className="size-3 text-[#52545D]" aria-hidden="true" />
                            <span>Abort</span>
                          </button>

                          <button
                            type="button"
                            disabled={true}
                            aria-busy="true"
                            className="btn-action-primary flex items-center justify-center gap-2 rounded-md bg-[#0F52BA] px-4 py-2 text-xs font-semibold text-[#FFFFFF] opacity-75 cursor-not-allowed"
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
                          className="btn-action-primary flex items-center justify-center gap-1.5 rounded-md bg-[#0F52BA] px-4 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[#0C4196] cursor-pointer"
                        >
                          <span>
                            Answer {discoveryQuestionCount} Discovery{' '}
                            {discoveryQuestionCount === 1 ? 'Question' : 'Questions'} →
                          </span>
                        </button>
                      ) : (
                        <span className="rounded-[4px] border border-[#E2E0D8] bg-[#F1F0EC] px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[#52545D]">
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

                  {/* Stage 1 Bottom Summary Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-[#E2E0D8] bg-[#F8F8F6] p-3.5">
                    <span className="text-xs text-[#787C87]">
                      {stage1GateReadout.isSatisfied
                        ? `All ${stage1GateReadout.gateLabel} exit criteria verified in baseline scoring.`
                        : `${stage1GateReadout.blockerCount} qualification ${
                            stage1GateReadout.blockerCount === 1 ? 'blocker' : 'blockers'
                          } preventing ${stage1GateReadout.gateLabel} advancement.`}
                    </span>

                    {!isSynthesizingProgressive && discoveryQuestionCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveStageView('stage2')}
                        className="flex items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#111215] hover:bg-[#F1F0EC] cursor-pointer"
                      >
                        <span>Proceed to Stage 2: Field Discovery →</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Stage 2: Field Discovery Checklist */}
              {activeStageView === 'stage2' && simState.workflowState !== 'ANALYZING' && (
                <div className="space-y-4">
                  {simState.workflowState === 'EVALUATING' ? (
                    <MeddpiccScorecard
                      mode="loading"
                      loadingStatus="Re-scoring Deal & Updating CRM…"
                      dimensions={simState.dimensions}
                      hideHeader={true}
                      onAbort={handleAbortSimulation}
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
                        dynamicForm={simState.discoveryForm}
                        initialValues={savedFormData}
                        initialNotes={savedManualNotes}
                        dimensions={baselineAssessment?.dimensions ?? simState.dimensions}
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

                  {/* Suggested Next Steps Block Directly Above the Scorecard */}
                  <SuggestedNextStepsCard
                    nextSteps={simState.suggestedNextSteps}
                    score={simState.score}
                    qualificationStatus={currentOpportunity.qualification_status}
                    stageGate={simState.stageGate}
                    syncMode="simulation"
                  />

                  {/* Upgraded 8-Row MEDDPICC Scorecard */}
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
