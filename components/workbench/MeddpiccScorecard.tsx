'use client';

import React, { useState } from 'react';
import { Target, ChevronDown, ChevronRight } from 'lucide-react';
import type { SimulationDimension } from '@/lib/simulation/types';

interface MeddpiccScorecardProps {
  score: number;
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

export function MeddpiccScorecard({ score, dimensions }: MeddpiccScorecardProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>('economicBuyer');

  const dimensionList: Array<SimulationDimension & { key: string; weightLabel: string }> = Array.isArray(dimensions)
    ? dimensions.map((d) => ({
        ...d,
        key: d.key,
        weightLabel: typeof d.weight === 'number' ? `${Math.round(d.weight * 100)}%` : String(d.weight),
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
    <section className="rounded-xl border border-[#dfe5ed] bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-[#e8edf3] px-5 py-5">
        <div>
          <div className="flex items-center gap-2">
            <Target className="size-4 text-[#477fb8]" aria-hidden="true" />
            <h3 className="font-semibold text-[#152238]">MEDDPICC scorecard</h3>
          </div>
          <p className="mt-1 text-sm text-[#718097]">
            Evidence-based qualification across eight weighted dimensions.
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tracking-tight text-[#152238]">
            {score}
            <span className="text-base font-normal text-[#92a0b3]">/100</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#92a0b3]">
            Composite score
          </p>
        </div>
      </div>

      <div className="divide-y divide-[#e8edf3]">
        {dimensionList.map((dimension) => (
          <DimensionRow
            key={dimension.key}
            dimension={dimension}
            expanded={expandedKey === dimension.key}
            onToggle={() =>
              setExpandedKey(expandedKey === dimension.key ? null : dimension.key)
            }
          />
        ))}
      </div>
    </section>
  );
}

function DimensionRow({
  dimension,
  expanded,
  onToggle,
}: {
  dimension: SimulationDimension & { key: string; weightLabel: string };
  expanded: boolean;
  onToggle: () => void;
}) {
  const scoreTone =
    dimension.score >= 8
      ? 'text-[#2d8a69] bg-[#eaf8f1]'
      : dimension.score >= 4
      ? 'text-[#a66b08] bg-[#fff7e5]'
      : 'text-[#b45848] bg-[#fff0ed]';

  const statusTone =
    dimension.status === 'verified'
      ? 'bg-[#eaf8f1] text-[#2d8a69]'
      : dimension.status === 'partial'
      ? 'bg-[#fff7e5] text-[#a66b08]'
      : 'bg-[#fff0ed] text-[#b45848]';

  const quotes = dimension.quotes || (dimension.quote ? [dimension.quote] : []);
  const gaps = dimension.gaps || (dimension.gap ? [dimension.gap] : []);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[#fafbfd] transition cursor-pointer"
      >
        <span className="text-[#a8b3c2]">
          {expanded ? (
            <ChevronDown className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[#152238]">
            {dimension.label}
          </span>
          <span className="text-xs text-[#92a0b3]">Weight {dimension.weightLabel}</span>
        </span>
        <span
          className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${statusTone}`}
        >
          {dimension.status}
        </span>
        <span className={`flex size-9 items-center justify-center rounded-lg text-sm font-bold ${scoreTone}`}>
          {dimension.score}
        </span>
      </button>

      {expanded && (
        <div className="ml-12 mr-5 mb-4 grid gap-3 rounded-lg bg-[#f7f9fb] p-4 text-xs sm:grid-cols-2">
          <div>
            <p className="mb-2 font-semibold text-[#52647b]">Evidence cited</p>
            {quotes.length ? (
              quotes.map((quote, idx) => (
                <p
                  key={idx}
                  className="border-l-2 border-[#7aa5ce] pl-3 italic leading-5 text-[#718097] mb-1.5 last:mb-0"
                >
                  “{quote}”
                </p>
              ))
            ) : (
              <p className="text-[#a66b08]">No direct evidence cited yet.</p>
            )}
          </div>
          <div>
            <p className="mb-2 font-semibold text-[#52647b]">Qualification gaps</p>
            {gaps.length ? (
              gaps.map((gap, idx) => (
                <p key={idx} className="flex gap-2 leading-5 text-[#718097] mb-1.5 last:mb-0">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#e5a83d]" />
                  <span>{gap}</span>
                </p>
              ))
            ) : (
              <p className="text-[#2d8a69]">No open gaps identified.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
