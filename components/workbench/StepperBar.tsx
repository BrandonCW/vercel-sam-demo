'use client';

import React from 'react';
import { Check } from 'lucide-react';
import type { WorkflowState } from '@/lib/simulation/types';

export type DeskOsStageId = 'stage1' | 'stage2' | 'stage3';

export interface DeskOsStageDef {
  id: DeskOsStageId;
  stepNumber: number;
  label: string;
  fullTitle: string;
}

export const DESK_OS_STAGES: DeskOsStageDef[] = [
  {
    id: 'stage1',
    stepNumber: 1,
    label: 'Initial Deal Audit',
    fullTitle: 'Initial Deal Audit',
  },
  {
    id: 'stage2',
    stepNumber: 2,
    label: 'Field Discovery',
    fullTitle: 'Field Discovery',
  },
  {
    id: 'stage3',
    stepNumber: 3,
    label: 'Updated Assessment',
    fullTitle: 'Updated Assessment',
  },
];

export interface StepperBarProps {
  activeStageView?: 'blank' | 'stage1' | 'stage2' | 'stage3';
  currentWorkflow?: WorkflowState;
  workflowState?: WorkflowState;
  onSelectStage?: (stage: DeskOsStageId) => void;
  onJumpToState?: (state: WorkflowState) => void;
  isComplete?: boolean;
  unlockedStages?: DeskOsStageId[];
  readOnlyRetrospective?: boolean;
  hasDiscoveryQuestions?: boolean;
}

export function StepperBar({
  activeStageView,
  currentWorkflow,
  workflowState,
  onSelectStage,
  isComplete = false,
  unlockedStages,
  readOnlyRetrospective = false,
  hasDiscoveryQuestions = true,
}: StepperBarProps) {
  const workflow = workflowState ?? currentWorkflow ?? 'READY_TO_ASSESS';

  // Derive active stage if activeStageView not explicitly provided
  const activeStage: DeskOsStageId =
    activeStageView === 'stage2'
      ? 'stage2'
      : activeStageView === 'stage3'
      ? 'stage3'
      : activeStageView === 'stage1'
      ? 'stage1'
      : activeStageView === 'blank'
      ? 'stage1'
      : workflow === 'PENDING_FEEDBACK'
      ? 'stage2'
      : workflow === 'EVALUATING'
      ? 'stage2'
      : workflow === 'COMPLETED' || isComplete
      ? 'stage3'
      : 'stage1';

  const isBusy = workflow === 'ANALYZING' || workflow === 'EVALUATING';

  // Compute unlocked stages if not passed explicitly
  const isStageUnlocked = (stageId: DeskOsStageId): boolean => {
    if (unlockedStages) {
      return unlockedStages.includes(stageId);
    }
    if (readOnlyRetrospective) {
      return stageId === 'stage3';
    }
    if (stageId === 'stage1') {
      return true;
    }
    if (stageId === 'stage2') {
      if (!hasDiscoveryQuestions && !isComplete) {
        return false;
      }
      return (
        activeStageView === 'stage2' ||
        activeStageView === 'stage3' ||
        workflow === 'PENDING_FEEDBACK' ||
        workflow === 'EVALUATING' ||
        workflow === 'COMPLETED' ||
        isComplete
      );
    }
    if (stageId === 'stage3') {
      return (
        activeStageView === 'stage3' ||
        workflow === 'COMPLETED' ||
        isComplete
      );
    }
    return false;
  };

  const isStageCompleted = (stageId: DeskOsStageId): boolean => {
    if (stageId === 'stage1') {
      return (
        workflow === 'PENDING_FEEDBACK' ||
        workflow === 'EVALUATING' ||
        workflow === 'COMPLETED' ||
        isComplete
      );
    }
    if (stageId === 'stage2') {
      return workflow === 'COMPLETED' || isComplete;
    }
    return false;
  };

  return (
    <nav
      aria-label="Qualification process progression"
      className="mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-2 rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] p-1.5"
    >
      {DESK_OS_STAGES.map((stage, idx) => {
        const isActive = activeStage === stage.id;
        const unlocked = isStageUnlocked(stage.id);
        const completed = isStageCompleted(stage.id) && !isActive;

        return (
          <React.Fragment key={stage.id}>
            {idx > 0 && (
              <span
                className="hidden md:inline-block text-[#787C87] text-xs select-none px-1"
                aria-hidden="true"
              >
                →
              </span>
            )}

            <button
              type="button"
              disabled={!unlocked || isBusy}
              onClick={() => {
                if (unlocked && onSelectStage) {
                  onSelectStage(stage.id);
                }
              }}
              aria-current={isActive ? 'step' : undefined}
              className={`min-h-10 flex-1 min-w-0 flex items-center justify-center md:justify-start gap-2.5 rounded-md px-3.5 py-2 font-sans text-xs sm:text-sm font-medium transition-all text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#111215] ${
                isActive
                  ? 'bg-[#F1F0EC] border border-[#E2E0D8] text-[#111215] font-semibold'
                  : unlocked
                  ? 'text-[#52545D] hover:bg-[#F1F0EC]/60 hover:text-[#111215] cursor-pointer'
                  : 'text-[#A6A7AD] cursor-not-allowed opacity-60'
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-[4px] border font-sans text-xs font-semibold leading-none tabular-nums ${
                  completed
                    ? 'border-[#111215] bg-[#111215] text-[#FFFFFF]'
                    : isActive
                    ? 'border-[#111215] bg-[#FFFFFF] text-[#111215]'
                    : 'border-[#E2E0D8] bg-[#F1F0EC] text-[#787C87]'
                }`}
              >
                {completed ? (
                  <Check className="size-3 stroke-[2.5]" aria-hidden="true" />
                ) : (
                  stage.stepNumber
                )}
              </span>

              <span className="truncate">{stage.fullTitle}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
