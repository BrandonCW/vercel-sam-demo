'use client';

import React from 'react';
import { Target, Quote, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { SimulationDimension } from '@/lib/simulation/types';

export function TenSegmentBar({
  score,
  compact = false,
}: {
  score: number;
  compact?: boolean;
}) {
  const tickColor =
    score >= 8
      ? 'bg-[#059669]'
      : score >= 4
      ? 'bg-[#D97706]'
      : 'bg-[#DC2626]';

  const width = compact ? 'w-1' : 'w-1.5';
  const height = compact ? 'h-2.5' : 'h-3.5';
  const gap = compact ? 'gap-0.5' : 'gap-[3px]';

  return (
    <div
      className={`flex items-center ${gap}`}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-label={`Score ${score} of 10`}
    >
      {Array.from({ length: 10 }).map((_, i) => {
        const filled = i < score;
        return (
          <span
            key={i}
            className={`${width} ${height} rounded-[1px] transition-colors ${
              filled ? tickColor : 'bg-[#E5E5E0]'
            }`}
          />
        );
      })}
    </div>
  );
}

interface MeddpiccScorecardProps {
  score: number;
  previousScore?: number | null;
  delta?: number | null;
  dimensions: Record<string, SimulationDimension> | any[];
}

const DIMENSION_ORDER = [
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
}: MeddpiccScorecardProps) {
  const dimensionList: Array<SimulationDimension & { key: string; weightLabel: string }> = Array.isArray(dimensions)
    ? dimensions.map((d) => ({
        ...d,
        key: d.key,
        weightLabel: typeof d.weight === 'number' ? `${Math.round(d.weight * 100)}%` : String(d.weight || '10%'),
        quotes: d.quotes || (d.quote ? [d.quote] : (d as any).evidence || []),
        gaps: d.gaps || (d.gap ? [d.gap] : []),
      }))
    : DIMENSION_ORDER.map((key) => {
        const d = (dimensions as any)[key] || {
          label: key,
          score: 0,
          status: 'unaddressed' as const,
          weight: 0.1,
          quotes: [],
          gaps: [],
        };
        return {
          ...d,
          key,
          weightLabel: typeof d.weight === 'number' ? `${Math.round(d.weight * 100)}%` : String(d.weight || '10%'),
          quotes: d.quotes || (d.quote ? [d.quote] : (d as any).evidence || []),
          gaps: d.gaps || (d.gap ? [d.gap] : []),
        };
      });

  return (
    <section className="rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] shadow-xs">
      {/* Header */}
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
            {score}
            <span className="text-sm font-normal text-[#787C87]">/100</span>
            {delta && delta > 0 ? (
              <span className="ml-2 text-sm font-medium text-[#059669]">
                (+{delta})
              </span>
            ) : null}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#787C87]">
            Composite score
          </p>
        </div>
      </div>

      {/* Permanently Open 8-Row MEDDPICC Ledger */}
      <div className="divide-y divide-[#E2E0D8]">
        {dimensionList.map((dimension) => (
          <DimensionRow key={dimension.key} dimension={dimension} />
        ))}
      </div>
    </section>
  );
}

function DimensionRow({
  dimension,
}: {
  dimension: SimulationDimension & { key: string; weightLabel: string };
}) {
  const quotes = dimension.quotes || (dimension.quote ? [dimension.quote] : []);
  const gaps = dimension.gaps || (dimension.gap ? [dimension.gap] : []);
  const isUnassessed = dimension.score === 0 && quotes.length === 0 && gaps.length === 0;

  return (
    <div className="px-5 py-4 space-y-3 bg-[#FFFFFF] hover:bg-[#F8F8F6]/60 transition-colors">
      {/* Row Header with Label, Status, 10-Segment Bar & Monospace Score */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-label={`Dimension: ${dimension.label}`}
          className="flex items-baseline gap-2 text-left cursor-default focus:outline-none"
        >
          <span className="text-sm font-semibold text-[#111215]">
            {dimension.label}
          </span>
          <span className="text-xs text-[#787C87] font-mono">
            Weight {dimension.weightLabel}
          </span>
        </button>

        <div className="flex items-center gap-3">
          {/* Monochrome Status Pill */}
          <span className="rounded border border-[#E2E0D8] bg-[#F1F0EC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#52545D]">
            {dimension.status}
          </span>

          {/* 10-Segment Discrete Score Bar */}
          <TenSegmentBar score={dimension.score} />

          {/* Monospace Numeric Score with clean inline parenthetical delta */}
          <div className="min-w-[64px] text-right font-mono text-xs font-bold text-[#111215] tabular-nums">
            {dimension.score}/10
            {dimension.delta && dimension.delta > 0 && (
              <span className="ml-1 text-[#059669] font-medium">
                (+{dimension.delta})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Unassessed Note */}
      {isUnassessed && (
        <p className="text-xs italic text-[#787C87]">
          — Awaiting initial assessment
        </p>
      )}

      {/* Inline Buyer Evidence and Qualification Gaps (Always Open) */}
      <div className="grid gap-3 pt-1 text-xs sm:grid-cols-2">
        {/* Evidence Cited */}
        <div className="rounded-md border border-[#E2E0D8] bg-[#F1F0EC]/60 p-3">
          <div className="mb-2 flex items-center gap-1.5 font-semibold text-[#111215] text-[11px] uppercase tracking-wide">
            <Quote className="size-3 text-[#52545D]" aria-hidden="true" />
            <span>Buyer Evidence</span>
          </div>
          {quotes.length ? (
            quotes.map((quote, idx) => (
              <p
                key={idx}
                className="border-l-2 border-[#111215] pl-2.5 italic text-[#52545D] leading-5 mb-1.5 last:mb-0"
              >
                “{quote}”
              </p>
            ))
          ) : (
            <p className="text-[#787C87] italic">No direct buyer evidence cited.</p>
          )}
        </div>

        {/* Qualification Gaps */}
        <div className="rounded-md border border-[#E2E0D8] bg-[#F1F0EC]/60 p-3">
          <div className="mb-2 flex items-center gap-1.5 font-semibold text-[#111215] text-[11px] uppercase tracking-wide">
            <AlertCircle className="size-3 text-[#D97706]" aria-hidden="true" />
            <span>Open Gaps / Blind Spots</span>
          </div>
          {gaps.length ? (
            gaps.map((gap, idx) => (
              <p key={idx} className="flex items-start gap-1.5 text-[#52545D] leading-5 mb-1.5 last:mb-0">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#D97706]" />
                <span>{gap}</span>
              </p>
            ))
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
