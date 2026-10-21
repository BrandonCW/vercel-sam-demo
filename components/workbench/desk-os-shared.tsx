'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clipboard, Check, AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import type { Opportunity } from '@/lib/types/crm';
import { formatNextSteps, getNextStepsCopyText } from '@/lib/assessment-results';

export const STAGE_GATE_THRESHOLD = 75;

interface MonochromeTopBarProps {
  opportunity: Opportunity;
  mode?: 'simulation' | 'live';
}

export function MonochromeTopBar({ opportunity }: MonochromeTopBarProps) {
  const formattedAmount = opportunity.amount
    ? `$${(Number(opportunity.amount) / 1000).toFixed(0)},000 ACV`
    : '$180,000 ACV';

  const stageDisplay = opportunity.stage_name || 'Stage 2 · Discovery';

  return (
    <div className="monochrome-top-bar flex h-12 items-center justify-between border-b border-[#E2E0D8] bg-[#FFFFFF] px-4.5">
      <div className="bar-left flex items-center gap-3">
        <div className="bar-logo flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.05em] text-[#111215]">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>DEAL DESK</span>
        </div>
        <div className="bar-divider h-4 w-px bg-[#E2E0D8]" aria-hidden="true" />
        <div className="opp-title text-xs font-semibold text-[#111215] truncate">
          {opportunity.name || 'Acme Corp — Platform Migration'}
        </div>
      </div>

      <div className="bar-right flex items-center gap-2">
        <span className="mono-pill rounded border border-[#E2E0D8] bg-[#F1F0EC] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#52545D]">
          {stageDisplay}
        </span>
        <span className="mono-pill rounded border border-[#E2E0D8] bg-[#F1F0EC] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#52545D]">
          {formattedAmount}
        </span>
      </div>
    </div>
  );
}

interface ProblemCauseFixBannerProps {
  problem: string;
  cause?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  onSwitchToSimulation?: () => void;
}

export function ProblemCauseFixBanner({
  problem,
  cause,
  onRetry,
  onDismiss,
  onSwitchToSimulation,
}: ProblemCauseFixBannerProps) {
  const sanitizedCause = cause
    ? cause.length > 300
      ? `${cause.slice(0, 300)}...`
      : cause
    : null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/5 p-4 text-xs text-[#DC2626] space-y-2.5"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="size-4 text-[#DC2626] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <div className="font-semibold text-sm text-[#DC2626]">{problem}</div>
          {sanitizedCause && (
            <div className="text-xs text-[#52545D] break-words leading-relaxed">
              {sanitizedCause}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#DC2626]/15">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-md border border-[#DC2626]/30 bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        )}

        {onSwitchToSimulation && (
          <button
            type="button"
            onClick={onSwitchToSimulation}
            className="rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#52545D] hover:bg-[#F1F0EC] cursor-pointer"
          >
            Switch to Simulation Mode
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-[#787C87] hover:text-[#111215] cursor-pointer"
          >
            <XCircle className="size-3" aria-hidden="true" />
            <span>Dismiss</span>
          </button>
        )}
      </div>
    </div>
  );
}

interface SuggestedNextStepsCardProps {
  nextSteps?: string | string[] | null;
  score?: number | null;
  qualificationStatus?: string | null;
}

export function SuggestedNextStepsCard({
  nextSteps,
  score = 76,
  qualificationStatus,
}: SuggestedNextStepsCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stepsList = formatNextSteps(nextSteps);
  const copyText = getNextStepsCopyText(nextSteps);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (stepsList.length === 0) return null;

  async function handleCopy() {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
        setCopied(true);
        setCopyFailed(false);
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      setCopyFailed(true);
      setCopied(false);
      copyTimerRef.current = setTimeout(() => setCopyFailed(false), 3000);
    }
  }

  const isQualified =
    (score ?? 0) >= STAGE_GATE_THRESHOLD || qualificationStatus === 'qualified';

  return (
    <div className="rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] p-5 shadow-xs space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-[#111215]">
              Suggested Next Steps
            </h3>
            {isQualified ? (
              <span className="rounded border border-[#059669]/30 bg-[#059669]/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-[#059669]">
                Qualification Finalized ({score ?? 76}/100)
              </span>
            ) : (
              <span className="rounded border border-[#D97706]/30 bg-[#D97706]/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-[#D97706]">
                Sub-Threshold ({score ?? 0}/100)
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#787C87]">
            Action items and commercial milestones synchronized to Salesforce CRM.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {copyFailed && (
            <span className="text-[11px] text-[#DC2626] font-medium" role="status" aria-live="polite">
              Copy Failed — Select text below manually
            </span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              copied
                ? 'border-[#059669] bg-[#059669]/10 text-[#059669]'
                : 'border-[#E2E0D8] bg-[#FFFFFF] text-[#111215] hover:bg-[#F1F0EC]'
            }`}
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-[#059669]" aria-hidden="true" />
                <span role="status" aria-live="polite">✓ Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Clipboard className="size-3.5 text-[#52545D]" aria-hidden="true" />
                <span>Copy Next Steps</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {stepsList.map((step, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2.5 rounded-md border border-[#E2E0D8] bg-[#F1F0EC]/40 p-3 text-xs leading-relaxed text-[#111215]"
          >
            <span className="font-mono text-xs font-bold text-[#787C87] shrink-0">
              {idx + 1}.
            </span>
            <p className="whitespace-pre-wrap">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
