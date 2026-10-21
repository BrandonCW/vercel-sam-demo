'use client';

import React, { useEffect, useReducer, useRef, useState, useTransition } from 'react';
import { ChevronRight } from 'lucide-react';
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
import { StepperBar } from './StepperBar';
import { WorkflowBanners } from './Banners';
import { DealContextCard } from './DealContextCard';
import { MeddpiccScorecard } from './MeddpiccScorecard';
import { StageGateCard } from './StageGateCard';
import { DealSummaryCard } from './DealSummaryCard';
import { ActionPanel } from './ActionPanel';
import { DynamicDiscoveryForm } from './DynamicDiscoveryForm';
import { LiveQualificationWorkbench } from './LiveQualificationWorkbench';

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
  const [savedFormData, setSavedFormData] = useState<Record<string, string | string[]>>({});
  const [, startTransition] = useTransition();

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Simulation State Machine
  const [simState, dispatch] = useReducer(
    (state: any, action: any) => simulationReducer(state, action, fixture),
    fixture,
    createSimulationState
  );

  const isComplete = simState.workflowState === 'COMPLETED';
  const isBusy = simState.workflowState === 'ANALYZING' || simState.workflowState === 'EVALUATING';

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

  // State transitions with realistic simulated delays guarded by timerRef
  function handleAdvance() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (simState.workflowState === 'READY_TO_ASSESS') {
      dispatch({ type: 'START_ASSESSMENT' });
      timerRef.current = setTimeout(() => {
        startTransition(() => {
          dispatch({ type: 'ANALYSIS_COMPLETE' });
          timerRef.current = null;
        });
      }, 1200);
    } else if (simState.workflowState === 'PENDING_FEEDBACK') {
      dispatch({ type: 'SUBMIT_FEEDBACK' });
      timerRef.current = setTimeout(() => {
        startTransition(() => {
          dispatch({ type: 'EVALUATION_COMPLETE' });
          timerRef.current = null;
        });
      }, 1200);
    }
  }

  function handleStepBack() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dispatch({ type: 'STEP_BACK' });
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
    dispatch({ type: 'SUBMIT_FEEDBACK', formResponses: responses, notesDelta });
    timerRef.current = setTimeout(() => {
      startTransition(() => {
        dispatch({ type: 'EVALUATION_COMPLETE' });
        timerRef.current = null;
      });
    }, 1200);
  }

  const currentOpportunity = mode === 'simulation' ? simState.opportunity : initialOpportunity;

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
        <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
          {/* Breadcrumbs and Title Header */}
          <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#787C87]">
                <span>PIPELINE</span>
                <ChevronRight className="size-3" aria-hidden="true" />
                <span>{currentOpportunity.account_name?.toUpperCase() || 'ACME CORP'}</span>
                <ChevronRight className="size-3" aria-hidden="true" />
                <span className="text-[#111215]">QUALIFICATION</span>
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl text-[#111215]">
                {currentOpportunity.name || 'Acme Corp — Platform Migration'}
              </h2>
              <p className="mt-1 text-sm text-[#787C87]">
                MEDDPICC assessment workspace <span className="mx-2 text-[#E2E0D8]">•</span> Deterministic simulation (zero database leases, instant resets)
              </p>
            </div>
          </div>

          {/* 5-Step Stepper Bar (Sequential Progression) */}
          <StepperBar
            currentWorkflow={simState.workflowState}
            isComplete={isComplete}
          />

          {/* Status / Alert Banners ($0 compute, analyzing, completed) */}
          <WorkflowBanners
            workflow={simState.workflowState}
            isComplete={isComplete}
            statusLabel={simState.statusLabel}
            isLive={false}
          />

          {/* Main 2-Column Split Workbench */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* Left Column: Deal Context + (Discovery Form OR MEDDPICC Scorecard) */}
            <div className="min-w-0 space-y-6">
              <DealContextCard opportunity={currentOpportunity} />

              {simState.workflowState === 'PENDING_FEEDBACK' ? (
                <>
                  <DynamicDiscoveryForm
                    dynamicForm={simState.discoveryForm}
                    initialValues={savedFormData}
                    onSubmit={handleSubmitFeedback}
                  />
                  <MeddpiccScorecard
                    score={simState.score}
                    dimensions={simState.dimensions}
                  />
                </>
              ) : (
                <MeddpiccScorecard
                  score={simState.score}
                  dimensions={simState.dimensions}
                />
              )}
            </div>

            {/* Right Column: Stage Gate 2 + Summary + Workflow Controls */}
            <aside className="space-y-6">
              <StageGateCard
                score={simState.score}
                complete={isComplete}
                stageGate={simState.stageGate}
                dimensions={simState.dimensions}
              />

              <DealSummaryCard
                score={simState.score}
                statusLabel={simState.statusLabel}
              />

              <ActionPanel
                workflow={simState.workflowState}
                isComplete={isComplete}
                nextSteps={simState.suggestedNextSteps}
                onAdvance={handleAdvance}
                onStepBack={handleStepBack}
                onReset={handleReset}
              />
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
