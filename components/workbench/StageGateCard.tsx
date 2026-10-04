'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { StageGateEvaluation } from '@/lib/types/crm';

interface StageGateCardProps {
  score: number;
  complete: boolean;
  stageGate?: StageGateEvaluation;
  dimensions?: Record<string, any> | any[];
}

export function StageGateCard({
  score,
  complete,
  dimensions = {},
}: StageGateCardProps) {
  const getScore = (key: string, fallback: number) => {
    if (!dimensions) return fallback;
    if (Array.isArray(dimensions)) {
      const dim = dimensions.find((d) => d.key === key);
      return dim ? dim.score : fallback;
    }
    const dim = dimensions[key];
    return dim ? dim.score : fallback;
  };

  const painScore = getScore('identifyPain', complete ? 9 : 9);
  const champScore = getScore('champion', complete ? 7 : 7);
  const metricsScore = getScore('metrics', complete ? 6 : 6);
  const ebScore = getScore('economicBuyer', complete ? 8 : 3);

  const criteria = [
    { label: 'Pain', value: painScore, min: 6 },
    { label: 'Champion', value: champScore, min: 5 },
    { label: 'Metrics', value: metricsScore, min: 4 },
    { label: 'Economic Buyer', value: ebScore, min: 4 },
    { label: 'Composite', value: score, min: 50 },
  ];

  const blockersCount = criteria.filter((c) => c.value < c.min).length;

  return (
    <section className="rounded-xl border border-[#dfe5ed] bg-white shadow-xs">
      <div className="border-b border-[#e8edf3] px-5 py-5">
        <div className="flex items-center gap-2">
          <ShieldAlert
            className={`size-4 ${complete ? 'text-[#2d8a69]' : 'text-[#e5a83d]'}`}
            aria-hidden="true"
          />
          <h3 className="font-semibold text-[#152238]">Stage Gate 2</h3>
        </div>
        <p className="mt-1 text-sm text-[#718097]">Discovery → Technical Validation</p>
      </div>

      <div className="flex flex-col gap-3 p-5">
        {criteria.map((item) => {
          const satisfies = item.value >= item.min;
          return (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-[#52647b]">
                {item.label} <span className="text-xs text-[#a8b3c2]">≥ {item.min}</span>
              </span>
              <span
                className={`font-semibold ${
                  satisfies ? 'text-[#2d8a69]' : 'text-[#b45848]'
                }`}
              >
                {item.value} {satisfies ? '✓' : '×'}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className={`border-t px-5 py-4 text-xs font-semibold ${
          complete
            ? 'border-[#b9dfcf] bg-[#eaf8f1] text-[#256b50]'
            : 'border-[#ead9b4] bg-[#fff8e7] text-[#795711]'
        }`}
      >
        {complete
          ? 'Gate criteria satisfied'
          : `${blockersCount} blocker${blockersCount === 1 ? '' : 's'} remaining before advancement`}
      </div>
    </section>
  );
}
