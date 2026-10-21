'use client';

import React from 'react';
import { Check } from 'lucide-react';
import type { WorkflowState, WorkbenchMode } from '@/lib/simulation/types';

export const STEPS: { state: WorkflowState; label: string }[] = [
  { state: 'READY_TO_ASSESS', label: 'Baseline' },
  { state: 'ANALYZING', label: 'Analyzing' },
  { state: 'PENDING_FEEDBACK', label: 'Discovery' },
  { state: 'EVALUATING', label: 'Re-scoring' },
  { state: 'COMPLETED', label: 'Completed' },
];

interface StepperBarProps {
  currentWorkflow: WorkflowState;
  onJumpToState?: (state: WorkflowState) => void;
  isComplete: boolean;
}

export function StepperBar({
  currentWorkflow,
  isComplete,
}: StepperBarProps) {
  const activeStep = STEPS.findIndex((s) => s.state === currentWorkflow);

  return (
    <section
      aria-label="Qualification process progression"
      className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#E2E0D8] bg-[#E2E0D8] sm:grid-cols-5"
    >
      {STEPS.map((step, index) => {
        const done = index < activeStep || isComplete;
        const current = index === activeStep && !isComplete;

        return (
          <div
            key={step.state}
            className={`flex items-center gap-3 bg-[#FFFFFF] px-4 py-3.5 text-left transition select-none last:col-span-2 sm:last:col-span-1 ${
              current ? 'bg-[#F1F0EC]' : ''
            }`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? 'bg-[#059669] text-[#FFFFFF]'
                  : current
                  ? 'border border-[#0F52BA] bg-[#FFFFFF] text-[#0F52BA]'
                  : 'border border-[#E2E0D8] bg-[#F1F0EC] text-[#787C87]'
              }`}
            >
              {done ? <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span
                className={`block text-xs font-semibold truncate ${
                  current ? 'text-[#111215]' : done ? 'text-[#111215]' : 'text-[#787C87]'
                }`}
              >
                {step.label}
              </span>
            </span>
          </div>
        );
      })}
    </section>
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

  // Jump to state numeric buttons removed per DESIGN-3 / Issue #23
  return null;
}
