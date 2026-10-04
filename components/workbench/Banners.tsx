'use client';

import React from 'react';
import { Sparkles, LockKeyhole, Clock3, Check } from 'lucide-react';
import type { WorkflowState } from '@/lib/simulation/types';

interface BannersProps {
  workflow: WorkflowState;
  isComplete: boolean;
  statusLabel: string;
  isLive?: boolean;
}

export function WorkflowBanners({
  workflow,
  isComplete,
  statusLabel,
  isLive = false,
}: BannersProps) {
  const modeContext = isLive ? 'live Eve agent' : 'simulation mode';

  if (workflow === 'ANALYZING' || workflow === 'EVALUATING') {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#cddcf0] bg-[#edf5ff] px-5 py-4 text-sm text-[#31567e]">
        <Sparkles className="size-5 shrink-0 text-[#477fb8]" aria-hidden="true" />
        <span>
          <strong>
            {workflow === 'ANALYZING'
              ? 'System 1 scoring + System 2 reasoning in progress.'
              : 'Delta re-scoring in progress.'}
          </strong>{' '}
          Your assessment is being processed in {modeContext}.
        </span>
        <span className="ml-auto size-4 shrink-0 animate-spin rounded-full border-2 border-[#477fb8] border-t-transparent" />
      </div>
    );
  }

  if (workflow === 'PENDING_FEEDBACK') {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#ead9b4] bg-[#fff8e7] px-5 py-4 text-sm text-[#795711]">
        <LockKeyhole className="size-5 shrink-0" aria-hidden="true" />
        <span>
          <strong>Session paused at $0 compute.</strong> The workbench is waiting for field
          discovery findings. No scoring resources are active.
        </span>
        <Clock3 className="ml-auto size-4 shrink-0 text-[#a66b08]" aria-hidden="true" />
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#b9dfcf] bg-[#eaf8f1] px-5 py-4 text-sm text-[#256b50]">
        <Check className="size-5 shrink-0 text-[#2d8a69]" aria-hidden="true" />
        <span>
          <strong>Stage Gate Passed — ready to advance to Stage 3.</strong> Qualification
          writeback is prepared for Salesforce.
        </span>
        <span className="ml-auto rounded-full bg-[#ccebdc] px-2.5 py-1 text-xs font-bold text-[#256b50]">
          {statusLabel}
        </span>
      </div>
    );
  }

  return null;
}
