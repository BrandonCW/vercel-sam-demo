'use client';

import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { WorkflowState, WorkbenchMode } from '@/lib/simulation/types';

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
    fullTitle: 'Initial Deal Audit (Gaps Identified)',
  },
  {
    id: 'stage2',
    stepNumber: 2,
    label: 'Field Discovery Checklist',
    fullTitle: 'Field Discovery Checklist (In-Context)',
  },
  {
    id: 'stage3',
    stepNumber: 3,
    label: 'Updated Assessment & Next Steps',
    fullTitle: 'Updated Assessment & Next Steps (Qualified)',
  },
];

// Preserved for backward compatibility with legacy tests/imports
export const STEPS: { state: WorkflowState; label: string }[] = [
  { state: 'READY_TO_ASSESS', label: 'Baseline' },
  { state: 'ANALYZING', label: 'Analyzing' },
  { state: 'PENDING_FEEDBACK', label: 'Discovery' },
  { state: 'EVALUATING', label: 'Re-scoring' },
  { state: 'COMPLETED', label: 'Completed' },
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
}

export function StepperBar({
  activeStageView,
  currentWorkflow,
  workflowState,
  onSelectStage,
  isComplete = false,
  unlockedStages,
  readOnlyRetrospective = false,
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

  const isAnalyzing = workflow === 'ANALYZING';
  const isEvaluating = workflow === 'EVALUATING';

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
      className="mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-2 rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] p-1.5 shadow-xs"
    >
      {DESK_OS_STAGES.map((stage, idx) => {
        const isActive = activeStage === stage.id;
        const unlocked = isStageUnlocked(stage.id);
        const completed = isStageCompleted(stage.id) && !isActive;
        const loading =
          (stage.id === 'stage1' && isAnalyzing) ||
          (stage.id === 'stage2' && isEvaluating);

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
              disabled={!unlocked || loading}
              onClick={() => {
                if (unlocked && onSelectStage) {
                  onSelectStage(stage.id);
                }
              }}
              aria-current={isActive ? 'step' : undefined}
              className={`flex-1 flex items-center justify-center md:justify-start gap-2.5 rounded-md px-3.5 py-2.5 text-xs font-medium transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F52BA] ${
                isActive
                  ? 'bg-[#F1F0EC] border border-[#E2E0D8] text-[#111215] font-semibold shadow-2xs'
                  : unlocked
                  ? 'text-[#52545D] hover:bg-[#F1F0EC]/60 hover:text-[#111215] cursor-pointer'
                  : 'text-[#A6A7AD] cursor-not-allowed opacity-60'
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-[4px] font-mono text-[11px] font-semibold border ${
                  completed
                    ? 'border-[#059669] bg-[#059669] text-[#FFFFFF]'
                    : isActive
                    ? 'border-[#0F52BA] bg-[#FFFFFF] text-[#0F52BA]'
                    : 'border-[#E2E0D8] bg-[#F1F0EC] text-[#787C87]'
                }`}
              >
                {loading ? (
                  <Loader2 className="size-3 animate-spin text-[#0F52BA]" aria-hidden="true" />
                ) : completed ? (
                  <Check className="size-3 stroke-[2.5]" aria-hidden="true" />
                ) : (
                  stage.stepNumber
                )}
              </span>

              <span className="truncate">
                {stage.fullTitle}
                {loading && (
                  <span className="ml-1 text-[11px] text-[#0F52BA] font-normal" aria-hidden="true">
                    {stage.id === 'stage1' ? ' (Analyzing...)' : ' (Re-scoring...)'}
                  </span>
                )}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

interface JumpToStateProps {
  currentWorkflow?: WorkflowState;
  onJumpToState?: (state: WorkflowState) => void;
  mode?: WorkbenchMode;
}

export function JumpToStateButtons({
  mode = 'simulation',
}: JumpToStateProps) {
  if (mode === 'live') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 shadow-xs text-xs">
        <span className="size-2 rounded-full bg-[#059669]" />
        <span className="font-medium text-[#111215]">Live Mode</span>
        <span className="text-[#A6A7AD]">•</span>
        <span className="text-[#787C87]">AI Gateway & Salesforce</span>
      </div>
    );
  }

  return null;
}
