'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import type { Opportunity } from '@/lib/types/crm';

interface DealContextCardProps {
  opportunity: Opportunity;
}

export function DealContextCard({ opportunity }: DealContextCardProps) {
  const formattedAmount = opportunity.amount
    ? `$${(Number(opportunity.amount) / 1000).toFixed(0)}K ACV`
    : '$180K ACV';

  return (
    <section className="rounded-xl border border-[#dfe5ed] bg-white shadow-xs">
      <div className="flex flex-col justify-between gap-4 border-b border-[#e8edf3] px-5 py-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#477fb8]" aria-hidden="true" />
            <h3 className="font-semibold text-[#152238]">Deal context</h3>
          </div>
          <p className="mt-1 text-sm text-[#718097]">
            The source material used for this assessment.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-md bg-[#f1f4f8] px-2.5 py-1.5 font-medium text-[#52647b]">
            {opportunity.stage_name || 'Stage 2 — Discovery'}
          </span>
          <span className="rounded-md bg-[#fff2d4] px-2.5 py-1.5 font-medium text-[#966719]">
            {formattedAmount}
          </span>
        </div>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#92a0b3]">
            AE business notes
          </p>
          <p className="text-sm leading-6 text-[#52647b] whitespace-pre-wrap">
            {opportunity.ae_notes || 'No AE notes recorded.'}
          </p>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#92a0b3]">
            SA technical notes
          </p>
          <p className="text-sm leading-6 text-[#52647b] whitespace-pre-wrap">
            {opportunity.sa_notes || 'No SA notes recorded.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-[#e8edf3] sm:grid-cols-4">
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-[#92a0b3]">AE owner</p>
          <p className="mt-1 text-sm font-medium text-[#152238]">
            {opportunity.ae_name || 'Sarah Jenkins'}
          </p>
        </div>
        <div className="border-l border-[#e8edf3] px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-[#92a0b3]">SA owner</p>
          <p className="mt-1 text-sm font-medium text-[#152238]">
            {opportunity.sa_name || 'Alex Chen'}
          </p>
        </div>
        <div className="border-t border-[#e8edf3] px-5 py-4 sm:border-l sm:border-t-0">
          <p className="text-[10px] uppercase tracking-wider text-[#92a0b3]">Competitor</p>
          <p className="mt-1 text-sm font-medium text-[#a66b08]">
            {opportunity.competitive_flags?.join(', ') || 'Netlify Enterprise'}
          </p>
        </div>
        <div className="border-l border-t border-[#e8edf3] px-5 py-4 sm:border-t-0">
          <p className="text-[10px] uppercase tracking-wider text-[#92a0b3]">Timeline</p>
          <p className="mt-1 text-sm font-medium text-[#152238]">
            {opportunity.close_date
              ? `Target: ${opportunity.close_date}`
              : '60 days to renewal'}
          </p>
        </div>
      </div>
    </section>
  );
}
