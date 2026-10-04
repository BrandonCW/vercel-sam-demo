'use client';

import React, { useReducer, useState, useTransition } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Opportunity } from '@/lib/types/crm';
import type { WorkflowState, WorkbenchMode } from '@/lib/simulation/types';
import acmeFixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';
import type { SimulationFixture } from '@/lib/simulation/fixture-schema';
import {
  createSimulationState,
  simulationReducer,
} from '@/lib/simulation/simulation-engine';

import { TopNavBar } from './TopNavBar';
import { StepperBar, JumpToStateButtons } from './StepperBar';
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

  if (mode === 'live') {
    return (
      <LiveQualificationWorkbench
        initialOpportunity={initialOpportunity}
        initialScenarioId={initialScenarioId}
        onModeChange={setMode}
      />
    );
  }

  return (
    <SimulationQualificationWorkbench
      initialOpportunity={initialOpportunity}
      onModeChange={setMode}
    />
  );
}

function SimulationQualificationWorkbench({
  initialOpportunity,
  onModeChange,
}: {
  initialOpportunity: Opportunity;
  onModeChange: (mode: WorkbenchMode) => void;
}) {
  const [isResetting, setIsResetting] = useState(false);
  const [, startTransition] = useTransition();

  // Simulation State Machine
  const [simState, dispatch] = useReducer(
    (state: any, action: any) => simulationReducer(state, action, fixture),
    fixture,
    createSimulationState
  );

  const isComplete = simState.workflowState === 'COMPLETED';

  // State transitions with realistic simulated delays
  function handleAdvance() {
    if (simState.workflowState === 'READY_TO_ASSESS') {
      dispatch({ type: 'START_ASSESSMENT' });
      setTimeout(() => {
        startTransition(() => {
          dispatch({ type: 'ANALYSIS_COMPLETE' });
        });
      }, 1200);
    } else if (simState.workflowState === 'PENDING_FEEDBACK') {
      dispatch({ type: 'SUBMIT_FEEDBACK' });
      setTimeout(() => {
        startTransition(() => {
          dispatch({ type: 'EVALUATION_COMPLETE' });
        });
      }, 1200);
    }
  }

  function handleJumpToState(target: WorkflowState) {
    dispatch({ type: 'JUMP_TO_STATE', targetState: target });
  }

  function handleReset() {
    setIsResetting(true);
    dispatch({ type: 'RESET' });
    setTimeout(() => setIsResetting(false), 300);
  }

  function handleSubmitFeedback(
    responses: Record<string, string | string[]>,
    notesDelta?: string
  ) {
    dispatch({ type: 'SUBMIT_FEEDBACK', formResponses: responses, notesDelta });
    setTimeout(() => {
      startTransition(() => {
        dispatch({ type: 'EVALUATION_COMPLETE' });
      });
    }, 1200);
  }

  const currentOpportunity = simState.opportunity;

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#152238]">
      <TopNavBar
        opportunity={currentOpportunity}
        mode="simulation"
        onModeChange={onModeChange}
        onReset={handleReset}
        isResetting={isResetting}
      />

      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
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
              MEDDPICC assessment workspace <span className="mx-2 text-[#c4ccd7]">•</span>{' '}
              Deterministic simulation (zero database leases, instant resets)
            </p>
          </div>

          <JumpToStateButtons
            currentWorkflow={simState.workflowState}
            onJumpToState={handleJumpToState}
            mode="simulation"
          />
        </div>

        {/* 5-Step Stepper Bar */}
        <StepperBar
          currentWorkflow={simState.workflowState}
          onJumpToState={handleJumpToState}
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
              <DynamicDiscoveryForm
                dynamicForm={simState.discoveryForm}
                onSubmit={handleSubmitFeedback}
              />
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
              onReset={handleReset}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
