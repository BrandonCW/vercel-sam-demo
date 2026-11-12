'use client';

import React from 'react';
import type { Opportunity } from '@/lib/types/crm';

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

function renderSaNotes(saNotes?: string | null) {
  if (!saNotes || !saNotes.trim()) {
    return (
      <p className="brief-text font-sans text-sm leading-relaxed text-[#52545D] whitespace-pre-wrap text-pretty">
        No SA technical notes recorded.
      </p>
    );
  }

  const parts = saNotes.split(/\n*\[SA Discovery Update - ([^\]]+)\]\n*/);
  const baselineText = parts[0]?.trim() || '';
  const updates: Array<{ dateLabel: string; content: string }> = [];

  for (let i = 1; i < parts.length; i += 2) {
    const rawIso = parts[i]?.trim() || '';
    const content = parts[i + 1]?.trim() || '';
    if (!content) continue;
    const dateLabel = /^\d{4}-\d{2}-\d{2}/.test(rawIso) ? rawIso.slice(0, 10) : rawIso;
    updates.push({ dateLabel, content });
  }

  return (
    <>
      {baselineText && (
        <p className="brief-text font-sans text-sm leading-relaxed text-[#52545D] whitespace-pre-wrap text-pretty">
          {baselineText}
        </p>
      )}
      {updates.map((update, idx) => (
        <div
          key={`${update.dateLabel}-${idx}`}
          className={baselineText || idx > 0 ? 'mt-3 pt-3 border-t border-[#ECEAE3]' : undefined}
        >
          <div className="font-sans text-xs font-semibold text-[#636772] mb-1.5 tabular-nums">
            SA Discovery Update · {update.dateLabel}
          </div>
          <p className="brief-text font-sans text-sm leading-relaxed text-[#52545D] whitespace-pre-wrap text-pretty">
            {update.content}
          </p>
        </div>
      ))}
    </>
  );
}

export function DealContextCard({ opportunity }: DealContextCardProps) {
  const flags = opportunity.competitive_flags || [];
  const competitorText = flags.includes('Netlify')
    ? 'Netlify offered a 30% defensive renewal discount. Commercial counter-strategy required.'
    : flags.length > 0
    ? `Active competitive pressure from ${flags.join(', ')}. Commercial and technical counter-strategy required.`
    : 'No active competitor flagged in discovery notes.';

  const accountName = opportunity.account_name || 'Acme Global';
  const targetClose = opportunity.close_date || 'Dec 15, 2026';
  const statusLabel = formatQualificationStatusLabel(opportunity.qualification_status);

  return (
    <div className="workbench-left flex flex-col gap-4 p-5 bg-[#FFFFFF] border-b lg:border-b-0 lg:border-r border-[#E2E0D8] font-sans">
      {/* 2x2 Opportunity Metadata Section */}
      <div className="meta-box pb-4 border-b border-[#E2E0D8]">
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="meta-box-title font-sans text-kicker font-semibold uppercase text-[#636772]">
            Opportunity Metadata
          </div>
          <span className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-[#52545D]">
            <span
              aria-hidden="true"
              className={
                opportunity.qualification_status === 'qualified'
                  ? 'size-1.5 shrink-0 rounded-full bg-[#111215]'
                  : opportunity.qualification_status === 'in_review'
                  ? 'size-1.5 shrink-0 rounded-full bg-[#636772]'
                  : 'size-1.5 shrink-0 rounded-full border border-[#636772] bg-transparent'
              }
            />
            <span
              data-testid="crm-qualification-status"
              className={
                opportunity.qualification_status === 'qualified'
                  ? 'font-semibold text-[#111215]'
                  : undefined
              }
            >
              {statusLabel}
            </span>
          </span>
        </div>
        <div className="meta-data-grid grid grid-cols-2 gap-3.5 text-left">
          <div>
            <div className="meta-item-label font-sans text-xs text-[#636772]">
              Account Executive
            </div>
            <div className="meta-item-val mt-0.5 font-sans text-sm font-medium text-[#111215]">
              {opportunity.ae_name || 'Sarah Jenkins'}
            </div>
          </div>
          <div>
            <div className="meta-item-label font-sans text-xs text-[#636772]">
              Solutions Architect
            </div>
            <div className="meta-item-val mt-0.5 font-sans text-sm font-medium text-[#111215]">
              {opportunity.sa_name || 'David Kross'}
            </div>
          </div>
          <div>
            <div className="meta-item-label font-sans text-xs text-[#636772]">Account</div>
            <div className="meta-item-val mt-0.5 font-sans text-sm font-medium text-[#111215]">
              {accountName}
            </div>
          </div>
          <div>
            <div className="meta-item-label font-sans text-xs text-[#636772]">Target Close</div>
            <div className="meta-item-val mt-0.5 font-sans text-sm font-medium text-[#111215] tabular-nums">
              {targetClose}
            </div>
          </div>
        </div>
      </div>

      {/* Neutral Competitor Context Callout */}
      <div className="competitor-note pb-4 border-b border-[#E2E0D8] font-sans text-xs leading-relaxed text-[#52545D] text-pretty">
        <strong className="text-[#111215] font-semibold">Competitor Context: </strong>
        {competitorText}
      </div>

      {/* Mobile/Tablet (< lg) Collapsible Details */}
      <details className="lg:hidden py-3 border-b border-[#E2E0D8] font-sans text-sm">
        <summary className="cursor-pointer font-semibold text-sm text-[#52545D] hover:text-[#111215]">
          AE Business &amp; SA Technical Briefs
        </summary>
        <div className="mt-3 space-y-3.5 pt-3 border-t border-[#E2E0D8]">
          <div className="brief-block border-l-2 border-[#111215] pl-3">
            <div className="brief-heading font-sans text-kicker font-semibold uppercase text-[#636772] mb-1">
              AE Business Brief
            </div>
            <p className="brief-text font-sans text-sm leading-relaxed text-[#52545D] whitespace-pre-wrap text-pretty">
              {opportunity.ae_notes || 'No AE business notes recorded.'}
            </p>
          </div>
          <div className="brief-block border-l-2 border-[#111215] pl-3">
            <div className="brief-heading font-sans text-kicker font-semibold uppercase text-[#636772] mb-1">
              SA Technical Assessment
            </div>
            {renderSaNotes(opportunity.sa_notes)}
          </div>
        </div>
      </details>

      {/* Desktop (lg+) Narrative Briefs Container */}
      <div className="hidden lg:flex lg:flex-col briefs-box pt-1 space-y-4">
        <div className="brief-block border-l-2 border-[#111215] pl-3">
          <div className="brief-heading font-sans text-kicker font-semibold uppercase text-[#636772] mb-1.5">
            AE Business Brief
          </div>
          <p className="brief-text font-sans text-sm leading-relaxed text-[#52545D] whitespace-pre-wrap text-pretty">
            {opportunity.ae_notes || 'No AE business notes recorded.'}
          </p>
        </div>

        <div className="brief-block border-l-2 border-[#111215] pl-3">
          <div className="brief-heading font-sans text-kicker font-semibold uppercase text-[#636772] mb-1.5">
            SA Technical Assessment
          </div>
          {renderSaNotes(opportunity.sa_notes)}
        </div>
      </div>
    </div>
  );
}
