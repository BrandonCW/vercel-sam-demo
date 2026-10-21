'use client';

import React from 'react';
import { Target, Quote, AlertCircle, CheckCircle2, Loader2, Ban } from 'lucide-react';
import type { SimulationDimension } from '@/lib/simulation/types';

export interface TenSegmentBarProps {
  score: number | null;
  previousScore?: number | null;
  compact?: boolean;
  animateStagger?: boolean;
  ariaLabel?: string;
}

export function TenSegmentBar({
  score,
  previousScore,
  compact = false,
  animateStagger = false,
  ariaLabel,
}: TenSegmentBarProps) {
  const currentScore = score ?? 0;
  const isUnassessed = score === null || score === undefined;

  const tickColor =
    currentScore >= 8
      ? 'bg-[#059669]'
      : currentScore >= 4
      ? 'bg-[#D97706]'
      : 'bg-[#DC2626]';

  const width = compact ? 'w-1' : 'w-1.5';
  const height = compact ? 'h-2.5' : 'h-3.5';
  const gap = compact ? 'gap-0.5' : 'gap-[3px]';

  return (
    <div
      className={`flex items-center ${gap}`}
      role="meter"
      aria-valuenow={isUnassessed ? 0 : currentScore}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-label={ariaLabel || (isUnassessed ? 'Unassessed' : `Score ${currentScore} of 10`)}
    >
      {Array.from({ length: 10 }).map((_, i) => {
        const filled = !isUnassessed && i < currentScore;
        const style: React.CSSProperties | undefined = animateStagger
          ? { transitionDelay: `${i * 40}ms` }
          : undefined;

        return (
          <span
            key={i}
            style={style}
            className={`${width} ${height} rounded-[1px] transition-colors duration-200 motion-reduce:transition-none motion-reduce:!delay-0 ${
              filled ? tickColor : 'bg-[#E5E5E0]'
            }`}
          />
        );
      })}
    </div>
  );
}

export type ScorecardMode = 'unassessed' | 'loading' | 'audit' | 'completed';

export interface MeddpiccScorecardProps {
  score?: number | null;
  previousScore?: number | null;
  delta?: number | null;
  dimensions: Record<string, SimulationDimension> | any[];
  mode?: ScorecardMode;
  loadingStatus?: string;
  elapsedSeconds?: number;
  onAbort?: () => void;
  hideHeader?: boolean;
}

export const DIMENSION_META: Record<string, { letter: string; label: string }> = {
  identifyPain: { letter: 'I', label: 'Identify Pain' },
  champion: { letter: 'C', label: 'Champion' },
  economicBuyer: { letter: 'E', label: 'Economic Buyer' },
  decisionCriteria: { letter: 'D', label: 'Decision Criteria' },
  decisionProcess: { letter: 'DP', label: 'Decision Process' },
  metrics: { letter: 'M', label: 'Metrics' },
  competition: { letter: 'CO', label: 'Competition' },
  paperProcess: { letter: 'P', label: 'Paper Process' },
};

export const DIMENSION_ORDER = [
  'identifyPain',
  'champion',
  'economicBuyer',
  'decisionCriteria',
  'decisionProcess',
  'metrics',
  'competition',
  'paperProcess',
];

export function MeddpiccScorecard({
  score,
  previousScore,
  delta,
  dimensions,
  mode: explicitMode,
  loadingStatus,
  elapsedSeconds,
  onAbort,
  hideHeader = false,
}: MeddpiccScorecardProps) {
  // Infer mode if not passed explicitly for backward compatibility
  const mode: ScorecardMode =
    explicitMode ??
    (score === 0 && !previousScore && !delta ? 'unassessed' : delta || previousScore ? 'completed' : 'audit');

  const dimensionList: Array<SimulationDimension & { key: string; weightLabel: string; letter: string }> = Array.isArray(dimensions)
    ? dimensions.map((d) => {
        const meta = DIMENSION_META[d.key] || { letter: d.key.charAt(0).toUpperCase(), label: d.label || d.key };
        return {
          ...d,
          key: d.key,
          label: d.label || meta.label,
          letter: meta.letter,
          weightLabel: typeof d.weight === 'number' ? `${Math.round(d.weight * 100)}%` : String(d.weight || '10%'),
          quotes: d.quotes || (d.quote ? [d.quote] : (d as any).evidence || []),
          gaps: d.gaps || (d.gap ? [d.gap] : []),
        };
      })
    : DIMENSION_ORDER.map((key) => {
        const meta = DIMENSION_META[key] || { letter: key.charAt(0).toUpperCase(), label: key };
        const d = (dimensions as any)[key] || {
          label: meta.label,
          score: 0,
          status: 'unaddressed' as const,
          weight: 0.1,
          quotes: [],
          gaps: [],
        };
        return {
          ...d,
          key,
          label: d.label || meta.label,
          letter: meta.letter,
          weightLabel: typeof d.weight === 'number' ? `${Math.round(d.weight * 100)}%` : String(d.weight || '10%'),
          quotes: d.quotes || (d.quote ? [d.quote] : (d as any).evidence || []),
          gaps: d.gaps || (d.gap ? [d.gap] : []),
        };
      });

  return (
    <section className="meddpicc-table rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] shadow-xs overflow-hidden">
      {/* Loading In-Place Shimmer Header */}
      {mode === 'loading' && (
        <div className="flex items-center justify-between border-b border-[#E2E0D8] bg-[#F8F8F6] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Loader2 className="size-4 animate-spin text-[#0F52BA]" aria-hidden="true" />
            <span className="text-xs font-semibold text-[#111215]" role="status" aria-live="polite">
              {loadingStatus || 'Synthesizing Discovery Findings & Re-Scoring Deal...'}
            </span>
            {elapsedSeconds !== undefined && (
              <span className="rounded bg-[#E2E0D8] px-1.5 py-0.5 font-mono text-[11px] text-[#52545D]">
                {elapsedSeconds}s
              </span>
            )}
          </div>

          {onAbort && (
            <button
              type="button"
              onClick={onAbort}
              className="flex items-center gap-1 rounded border border-[#E2E0D8] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#DC2626] hover:bg-[#F1F0EC] cursor-pointer"
            >
              <Ban className="size-3" aria-hidden="true" />
              <span>Abort</span>
            </button>
          )}
        </div>
      )}

      {/* Standard Header (if not hidden and not loading) */}
      {!hideHeader && mode !== 'loading' && (
        <div className="flex items-center justify-between border-b border-[#E2E0D8] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Target className="size-4 text-[#0F52BA]" aria-hidden="true" />
              <h3 className="font-semibold text-sm text-[#111215]">MEDDPICC scorecard</h3>
            </div>
            <p className="mt-1 text-xs text-[#787C87]">
              Evidence-based qualification across eight weighted dimensions. Permanently open ledger.
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-bold tracking-tight text-[#111215] tabular-nums">
              {mode === 'unassessed' ? (
                <span className="text-[#787C87]">--</span>
              ) : (
                score ?? 0
              )}
              <span className="text-sm font-normal text-[#787C87]">/100</span>
              {mode === 'completed' && delta && delta > 0 ? (
                <span className="ml-2 text-sm font-medium text-[#059669]">
                  (+{delta})
                </span>
              ) : null}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#787C87]">
              Composite score
            </p>
          </div>
        </div>
      )}

      {/* 4-Column Table Header */}
      <div className="hidden md:grid md:grid-cols-[150px_160px_1fr_1fr] gap-3 border-b border-[#E2E0D8] bg-[#F8F8F6] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#787C87]">
        <div>Dimension</div>
        <div>Score &amp; Bar</div>
        <div>Verified Evidence</div>
        <div>{mode === 'completed' ? 'Resolved Status' : 'Open Gap / Blind Spot'}</div>
      </div>

      {/* Permanently Open 8-Row MEDDPICC Ledger */}
      <div className="divide-y divide-[#E2E0D8]">
        {dimensionList.map((dimension) => (
          <ScorecardRow
            key={dimension.key}
            dimension={dimension}
            mode={mode}
          />
        ))}
      </div>
    </section>
  );
}

function ScorecardRow({
  dimension,
  mode,
}: {
  dimension: SimulationDimension & { key: string; weightLabel: string; letter: string };
  mode: ScorecardMode;
}) {
  const quotes = dimension.quotes || (dimension.quote ? [dimension.quote] : []);
  const gaps = dimension.gaps || (dimension.gap ? [dimension.gap] : []);
  const isUnassessed = mode === 'unassessed';
  const isLoading = mode === 'loading';
  const isCompleted = mode === 'completed';

  // Blocker rows in Stage 1 have recessed #F1F0EC background
  const isBlocker = mode === 'audit' && (dimension.score <= 3 || dimension.status === 'unaddressed');

  return (
    <div
      className={`px-5 py-4 transition-colors ${
        isBlocker ? 'bg-[#F1F0EC]' : 'bg-[#FFFFFF] hover:bg-[#F8F8F6]/60'
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-[150px_160px_1fr_1fr] gap-3 items-start">
        {/* Column 1: Dimension Letter + Label + Weight */}
        <div>
          <div className="flex items-baseline gap-1.5 text-left">
            <span className="font-mono text-xs font-bold text-[#787C87] uppercase">
              [{dimension.letter}]
            </span>
            <span className="text-xs font-semibold text-[#111215]">
              {dimension.label}
            </span>
          </div>
          <div className="text-[11px] text-[#787C87] font-mono mt-0.5">
            Weight {dimension.weightLabel}
          </div>
          <span className="mt-1 inline-block rounded border border-[#E2E0D8] bg-[#F1F0EC] px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-[#52545D]">
            {isUnassessed ? 'unassessed' : dimension.status}
          </span>
        </div>

        {/* Column 2: 10-Segment Discrete Score Bar & Monospace Score */}
        <div>
          <div className="flex items-center gap-2">
            <TenSegmentBar
              score={isUnassessed ? null : dimension.score}
              previousScore={dimension.previousScore}
              animateStagger={isCompleted}
            />
          </div>

          <div className="mt-1 font-mono text-xs tabular-nums text-[#111215]">
            {isUnassessed ? (
              <span className="text-[#787C87]">--/10</span>
            ) : isCompleted && dimension.previousScore !== undefined && dimension.previousScore !== null && dimension.delta ? (
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] text-[#787C87] font-medium">
                  {dimension.previousScore} →
                </span>
                <span className="font-bold">{dimension.score}/10</span>
                <span className="text-[11px] text-[#059669] font-medium">
                  (+{dimension.delta})
                </span>
              </div>
            ) : (
              <span className="font-bold">{dimension.score}/10</span>
            )}
          </div>
        </div>

        {/* Column 3: Verified Evidence */}
        <div className="text-xs leading-relaxed text-[#52545D]">
          <div className="md:hidden font-semibold text-[11px] uppercase text-[#787C87] mb-1">
            Buyer Evidence
          </div>
          {isLoading ? (
            <div className="space-y-1.5">
              <div className="h-3 bg-[#E2E0D8]/60 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-[#E2E0D8]/40 rounded animate-pulse w-1/2" />
            </div>
          ) : isUnassessed ? (
            <p className="text-xs italic text-[#787C87]">— Awaiting initial assessment</p>
          ) : quotes.length ? (
            quotes.map((quote, idx) => (
              <p
                key={idx}
                className="border-l-2 border-[#111215] pl-2 italic text-[#52545D] leading-5 mb-1.5 last:mb-0"
              >
                “{quote}”
              </p>
            ))
          ) : (
            <p className="text-[#787C87] italic">No direct buyer evidence cited.</p>
          )}
        </div>

        {/* Column 4: Open Gap / Blind Spot OR Resolved Status */}
        <div className="text-xs leading-relaxed text-[#52545D]">
          <div className="md:hidden font-semibold text-[11px] uppercase text-[#787C87] mb-1">
            {isCompleted ? 'Resolved Status' : 'Open Gaps / Blind Spots'}
          </div>

          {isLoading ? (
            <div className="space-y-1.5">
              <div className="h-3 bg-[#E2E0D8]/60 rounded animate-pulse w-2/3" />
              <div className="h-3 bg-[#E2E0D8]/40 rounded animate-pulse w-1/3" />
            </div>
          ) : isUnassessed ? (
            <p className="text-xs text-[#787C87]">—</p>
          ) : isCompleted ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#059669] font-medium">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>Verified in discovery</span>
              </div>
              {quotes.length > 0 && (
                <p className="text-[11px] text-[#787C87]">Gap resolved by SA field notes.</p>
              )}
            </div>
          ) : gaps.length ? (
            <div className="space-y-1.5">
              {isBlocker && (
                <span className="inline-block rounded bg-[#DC2626]/10 text-[#DC2626] font-mono text-[11px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
                  BLOCKER
                </span>
              )}
              {gaps.map((gap, idx) => (
                <p key={idx} className="flex items-start gap-1.5 text-[#52545D] leading-5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#D97706]" />
                  <span>{gap}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[#059669] font-medium">
              <CheckCircle2 className="size-3.5" />
              <span>Criteria verified, no blocking gaps.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
