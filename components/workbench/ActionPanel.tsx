'use client';

import React, { useState } from 'react';
import { Zap, Play, Clipboard, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorkflowState } from '@/lib/simulation/types';

interface ActionPanelProps {
  workflow: WorkflowState;
  onAdvance: () => void;
  onReset: () => void;
  isComplete: boolean;
  nextSteps: string;
  isBusy?: boolean;
}

const labels: Record<WorkflowState, string> = {
  READY_TO_ASSESS: 'Start assessment',
  ANALYZING: 'Processing...',
  PENDING_FEEDBACK: 'Awaiting discovery findings',
  EVALUATING: 'Re-scoring...',
  COMPLETED: 'Assessment complete',
};

export function ActionPanel({
  workflow,
  onAdvance,
  onReset,
  isComplete,
  nextSteps,
  isBusy = false,
}: ActionPanelProps) {
  const [copied, setCopied] = useState(false);

  async function copyNextSteps() {
    try {
      await navigator.clipboard?.writeText(nextSteps);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className="rounded-xl border border-[#dfe5ed] bg-[#14233b] p-5 text-white shadow-xs">
      <div className="flex items-center gap-2 text-[#f3b547]">
        <Zap className="size-4" aria-hidden="true" />
        <h3 className="font-semibold text-white">Workflow controls</h3>
      </div>

      {isComplete ? (
        <div className="mt-5 rounded-lg bg-white/10 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#f3c56b]">
            Suggested next steps
          </p>
          <p className="text-xs leading-5 text-[#d8e0eb]">{nextSteps}</p>
          <Button
            onClick={copyNextSteps}
            variant="secondary"
            className="mt-4 w-full bg-white text-[#14233b] hover:bg-[#edf2f8] cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3.5 mr-1" />
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
          <p className="mt-3 text-sm leading-6 text-[#bcc9d9]">
            Use the simulation controller to move through the qualification lifecycle.
          </p>
          <Button
            onClick={onAdvance}
            disabled={workflow === 'ANALYZING' || workflow === 'EVALUATING' || isBusy}
            className="mt-5 w-full bg-[#f3b547] text-[#14233b] hover:bg-[#f7c66c] font-semibold cursor-pointer disabled:opacity-50"
          >
            {workflow === 'READY_TO_ASSESS' && <Play className="size-3.5 mr-1 fill-current" />}
            {labels[workflow]}
          </Button>
        </>
      )}

      <Button
        onClick={onReset}
        variant="ghost"
        className="mt-2 w-full text-[#bcc9d9] hover:bg-white/10 hover:text-white cursor-pointer"
      >
        <RotateCcw className="size-3.5 mr-1" />
        {isComplete ? 'Reset / re-evaluate' : 'Reset workflow'}
      </Button>
    </section>
  );
}
