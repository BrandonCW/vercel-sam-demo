'use client';

import React, { useEffect, useReducer, useRef, useState, useTransition } from 'react';
import type { Opportunity } from '@/lib/types/crm';
import { DEFAULT_SYSTEM2_MODEL, type System2ModelOption } from '@/lib/types/crm';
import type { WorkflowState, WorkbenchMode } from '@/lib/simulation/types';
import acmeFixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';
import type { SimulationFixture } from '@/lib/simulation/fixture-schema';
import {
  createSimulationState,
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
  STAGE_GATE_THRESHOLD,
} from './desk-os-shared';
import { ArrowLeft, RotateCcw, ArrowRight } from 'lucide-react';

interface QualificationWorkbenchProps {
  initialOpportunity: Opportunity;
  initialScenarioId?: string;
}

const fixture = acmeFixtureRaw as SimulationFixture;

export function QualificationWorkbench({
  initialOpportunity,
  initialScenarioId = 'scenario_acme_netlify',
}: QualificationWorkbenchProps) {
  const [mode, setMode] = useState<WorkbenchMode>('simulation');
  const [scenarioId, setScenarioId] = useState<string>(initialScenarioId);
  const [selectedModel, setSelectedModel] = useState<System2ModelOption>(DEFAULT_SYSTEM2_MODEL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Desk OS 3-Stage State
  const [activeStageView, setActiveStageView] = useState<'blank' | 'stage1' | 'stage2' | 'stage3'>('blank');
  const [savedFormData, setSavedFormData] = useState<Record<string, string | string[]>>({});
  const [savedManualNotes, setSavedManualNotes] = useState<string>('');
  const [baselineAssessment, setBaselineAssessment] = useState<{
    score: number;
    dimensions: any;
  } | null>(null);

  const [, startTransition] = useTransition();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Simulation State Machine
  const [simState, dispatch] = useReducer(
    (state: any, action: any) => simulationReducer(state, action, fixture),
    fixture,
    createSimulationState
  );

  const prevWorkflowStateRef = useRef<WorkflowState>(simState.workflowState);

  const isComplete = simState.workflowState === 'COMPLETED';
  const isBusy = simState.workflowState === 'ANALYZING' || simState.workflowState === 'EVALUATING';

  // Synchronize activeStageView with WorkflowState transitions guarded by prevWorkflowStateRef
  useEffect(() => {
    const prevWorkflow = prevWorkflowStateRef.current;
    const currentWorkflow = simState.workflowState;

    if (prevWorkflow !== currentWorkflow) {
      if (currentWorkflow === 'ANALYZING') {
        // Analyzing in-place
      } else if (currentWorkflow === 'PENDING_FEEDBACK' && prevWorkflow === 'ANALYZING') {
        setBaselineAssessment({
          score: simState.score,
          dimensions: simState.dimensions,
        });
        setActiveStageView('stage1');
      } else if (currentWorkflow === 'COMPLETED' && prevWorkflow === 'EVALUATING') {
        setActiveStageView('stage3');
      } else if (currentWorkflow === 'READY_TO_ASSESS') {
        setActiveStageView('blank');
        setBaselineAssessment(null);
        setSavedFormData({});
        setSavedManualNotes('');
      }
      prevWorkflowStateRef.current = currentWorkflow;
    }
  }, [simState.workflowState, simState.score, simState.dimensions]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function handleReset() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsResetting(true);
    setSavedFormData({});
    setSavedManualNotes('');
    setBaselineAssessment(null);
    setActiveStageView('blank');

    if (mode === 'simulation') {
      dispatch({ type: 'RESET' });
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

  function handleStartAssessment() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    dispatch({ type: 'START_ASSESSMENT' });
    timerRef.current = setTimeout(() => {
      startTransition(() => {
        dispatch({ type: 'ANALYSIS_COMPLETE' });
        timerRef.current = null;
      });
    }, 1200);
  }

  function handleSubmitFeedback(
    responses: Record<string, string | string[]>,
    notesDelta?: string
  ) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSavedFormData(responses);
    if (notesDelta !== undefined) setSavedManualNotes(notesDelta);

    dispatch({ type: 'SUBMIT_FEEDBACK', formResponses: responses, notesDelta });
    timerRef.current = setTimeout(() => {
      startTransition(() => {
        dispatch({ type: 'EVALUATION_COMPLETE' });
        timerRef.current = null;
      });
    }, 1200);
  }

  const currentOpportunity = mode === 'simulation' ? simState.opportunity : initialOpportunity;

  // Compute gap count for Stage 1 blocker pill
  const gapCount = simState.dimensions
    ? Object.values(simState.dimensions).filter(
        (d: any) => d.score <= 3 || d.status === 'unaddressed' || (d.gaps && d.gaps.length > 0)
      ).length
    : 3;

  const currentScore =
    activeStageView === 'blank'
      ? 0
      : activeStageView === 'stage1'
      ? baselineAssessment?.score ?? simState.score
      : simState.score;

  const previousScoreDisplay =
    baselineAssessment?.score ?? simState.previousScore ?? 54;
  const scoreDeltaDisplay = simState.delta ?? (simState.score - previousScoreDisplay);

  return (
    <main className="min-h-screen bg-[#F8F8F6] text-[#111215]">
      <TopNavBar
        opportunity={currentOpportunity}
        mode={mode}
        onModeChange={setMode}
        currentScenarioId={scenarioId}
        onScenarioChange={setScenarioId}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onReset={handleReset}
        isResetting={isResetting}
        controlsLocked={isBusy}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />

      {mode === 'live' ? (
        <LiveQualificationWorkbench
          initialOpportunity={initialOpportunity}
          initialScenarioId={scenarioId}
          scenarioId={scenarioId}
          onScenarioChange={setScenarioId}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onModeChange={setMode}
          hideTopNavBar={true}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
        />
      ) : (
        <div className="mx-auto max-w-[1440px] px-4 py-6">
          {/* Desk OS 3-Stage Tactile Stepper */}
          <StepperBar
            activeStageView={activeStageView}
            workflowState={simState.workflowState}
            isComplete={isComplete}
            onSelectStage={(stage: DeskOsStageId) => setActiveStageView(stage)}
          />

          {/* Unified Desk OS Workbench Shell */}
          <div className="workbench-shell rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] shadow-xs overflow-hidden">
            {/* Quiet Monochrome Top Bar */}
            <MonochromeTopBar opportunity={currentOpportunity} mode="simulation" />

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
                        <span className="mono-pill rounded border border-[#E2E0D8] bg-[#F1F0EC] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#52545D]">
                          Stage Gate 2 · Unassessed Opportunity
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleStartAssessment}
                        aria-label="Start assessment"
                        className="btn-action-primary flex items-center justify-center gap-2 rounded-md bg-[#0F52BA] px-4 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#0C4196] cursor-pointer shadow-2xs"
                      >
                        <span>Run MEDDPICC Deal Audit →</span>
                        <span className="text-white/80 font-normal">Start assessment</span>
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

                {/* 2. Initial Assessment Loading (ANALYZING) */}
                {simState.workflowState === 'ANALYZING' && (
                  <div className="space-y-4">
                    <MeddpiccScorecard
                      mode="loading"
                      loadingStatus="Evaluating Opportunity & Executing Baseline Audit..."
                      dimensions={simState.dimensions}
                      hideHeader={true}
                    />
                  </div>
                )}

                {/* 3. Stage 1: Initial Deal Audit */}
                {activeStageView === 'stage1' && simState.workflowState !== 'ANALYZING' && (
                  <div className="space-y-4">
                    <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                      <div className="score-lockup flex flex-wrap items-center gap-3">
                        <span className="font-mono text-2xl font-bold tracking-tight text-[#111215] tabular-nums">
                          {currentScore}
                        </span>
                        <span className="text-sm font-normal text-[#787C87]">/ 100</span>
                        <span className="mono-pill rounded border border-[#E2E0D8] bg-[#F1F0EC] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#52545D]">
                          {currentScore < STAGE_GATE_THRESHOLD
                            ? `Stage Gate 2 · ${gapCount} Gaps Identified (Score < ${STAGE_GATE_THRESHOLD})`
                            : `Stage Gate 2 · Criteria Verified (Score ≥ ${STAGE_GATE_THRESHOLD})`}
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
                          <span>Answer 3 Discovery Questions →</span>
                        </button>
                      </div>
                    </div>

                    <MeddpiccScorecard
                      mode="audit"
                      score={currentScore}
                      dimensions={baselineAssessment?.dimensions ?? simState.dimensions}
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
                {activeStageView === 'stage2' && (
                  <div className="space-y-4">
                    {simState.workflowState === 'EVALUATING' ? (
                      <MeddpiccScorecard
                        mode="loading"
                        loadingStatus="Synthesizing Discovery Findings & Re-Scoring Deal..."
                        dimensions={simState.dimensions}
                        hideHeader={true}
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
                          dimensions={simState.dimensions}
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
                    <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
                      <div className="score-lockup flex flex-wrap items-center gap-3">
                        <div className="flex items-baseline gap-1 font-mono text-2xl font-bold tracking-tight text-[#111215] tabular-nums">
                          <span className="text-sm font-medium text-[#787C87]">
                            {previousScoreDisplay} →
                          </span>
                          <span>{simState.score}</span>
                          <span className="text-sm font-normal text-[#787C87]">/ 100</span>
                          {scoreDeltaDisplay > 0 && (
                            <span className="text-base font-semibold text-[#059669]">
                              (+{scoreDeltaDisplay})
                            </span>
                          )}
                        </div>

                        <span
                          className={`mono-pill rounded border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                            simState.score >= STAGE_GATE_THRESHOLD
                              ? 'border-[#059669]/30 bg-[#059669]/10 text-[#059669]'
                              : 'border-[#D97706]/30 bg-[#D97706]/10 text-[#D97706]'
                          }`}
                        >
                          {simState.score >= STAGE_GATE_THRESHOLD
                            ? `Stage Gate 2 · Gate Criteria Satisfied (Score ≥ ${STAGE_GATE_THRESHOLD})`
                            : `Stage Gate 2 · ${gapCount} Gaps Remaining (Score < ${STAGE_GATE_THRESHOLD})`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleReset}
                        className="flex items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] cursor-pointer"
                      >
                        <RotateCcw className="size-3" aria-hidden="true" />
                        <span>↺ Restart Walkthrough</span>
                      </button>
                    </div>

                    {/* Suggested Next Steps Block Directly Above the Scorecard */}
                    <SuggestedNextStepsCard
                      nextSteps={simState.suggestedNextSteps}
                      score={simState.score}
                      qualificationStatus={currentOpportunity.qualification_status}
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
      )}
    </main>
  );
}
