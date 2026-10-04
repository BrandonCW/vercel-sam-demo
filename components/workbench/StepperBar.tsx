'use client';

import React from 'react';
import { Check } from 'lucide-react';
import type { WorkflowState, WorkbenchMode } from '@/lib/simulation/types';

export const STEPS: { state: WorkflowState; label: string }[] = [
  { state: 'READY_TO_ASSESS', label: 'Baseline' },
  { state: 'ANALYZING', label: 'Analyzing' },
  { state: 'PENDING_FEEDBACK', label: 'Discovery paused' },
  { state: 'EVALUATING', label: 'Re-scoring' },
  { state: 'COMPLETED', label: 'Completed' },
];

interface StepperBarProps {
  currentWorkflow: WorkflowState;
  onJumpToState: (state: WorkflowState) => void;
  isComplete: boolean;
}

export function StepperBar({
  currentWorkflow,
  onJumpToState,
  isComplete,
}: StepperBarProps) {
  const activeStep = STEPS.findIndex((s) => s.state === currentWorkflow);

  return (
    <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#dfe5ed] bg-[#dfe5ed] shadow-sm sm:grid-cols-5">
      {STEPS.map((step, index) => {
        const done = index < activeStep || isComplete;
        const current = index === activeStep && !isComplete;

        return (
          <button
            key={step.state}
            type="button"
            onClick={() => onJumpToState(step.state)}
            className={`flex items-center gap-3 bg-white px-4 py-4 text-left transition hover:bg-[#fafbfd] cursor-pointer last:col-span-2 sm:last:col-span-1 ${
              current ? 'bg-[#f0f5fb]' : ''
            }`}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                done
                  ? 'border-[#2d8a69] bg-[#2d8a69] text-white'
                  : current
                  ? 'border-[#e5a83d] bg-[#fff7e5] text-[#a66b08]'
                  : 'border-[#d5dce6] text-[#92a0b3]'
              }`}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-[#152238] truncate">
                {step.label}
              </span>
              <span className="block text-[11px] text-[#92a0b3] truncate">
                {step.state}
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}

interface JumpToStateProps {
  currentWorkflow: WorkflowState;
  onJumpToState: (state: WorkflowState) => void;
  mode?: WorkbenchMode;
}

export function JumpToStateButtons({
  currentWorkflow,
  onJumpToState,
  mode = 'simulation',
}: JumpToStateProps) {
  if (mode === 'live') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#dfe5ed] bg-white px-3 py-1.5 shadow-xs text-xs">
        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-medium text-[#152238]">Live Mode</span>
        <span className="text-[#a8b3c2]">•</span>
        <span className="text-[#718097]">AI Gateway & Salesforce</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#dfe5ed] bg-white p-1.5 shadow-xs">
      <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#92a0b3]">
        Jump to state
      </span>
      {STEPS.map((step, index) => (
        <button
          key={step.state}
          type="button"
          onClick={() => onJumpToState(step.state)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
            currentWorkflow === step.state
              ? 'bg-[#14233b] text-white'
              : 'text-[#718097] hover:bg-[#f0f3f7]'
          }`}
          aria-label={`Jump to ${index + 1}. ${step.label} state`}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}
