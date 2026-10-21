'use client';

import React from 'react';
import type { Opportunity } from '@/lib/types/crm';

interface DealContextCardProps {
  opportunity: Opportunity;
}

export function DealContextCard({ opportunity }: DealContextCardProps) {
  const competitorText =
    opportunity.competitive_flags && opportunity.competitive_flags.length > 0
      ? `${opportunity.competitive_flags.join(', ')} offered a 30% defensive renewal discount. Commercial counter-strategy required.`
      : 'Netlify offered a 30% renewal discount to preserve legacy contract. Commercial counter-strategy required.';

  const targetClose = opportunity.close_date || 'Dec 15, 2026';
  const stageOrArch = opportunity.stage_name || 'Stage 2 — Discovery';

  return (
    <div className="workbench-left flex flex-col gap-4 p-5 bg-[#FFFFFF] border-r border-[#E2E0D8]">
      {/* 2x2 Opportunity Metadata Box */}
      <div className="meta-box rounded-md border border-[#E2E0D8] bg-[#FFFFFF] p-3.5">
        <h3 className="meta-box-title text-[11px] font-semibold uppercase tracking-[0.05em] text-[#787C87] mb-3">
          Opportunity Metadata
        </h3>
        <div className="meta-data-grid grid grid-cols-2 gap-3 text-left">
          <div>
            <div className="meta-item-label text-[11px] text-[#787C87]">Account Executive</div>
            <div className="meta-item-val text-xs font-semibold text-[#111215]">
              {opportunity.ae_name || 'Sarah Jenkins'}
            </div>
          </div>
          <div>
            <div className="meta-item-label text-[11px] text-[#787C87]">Solutions Architect</div>
            <div className="meta-item-val text-xs font-semibold text-[#111215]">
              {opportunity.sa_name || 'Alex Chen'}
            </div>
          </div>
          <div>
            <div className="meta-item-label text-[11px] text-[#787C87]">Target Close</div>
            <div className="meta-item-val text-xs font-mono font-medium text-[#111215]">
              {targetClose}
            </div>
          </div>
          <div>
            <div className="meta-item-label text-[11px] text-[#787C87]">Current Stage</div>
            <div className="meta-item-val text-xs font-medium text-[#111215]">
              {stageOrArch}
            </div>
          </div>
        </div>
      </div>

      {/* Neutral Competitor Context Callout */}
      <div className="competitor-note rounded-md border border-[#E2E0D8] bg-[#F1F0EC]/60 p-3 text-xs leading-relaxed text-[#52545D]">
        <strong className="text-[#111215] font-semibold">Competitor Context: </strong>
        {competitorText}
      </div>

      {/* Mobile/Tablet (< lg) Collapsible Details */}
      <details className="lg:hidden rounded-md border border-[#E2E0D8] bg-[#FFFFFF] p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-xs tracking-[0.02em] text-[#52545D] hover:text-[#111215]">
          AE Business &amp; SA Technical Briefs
        </summary>
        <div className="mt-3 space-y-3 pt-2 border-t border-[#E2E0D8]">
          <div className="brief-block border-l-2 border-[#111215] pl-2.5">
            <div className="brief-heading text-[11px] font-semibold uppercase tracking-[0.05em] text-[#787C87] mb-1">
              AE Business Brief
            </div>
            <p className="brief-text text-xs leading-relaxed text-[#52545D] whitespace-pre-wrap">
              {opportunity.ae_notes || 'No AE business notes recorded.'}
            </p>
          </div>
          <div className="brief-block border-l-2 border-[#111215] pl-2.5">
            <div className="brief-heading text-[11px] font-semibold uppercase tracking-[0.05em] text-[#787C87] mb-1">
              SA Technical Assessment
            </div>
            <p className="brief-text text-xs leading-relaxed text-[#52545D] whitespace-pre-wrap">
              {opportunity.sa_notes || 'No SA technical notes recorded.'}
            </p>
          </div>
        </div>
      </details>

      {/* Desktop (lg+) Narrative Briefs Container with Constrained Scroll */}
      <div className="hidden lg:flex lg:flex-col lg:max-h-[680px] lg:overflow-y-auto briefs-box flex-1 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] p-3.5 space-y-4">
        <div className="brief-block border-l-2 border-[#111215] pl-2.5">
          <div className="brief-heading text-[11px] font-semibold uppercase tracking-[0.05em] text-[#787C87] mb-1">
            AE Business Brief
          </div>
          <p className="brief-text text-xs leading-relaxed text-[#52545D] whitespace-pre-wrap">
            {opportunity.ae_notes || 'No AE business notes recorded.'}
          </p>
        </div>

        <div className="brief-block border-l-2 border-[#111215] pl-2.5">
          <div className="brief-heading text-[11px] font-semibold uppercase tracking-[0.05em] text-[#787C87] mb-1">
            SA Technical Assessment
          </div>
          <p className="brief-text text-xs leading-relaxed text-[#52545D] whitespace-pre-wrap">
            {opportunity.sa_notes || 'No SA technical notes recorded.'}
          </p>
        </div>
      </div>
    </div>
  );
}
