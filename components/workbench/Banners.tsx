'use client';

import React from 'react';
import { Sparkles, Check } from 'lucide-react';
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
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-[#E2E0D8] bg-[#F1F0EC] px-4 py-3 text-xs text-[#111215]">
        <Sparkles className="size-4 shrink-0 text-[#0F52BA]" aria-hidden="true" />
        <span>
          <strong>
            {workflow === 'ANALYZING'
              ? 'System 1 scoring + System 2 reasoning in progress.'
              : 'Delta re-scoring in progress.'}
          </strong>{' '}
          Your assessment is being processed in {modeContext}.
        </span>
        <span className="ml-auto size-4 shrink-0 animate-spin rounded-full border-2 border-[#0F52BA] border-t-transparent" />
      </div>
    );
  }

  // Yellow $0 compute banner removed per DESIGN-4 / CEO-2 / Issue #23

  if (isComplete) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] px-4 py-3 text-xs text-[#111215] shadow-xs">
        <Check className="size-4 shrink-0 text-[#059669]" aria-hidden="true" />
        <span>
          <strong className="text-[#059669]">Stage Gate Passed — ready to advance to Stage 3.</strong> Qualification
          writeback is prepared for Salesforce CRM.
        </span>
        <span className="ml-auto rounded border border-[#E2E0D8] bg-[#F1F0EC] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-[#111215]">
          {statusLabel}
        </span>
      </div>
    );
  }

  return null;
}
