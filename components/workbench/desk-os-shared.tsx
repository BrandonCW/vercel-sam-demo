'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clipboard, Check, AlertCircle, RefreshCw, XCircle, RotateCcw } from 'lucide-react';
import type { Opportunity, QualificationStatus, StageGateEvaluation } from '@/lib/types/crm';

export interface ParsedNextStepItem {
  label?: string;
  text: string;
  raw: string;
}

export interface SuggestedNextStepsMetadata {
  owner?: string | null;
  focus?: string | null;
  watch?: string | null;
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

interface StructuredNextStepsView {
  leadAction: string;
  metadata: Array<{ key: 'owner' | 'focus' | 'watch'; label: string; value: string }>;
}

/**
 * Separates lead action prose from structured `Owner`, `Focus`, and `Watch`
 * metadata across both pipe-delimited backend strings and inline fixture prose.
 */
export function extractStructuredNextSteps(
  steps: string | string[] | null | undefined,
  fallbackMetadata?: SuggestedNextStepsMetadata
): StructuredNextStepsView | null {
  const items = parseSuggestedNextSteps(steps);
  if (items.length === 0) return null;

  const actionParts: string[] = [];
  let owner: string | undefined;
  let focus: string | undefined;
  let watch: string | undefined;

  for (const item of items) {
    const normalizedLabel = item.label?.toLowerCase();
    if (normalizedLabel === 'owner') {
      owner = item.text;
    } else if (normalizedLabel === 'focus') {
      focus = item.text;
    } else if (normalizedLabel === 'watch') {
      watch = item.text;
    } else {
      actionParts.push(item.text);
    }
  }

  let leadAction = actionParts.join(' ').trim();

  // Handle single-paragraph fixture prose with inline "Owner: ... . Action: ..."
  if (!owner && /\bOwner:\s*/i.test(leadAction)) {
    const ownerMatch = leadAction.match(/\bOwner:\s*([^.|]+?)(?:\.\s*|$)/i);
    if (ownerMatch) {
      owner = ownerMatch[1].trim();
      leadAction = leadAction.replace(ownerMatch[0], ' ').trim();
    }
  }
  if (!focus && /\bFocus:\s*/i.test(leadAction)) {
    const focusMatch = leadAction.match(/\bFocus:\s*([^.|]+?)(?:\.\s*|$)/i);
    if (focusMatch) {
      focus = focusMatch[1].trim();
      leadAction = leadAction.replace(focusMatch[0], ' ').trim();
    }
  }
  if (!watch && /\bWatch:\s*/i.test(leadAction)) {
    const watchMatch = leadAction.match(/\bWatch:\s*([^.|]+?)(?:\.\s*|$)/i);
    if (watchMatch) {
      watch = watchMatch[1].trim();
      leadAction = leadAction.replace(watchMatch[0], ' ').trim();
    }
  }

  leadAction = leadAction.replace(/\bAction:\s*/gi, '').replace(/\s{2,}/g, ' ').trim();

  const resolvedOwner = owner || fallbackMetadata?.owner?.trim() || undefined;
  const resolvedFocus = focus || fallbackMetadata?.focus?.trim() || undefined;
  const resolvedWatch = watch || fallbackMetadata?.watch?.trim() || undefined;

  const metadata: Array<{ key: 'owner' | 'focus' | 'watch'; label: string; value: string }> = [];
  if (resolvedOwner) metadata.push({ key: 'owner', label: 'OWNER', value: resolvedOwner });
  if (resolvedFocus) metadata.push({ key: 'focus', label: 'FOCUS', value: resolvedFocus });
  if (resolvedWatch) metadata.push({ key: 'watch', label: 'WATCH', value: resolvedWatch });

  return {
    leadAction: leadAction || items[0].text,
    metadata,
  };
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

  const hasExplicitGate =
    stageGate !== null && stageGate !== undefined && typeof stageGate.gateReady === 'boolean';
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
    : Math.max(
        fallbackBlockerCount,
        qualificationStatus === 'in_review' || qualificationStatus === 'disqualified' ? 1 : 0
      );

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
      label: `${gateLabel} · ${blockerCount} ${
        blockerCount === 1 ? 'Blocker' : 'Blockers'
      } Remaining`,
      isSatisfied: false,
      blockerCount,
    };
  }

  return {
    gateLabel,
    label: `${gateLabel} · ${blockerCount} Gate ${
      blockerCount === 1 ? 'Blocker' : 'Blockers'
    } Identified`,
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
    <div className="monochrome-top-bar flex flex-col sm:flex-row sm:min-h-12 items-start sm:items-center justify-between gap-2 border-b border-[#E2E0D8] bg-[#FFFFFF] px-4 py-2.5 sm:px-5 sm:py-2.5">
      <div className="bar-left flex w-full sm:w-auto min-w-0 sm:flex-1 items-center gap-2.5 sm:gap-3">
        <div className="bar-logo flex shrink-0 items-center gap-2 font-sans text-kicker font-semibold uppercase text-[#636772] whitespace-nowrap">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            className="text-[#111215]"
            aria-hidden="true"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>DEAL DESK</span>
        </div>
        <div className="bar-divider h-4 w-px shrink-0 bg-[#E2E0D8]" aria-hidden="true" />
        <h1 className="opp-title min-w-0 font-sans text-base leading-snug font-semibold tracking-tight text-[#111215] truncate">
          {opportunity.name || 'Acme Corp – Platform Migration'}
        </h1>
      </div>

      <div className="bar-right flex flex-wrap shrink-0 items-center gap-2 font-sans text-xs sm:text-sm tabular-nums text-[#52545D]">
        <span>{stageDisplay}</span>
        <span aria-hidden="true" className="text-[#636772]">
          ·
        </span>
        <span className="font-semibold text-[#111215]">{formattedAmount}</span>
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
      className="rounded-lg border border-[#111215] bg-[#F1F0EC] p-4 font-sans text-sm text-[#111215] space-y-2.5"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="size-4 text-[#111215] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <div className="font-semibold text-sm text-[#111215]">{problem}</div>
          {sanitizedCause && (
            <div className="text-sm text-[#52545D] break-words leading-relaxed">
              {sanitizedCause}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-[#E2E0D8]">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#111215] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-semibold leading-none text-[#111215] hover:bg-[#F8F8F6] cursor-pointer"
          >
            <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="ui-pill-label">Retry</span>
          </button>
        )}

        {onSwitchToSimulation && (
          <button
            type="button"
            onClick={onSwitchToSimulation}
            className="inline-flex min-h-8 items-center rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#52545D] hover:bg-[#F8F8F6] hover:text-[#111215] cursor-pointer"
          >
            <span className="ui-pill-label">Switch to Simulation Mode</span>
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1.5 font-sans text-xs font-medium leading-none text-[#636772] hover:text-[#111215] cursor-pointer"
          >
            <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="ui-pill-label">Dismiss</span>
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
  fallbackMetadata?: SuggestedNextStepsMetadata;
}

export function SuggestedNextStepsCard({
  nextSteps,
  syncMode = 'live',
  fallbackMetadata,
}: SuggestedNextStepsCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const structured = extractStructuredNextSteps(nextSteps, fallbackMetadata);
  const copyText = formatSuggestedNextStepsCopyText(nextSteps);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (!structured) return null;

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

  return (
    <div className="font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-3 mb-3.5">
        <div>
          <h2 className="font-sans text-base font-semibold tracking-tight text-[#111215]">
            Suggested Next Steps
          </h2>
          <p className="mt-0.5 font-sans text-xs text-[#636772]">
            {syncMode === 'simulation'
              ? 'Simulation preview · Simulated Salesforce CRM'
              : 'Synced to simulated Salesforce CRM'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {copyFailed && (
            <span
              className="font-sans text-xs text-[#52545D] font-medium"
              role="status"
              aria-live="polite"
            >
              Copy failed — select text below manually
            </span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy Next Steps"
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-3 py-1.5 font-sans text-xs font-medium leading-none transition cursor-pointer ${
              copied
                ? 'border-[#111215] bg-[#F1F0EC] text-[#111215]'
                : 'border-[#E2E0D8] bg-[#FFFFFF] text-[#111215] hover:bg-[#F1F0EC]'
            }`}
          >
            {copied ? (
              <>
                <Check className="size-3.5 shrink-0 text-[#111215]" aria-hidden="true" />
                <span className="ui-pill-label" role="status" aria-live="polite">
                  Copied
                </span>
              </>
            ) : (
              <>
                <Clipboard className="size-3.5 shrink-0 text-[#52545D]" aria-hidden="true" />
                <span className="ui-pill-label">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <p className="font-sans text-sm text-[#111215] leading-relaxed text-pretty">
        {structured.leadAction}
      </p>

      {structured.metadata.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#E2E0D8] pt-3">
          {structured.metadata.map((meta) => (
            <div key={meta.key} className="min-w-0">
              <div className="font-sans text-kicker font-semibold uppercase text-[#636772]">
                {meta.label}
              </div>
              <div className="mt-0.5 font-sans text-xs font-medium text-[#111215] leading-snug text-pretty">
                {meta.value}
              </div>
            </div>
          ))}
        </div>
      )}
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
  const deltaLabel =
    hasNonZeroDelta && scoreDelta ? (scoreDelta > 0 ? `+${scoreDelta}` : String(scoreDelta)) : '';

  return (
    <div className="stage-header-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E0D8] pb-4">
      <div className="flex min-h-9 flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="flex items-center whitespace-nowrap font-sans tabular-nums">
          <span className="text-sm leading-5 font-semibold text-[#111215]">
            {score}
          </span>
          <span className="ml-1 text-sm leading-5 font-medium text-[#636772]">
            / 100{hasNonZeroDelta ? ` (${deltaLabel})` : ''}
          </span>
        </div>

        <span aria-hidden="true" className="hidden sm:block h-3.5 w-px bg-[#E2E0D8] shrink-0" />

        <span
          className={`font-sans text-sm leading-5 font-medium tabular-nums ${
            gateReadout.isSatisfied ? 'text-[#111215]' : 'text-[#52545D]'
          }`}
        >
          {gateReadout.label}
        </span>
      </div>

      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {onRerunAudit && (
          <button
            type="button"
            disabled={rerunDisabled}
            onClick={() => {
              void onRerunAudit();
            }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#111215] hover:bg-[#F1F0EC] transition cursor-pointer disabled:bg-[#F8F8F6] disabled:text-[#636772] disabled:cursor-not-allowed"
          >
            <RefreshCw className="size-3.5 shrink-0 text-[#52545D]" aria-hidden="true" />
            <span className="ui-pill-label">Re-run Deal Audit</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            void onReset();
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer"
        >
          <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="ui-pill-label">{resetButtonText}</span>
        </button>
      </div>
    </div>
  );
}
