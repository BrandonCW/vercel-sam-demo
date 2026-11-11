'use client';

import React from 'react';
import type { Opportunity } from '@/lib/types/crm';
import { parseSuggestedNextSteps } from './desk-os-shared';

interface DealContextCardProps {
  opportunity: Opportunity;
}

function formatQualificationStatusLabel(status?: Opportunity['qualification_status'] | null): string {
  switch (status) {
    case 'qualified':
      return 'Qualified';
    case 'in_review':
      return 'In Review';
    case 'disqualified':
      return 'Disqualified';
    default:
      return 'Unqualified';
  }
}

export function DealContextCard({ opportunity }: DealContextCardProps) {
  const flags = opportunity.competitive_flags || [];
  const competitorText = flags.includes('Netlify')
    ? 'Netlify offered a 30% defensive renewal discount. Commercial counter-strategy required.'
    : flags.length > 0
    ? `Active competitive pressure from ${flags.join(', ')}. Commercial and technical counter-strategy required.`
    : 'No active competitor flagged in discovery notes.';

  const targetClose = opportunity.close_date || 'Dec 15, 2026';
  const stageOrArch = opportunity.stage_name || 'Stage 2 — Discovery';
  const parsedNextSteps = parseSuggestedNextSteps(opportunity.suggested_next_steps);
  const hasCrmWriteback = parsedNextSteps.length > 0;
  const statusLabel = formatQualificationStatusLabel(opportunity.qualification_status);

  return (
    <div className="workbench-left flex flex-col gap-4 p-5 bg-[#FFFFFF] border-b lg:border-b-0 lg:border-r border-[#E2E0D8]">
      {/* 2x2 Opportunity Metadata Box */}
      <div className="meta-box rounded-md border border-[#E2E0D8] bg-[#FFFFFF] p-3.5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="meta-box-title text-[11px] font-semibold uppercase tracking-[0.05em] text-[#787C87]">
            Opportunity Metadata
          </h3>
          <span
            data-testid="crm-qualification-status"
            className="rounded-[4px] border border-[#E2E0D8] bg-[#F1F0EC] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-[#52545D]"
          >
            {statusLabel}
          </span>
        </div>
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
              {opportunity.sa_name || 'David Kross'}
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

      {/* CRM Writeback Record (shown once written back to Opportunity) */}
      {hasCrmWriteback && (
        <div
          data-testid="crm-writeback-card"
          className="rounded-md border border-[#E2E0D8] bg-[#F8F8F6] p-3.5 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#787C87]">
              CRM Qualification Writeback
            </h3>
            <span className="rounded-[4px] border border-[#E2E0D8] bg-[#FFFFFF] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-[#111215]">
              {statusLabel}
            </span>
          </div>
          <ul className="space-y-1 text-xs leading-relaxed text-[#52545D]">
            {parsedNextSteps.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#787C87]" aria-hidden="true" />
                <span>
                  {item.label ? (
                    <>
                      <strong className="font-semibold text-[#111215]">{item.label}:</strong>{' '}
                      {item.text}
                    </>
                  ) : (
                    item.text
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
