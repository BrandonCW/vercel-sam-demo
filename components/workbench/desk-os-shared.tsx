'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clipboard, Check, AlertCircle, RefreshCw, XCircle, RotateCcw } from 'lucide-react';
import type { Opportunity, QualificationStatus, StageGateEvaluation } from '@/lib/types/crm';

export interface ParsedNextStepItem {
  label?: string;
  text: string;
  raw: string;
}

const LEADING_STATUS_TAG_RE =
  /^\s*\[(?:QUALIFIED|IN[\s_-]?REVIEW|DISQUALIFIED|UNQUALIFIED)\]\s*/i;
const STRUCTURED_PREFIX_RE = /^(Owner|Focus|Watch|Action|Next Milestone):\s*(.+)$/i;

/**
 * Parses pipe-delimited or newline-delimited Suggested Next Steps strings into
 * clean structured items without raw `[QUALIFIED]` tags or `|` pipes.
 */
export function parseSuggestedNextSteps(
  steps: string | string[] | null | undefined
): ParsedNextStepItem[] {
  if (!steps) return [];
  const rawSegments = Array.isArray(steps)
    ? steps.flatMap((entry) => String(entry).split(/\||\n/))
    : typeof steps === 'string'
    ? steps.split(/\||\n/)
    : [];

  const items: ParsedNextStepItem[] = [];
  for (const segment of rawSegments) {
    const cleaned = segment.replace(LEADING_STATUS_TAG_RE, '').trim();
    if (!cleaned) continue;
    const prefixMatch = cleaned.match(STRUCTURED_PREFIX_RE);
    if (prefixMatch) {
      const label =
        prefixMatch[1].charAt(0).toUpperCase() + prefixMatch[1].slice(1);
      const text = prefixMatch[2].trim();
      items.push({ label, text, raw: `${label}: ${text}` });
    } else {
      items.push({ text: cleaned, raw: cleaned });
    }
  }
  return items;
}

export function formatSuggestedNextStepsCopyText(
  steps: string | string[] | null | undefined
): string {
  const items = parseSuggestedNextSteps(steps);
  if (items.length === 0) return '';
  if (items.length === 1) return items[0].raw;
  return items.map((item, idx) => `${idx + 1}. ${item.raw}`).join('\n');
}

export function resolveStageGateLabel(
  stageGate?: Partial<StageGateEvaluation> & { gate?: string } | null,
  stageName?: string | null
): string {
  const candidate = stageGate?.currentStage || stageGate?.gate || stageName || '';
  const numMatch = candidate.match(/(?:Stage|Gate)\s*(\d+)/i);
  if (numMatch) {
    return `Stage Gate ${numMatch[1]}`;
  }
  return 'Stage Gate 2';
}

export interface StageGateReadoutOptions {
  stageGate?: (Partial<StageGateEvaluation> & { gate?: string }) | null;
  qualificationStatus?: QualificationStatus | string | null;
  stageName?: string | null;
  phase?: 'unassessed' | 'stage1' | 'stage3';
  fallbackBlockerCount?: number;
}

export interface StageGateReadout {
  gateLabel: string;
  label: string;
  isSatisfied: boolean;
  blockerCount: number;
}

/**
 * Computes Stage Gate badge copy strictly from `stageGate` (`gateReady`, `currentStage`,
 * `gateBlockers.length`) and `qualificationStatus` (`qualified` / `in_review` / `disqualified`).
 */
export function formatStageGateReadout({
  stageGate,
  qualificationStatus,
  stageName,
  phase = 'stage1',
  fallbackBlockerCount = 0,
}: StageGateReadoutOptions): StageGateReadout {
  const gateLabel = resolveStageGateLabel(stageGate, stageName);

  if (phase === 'unassessed') {
    return {
      gateLabel,
      label: `${gateLabel} · Unassessed Opportunity`,
      isSatisfied: false,
      blockerCount: 0,
    };
  }

  const hasExplicitGate = stageGate !== null && stageGate !== undefined && typeof stageGate.gateReady === 'boolean';
  const blockerCount = hasExplicitGate
    ? stageGate.gateReady
      ? 0
      : Math.max(
          stageGate.gateBlockers?.length ?? 0,
          stageGate.blockingDimensions?.length ?? 0,
          1
        )
    : qualificationStatus === 'qualified'
    ? 0
    : Math.max(fallbackBlockerCount, qualificationStatus === 'in_review' || qualificationStatus === 'disqualified' ? 1 : 0);

  if (qualificationStatus === 'disqualified') {
    return {
      gateLabel,
      label: `${gateLabel} · Disqualified`,
      isSatisfied: false,
      blockerCount,
    };
  }

  const isSatisfied =
    phase === 'stage3'
      ? hasExplicitGate
        ? Boolean(stageGate.gateReady) && qualificationStatus !== 'in_review'
        : qualificationStatus === 'qualified'
      : hasExplicitGate
      ? Boolean(stageGate.gateReady)
      : fallbackBlockerCount === 0 && qualificationStatus === 'qualified';

  if (isSatisfied) {
    return {
      gateLabel,
      label: `${gateLabel} · Gate Criteria Satisfied`,
      isSatisfied: true,
      blockerCount: 0,
    };
  }

  if (phase === 'stage3') {
    return {
      gateLabel,
      label: `${gateLabel} · ${blockerCount} ${blockerCount === 1 ? 'Blocker' : 'Blockers'} Remaining`,
      isSatisfied: false,
      blockerCount,
    };
  }

  return {
    gateLabel,
    label: `${gateLabel} · ${blockerCount} Gate ${blockerCount === 1 ? 'Blocker' : 'Blockers'} Identified`,
    isSatisfied: false,
    blockerCount,
  };
}

interface MonochromeTopBarProps {
  opportunity: Opportunity;
}

export function MonochromeTopBar({ opportunity }: MonochromeTopBarProps) {
  const formattedAmount =
    opportunity.amount !== null &&
    opportunity.amount !== undefined &&
    !Number.isNaN(Number(opportunity.amount))
      ? `${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(Number(opportunity.amount))} ACV`
      : '$180,000 ACV';

  const stageDisplay = opportunity.stage_name || 'Stage 2 · Discovery';

  return (
    <div className="monochrome-top-bar flex flex-col sm:flex-row sm:min-h-12 items-start sm:items-center justify-between gap-2 border-b border-[#E2E0D8] bg-[#FFFFFF] px-4 py-2.5 sm:px-5 sm:py-2">
      <div className="bar-left flex w-full sm:w-auto min-w-0 sm:flex-1 items-center gap-2.5 sm:gap-3">
        <div className="bar-logo flex shrink-0 items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.05em] text-[#111215] whitespace-nowrap">
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
        <div className="bar-divider h-4 w-px shrink-0 bg-[#E2E0D8]" aria-hidden="true" />
        <h2 className="opp-title min-w-0 text-xs font-semibold text-[#111215] truncate">
          {opportunity.name || 'Acme Corp — Platform Migration'}
        </h2>
      </div>

      <div className="bar-right flex shrink-0 items-center gap-2">
        <span className="mono-pill whitespace-nowrap rounded-[4px] border border-[#E2E0D8] bg-[#F1F0EC] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#52545D]">
          {stageDisplay}
        </span>
        <span className="mono-pill whitespace-nowrap rounded-[4px] border border-[#E2E0D8] bg-[#F1F0EC] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#52545D]">
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
      ? `${cause.slice(0, 300)}…`
      : cause
    : null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-[#111215] bg-[#F1F0EC] p-4 text-xs text-[#111215] space-y-2.5"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="size-4 text-[#111215] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <div className="font-semibold text-sm text-[#111215]">{problem}</div>
          {sanitizedCause && (
            <div className="text-xs text-[#52545D] break-words leading-relaxed">
              {sanitizedCause}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#E2E0D8]">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-md border border-[#111215] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#111215] hover:bg-[#F8F8F6] cursor-pointer"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        )}

        {onSwitchToSimulation && (
          <button
            type="button"
            onClick={onSwitchToSimulation}
            className="rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#52545D] hover:bg-[#F8F8F6] hover:text-[#111215] cursor-pointer"
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
  qualificationStatus?: QualificationStatus | string | null;
  stageGate?: (Partial<StageGateEvaluation> & { gate?: string }) | null;
  syncMode?: 'live' | 'simulation';
}

export function SuggestedNextStepsCard({
  nextSteps,
  score = 0,
  qualificationStatus,
  stageGate,
  syncMode = 'live',
}: SuggestedNextStepsCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stepsList = parseSuggestedNextSteps(nextSteps);
  const copyText = formatSuggestedNextStepsCopyText(nextSteps);

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

  const gateReadout = formatStageGateReadout({
    stageGate,
    qualificationStatus,
    phase: 'stage3',
  });

  const statusBadgeText =
    qualificationStatus === 'disqualified'
      ? `Disqualified (${score ?? 0}/100)`
      : gateReadout.isSatisfied
      ? `Qualification Finalized (${score ?? 0}/100)`
      : `In Review · Gate Blocked (${score ?? 0}/100)`;

  return (
    <div className="rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] p-5 space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-sm text-[#111215]">
              Suggested Next Steps
            </h3>
            <span className="rounded-[4px] border border-[#E2E0D8] bg-[#F1F0EC] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-[#111215]">
              {statusBadgeText}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#787C87]">
            {syncMode === 'simulation'
              ? 'Simulated writeback preview — ready for simulated Salesforce CRM sync.'
              : 'Synchronized to simulated Salesforce CRM.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {copyFailed && (
            <span className="text-[11px] text-[#52545D] font-medium" role="status" aria-live="polite">
              Copy Failed — Select text below manually
            </span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              copied
                ? 'border-[#111215] bg-[#F1F0EC] text-[#111215]'
                : 'border-[#E2E0D8] bg-[#FFFFFF] text-[#111215] hover:bg-[#F1F0EC]'
            }`}
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-[#111215]" aria-hidden="true" />
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
        {stepsList.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2.5 rounded-md border border-[#E2E0D8] bg-[#F1F0EC]/40 p-3 text-xs leading-relaxed text-[#111215]"
          >
            <span className="font-mono text-xs font-bold text-[#787C87] shrink-0">
              {idx + 1}.
            </span>
            <p className="whitespace-pre-wrap">
              {item.label ? (
                <>
                  <strong className="font-semibold text-[#111215]">{item.label}:</strong>{' '}
                  <span className="text-[#52545D]">{item.text}</span>
                </>
              ) : (
                item.text
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface Stage3HeaderLockupProps {
  score: number;
  baselineScore?: number | null;
  scoreDelta?: number | null;
  stageGate?: (Partial<StageGateEvaluation> & { gate?: string }) | null;
  qualificationStatus?: QualificationStatus | string | null;
  stageName?: string | null;
  gapCount?: number;
  onReset: () => void | Promise<void>;
  resetButtonText?: string;
  onRerunAudit?: () => void | Promise<void>;
  rerunDisabled?: boolean;
}

export function Stage3HeaderLockup({
  score,
  baselineScore,
  scoreDelta,
  stageGate,
  qualificationStatus,
  stageName,
  gapCount = 0,
  onReset,
  resetButtonText = 'Reset Opportunity Baseline',
  onRerunAudit,
  rerunDisabled = false,
}: Stage3HeaderLockupProps) {
  const gateReadout = formatStageGateReadout({
    stageGate,
    qualificationStatus,
    stageName,
    phase: 'stage3',
    fallbackBlockerCount: gapCount,
  });

  const hasNonZeroDelta =
    scoreDelta !== null && scoreDelta !== undefined && scoreDelta !== 0;

  return (
    <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
      <div className="score-lockup flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap font-mono text-2xl font-bold tracking-tight text-[#111215] tabular-nums">
          {baselineScore !== null && baselineScore !== undefined && (
            <span className="text-sm font-medium text-[#787C87]">
              {baselineScore} →{' '}
            </span>
          )}
          <span>{score}</span>
          <span className="text-sm font-normal text-[#787C87]">/ 100</span>
          {hasNonZeroDelta && (
            <span className="text-base font-normal text-[#52545D]">
              ({scoreDelta! > 0 ? `+${scoreDelta}` : scoreDelta})
            </span>
          )}
        </div>

        <span
          className={`mono-pill rounded-[4px] border border-[#E2E0D8] bg-[#F1F0EC] px-2.5 py-1 font-mono text-[11px] font-semibold ${
            gateReadout.isSatisfied ? 'text-[#111215]' : 'text-[#52545D]'
          }`}
        >
          {gateReadout.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onRerunAudit && (
          <button
            type="button"
            disabled={rerunDisabled}
            onClick={() => {
              void onRerunAudit();
            }}
            className="flex items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#111215] hover:bg-[#F1F0EC] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="size-3 text-[#52545D]" aria-hidden="true" />
            <span>Re-run Deal Audit</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            void onReset();
          }}
          className="flex items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] cursor-pointer"
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          <span>{resetButtonText}</span>
        </button>
      </div>
    </div>
  );
}
