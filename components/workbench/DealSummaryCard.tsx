'use client';

import React from 'react';

interface DealSummaryCardProps {
  score: number;
  statusLabel: string;
}

export function DealSummaryCard({ score, statusLabel }: DealSummaryCardProps) {
  const isQualified = statusLabel.includes('QUALIFIED');
  const isInReview = statusLabel.includes('REVIEW');

  const statusTone = isQualified
    ? 'text-[#2d8a69]'
    : isInReview
    ? 'text-[#a66b08]'
    : 'text-[#52647b]';

  return (
    <section className="rounded-xl border border-[#dfe5ed] bg-white shadow-xs">
      <div className="border-b border-[#e8edf3] px-5 py-5">
        <h3 className="font-semibold text-[#152238]">Assessment summary</h3>
        <p className="mt-1 text-sm text-[#718097]">
          {isQualified
            ? `Qualification Finalized (${score}/100)`
            : isInReview
            ? `System 2 Reasoning Complete (${score}/100)`
            : 'Current qualification posture'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5">
        <div className="rounded-lg bg-[#f7f9fb] p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#92a0b3]">Composite</p>
          <p className="mt-1 text-xl font-semibold text-[#152238]">
            {score}
            <span className="text-sm font-normal text-[#92a0b3]">/100</span>
          </p>
        </div>
        <div className="rounded-lg bg-[#f7f9fb] p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#92a0b3]">Status</p>
          <p className={`mt-1 text-sm font-semibold truncate ${statusTone}`}>
            {statusLabel}
          </p>
        </div>
      </div>
    </section>
  );
}
