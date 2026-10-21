'use client';

import React, { useState } from 'react';
import { Zap, Play, Clipboard, Check, RotateCcw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorkflowState } from '@/lib/simulation/types';

interface ActionPanelProps {
  workflow: WorkflowState;
  onAdvance: () => void;
  onStepBack?: () => void;
  onReset: () => void;
  isComplete: boolean;
  nextSteps?: string | null;
  isBusy?: boolean;
  isLive?: boolean;
}

const labels: Record<WorkflowState, string> = {
  READY_TO_ASSESS: 'Start assessment',
  ANALYZING: 'Evaluating Opportunity...',
  PENDING_FEEDBACK: 'Awaiting discovery findings',
  EVALUATING: 'Re-scoring...',
  COMPLETED: 'Assessment complete',
};

export function ActionPanel({
  workflow,
  onAdvance,
  onStepBack,
  onReset,
  isComplete,
  nextSteps,
  isBusy = false,
  isLive = false,
}: ActionPanelProps) {
  const [copied, setCopied] = useState(false);

  async function copyNextSteps() {
    try {
      if (nextSteps) {
        await navigator.clipboard?.writeText(nextSteps);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isStepBackDisabled = workflow === 'READY_TO_ASSESS' || isBusy;

  return (
    <section className="rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] p-5 shadow-xs">
      <div className="flex items-center gap-2 text-[#111215]">
        <Zap className="size-4 text-[#0F52BA]" aria-hidden="true" />
        <h3 className="font-semibold text-sm text-[#111215]">Workflow controls</h3>
      </div>

      {isComplete ? (
        <div className="mt-4 rounded-md border border-[#E2E0D8] bg-[#F1F0EC] p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.05em] text-[#787C87]">
            Suggested next steps
          </p>
          <p className="text-xs leading-5 text-[#52545D] font-mono">{nextSteps}</p>
          <Button
            onClick={copyNextSteps}
            variant="secondary"
            className="mt-4 w-full bg-[#FFFFFF] border border-[#E2E0D8] text-[#111215] hover:bg-[#F1F0EC] cursor-pointer text-xs"
          >
            {copied ? (
              <>
                <Check className="size-3.5 mr-1 text-[#059669]" />
                Copied to clipboard
              </>
            ) : (
              <>
                <Clipboard className="size-3.5 mr-1" />
                Copy to clipboard
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs leading-5 text-[#787C87]">
            Use the controller to move sequentially through the deal qualification lifecycle.
          </p>
          <Button
            onClick={onAdvance}
            disabled={workflow === 'ANALYZING' || workflow === 'EVALUATING' || isBusy}
            className="mt-4 w-full bg-[#0F52BA] hover:bg-[#0C4196] text-white font-semibold cursor-pointer disabled:opacity-50 text-xs py-2 h-auto"
          >
            {isBusy || workflow === 'ANALYZING' ? (
              <>
                <span className="inline-block size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                <span>Evaluating Opportunity...</span>
              </>
            ) : (
              <>
                {workflow === 'READY_TO_ASSESS' && <Play className="size-3.5 mr-1 fill-current" />}
                <span>{labels[workflow]}</span>
              </>
            )}
          </Button>
        </>
      )}

      {/* Sequential Previous Step Navigation (hidden in Live mode, disabled at READY_TO_ASSESS) */}
      {!isLive && onStepBack && (
        <Button
          onClick={onStepBack}
          disabled={isStepBackDisabled}
          variant="outline"
          aria-label="Previous step"
          className="mt-2 w-full border border-[#E2E0D8] bg-[#FFFFFF] text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] cursor-pointer disabled:opacity-40 text-xs py-2 h-auto"
        >
          <ArrowLeft className="size-3.5 mr-1" />
          <span>← Previous step</span>
        </Button>
      )}

      <Button
        onClick={onReset}
        variant="ghost"
        className="mt-2 w-full text-[#787C87] hover:bg-[#F1F0EC] hover:text-[#111215] cursor-pointer text-xs py-2 h-auto"
      >
        <RotateCcw className="size-3.5 mr-1" />
        {isComplete ? 'Reset / re-evaluate' : 'Reset workflow'}
      </Button>
    </section>
  );
}
