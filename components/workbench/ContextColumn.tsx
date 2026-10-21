'use client';

import React, { useState } from 'react';
import { Opportunity, DimensionEvaluation, StageGateEvaluation } from '@/lib/types/crm';
import { computeCompositeScore } from '@/lib/agents/jev-scorer';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  ChevronDown,
  ChevronUp,
  Quote,
} from 'lucide-react';

interface ContextColumnProps {
  opportunity: Opportunity;
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

export function ContextColumn({ opportunity }: ContextColumnProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const breakdown = opportunity.meddpicc_breakdown || {};

  // Calculate composite score if not stored directly
  const compositeScore =
    opportunity.meddpicc_score !== null
      ? opportunity.meddpicc_score
      : computeCompositeScore({
          metrics: breakdown.metrics?.score ?? 0,
          economicBuyer: breakdown.economicBuyer?.score ?? 0,
          decisionCriteria: breakdown.decisionCriteria?.score ?? 0,
          decisionProcess: breakdown.decisionProcess?.score ?? 0,
          paperProcess: breakdown.paperProcess?.score ?? 0,
          identifyPain: breakdown.identifyPain?.score ?? 0,
          champion: breakdown.champion?.score ?? 0,
          competition: breakdown.competition?.score ?? 0,
        });

  const stageGate = (breakdown.stageGate || opportunity.stage_gate) as
    | StageGateEvaluation
    | undefined;

  // Gate status comes only from a persisted System 1 evaluation; unassessed deals have not passed.
  const passesGate2 = stageGate?.gateReady ?? false;
  const isAssessed = opportunity.meddpicc_score !== null;

  function toggleDimension(key: string) {
    setExpandedDimension((prev) => (prev === key ? null : key));
  }

  return (
    <div className="space-y-4">
      {/* 1. Account Executive Notes Card */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Account Executive Notes
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500">CRM Record</span>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-3 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-44 overflow-y-auto selection:bg-[#0070f3] selection:text-white">
          {opportunity.ae_notes || 'No qualitative AE notes recorded.'}
        </div>
      </div>

      {/* 2. Solutions Architect Notes Card */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Solutions Architect Notes
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500">Technical Discovery</span>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-3 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-44 overflow-y-auto selection:bg-[#0070f3] selection:text-white">
          {opportunity.sa_notes || 'No technical SA notes recorded.'}
        </div>
      </div>

      {/* 3. Stage Gate Blocker Alert Banner (Post-Assessment) */}
      {isAssessed && stageGate && (
        <div>
          {!stageGate.gateReady ? (
            <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1.5 text-amber-400 font-medium text-xs">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Stage Gate Blocked: {stageGate.currentStage} &rarr; {stageGate.targetStage}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mb-2 leading-relaxed">
                The Opportunity does not meet Stage Gate criteria to advance to{' '}
                <span className="text-amber-300 font-medium">{stageGate.targetStage}</span>:
              </p>
              <ul className="space-y-1 pl-1">
                {stageGate.gateBlockers.map((blocker, idx) => (
                  <li key={idx} className="text-xs text-amber-200/90 flex items-start gap-1.5 leading-relaxed">
                    <span className="text-amber-500">•</span>
                    <span>{blocker}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-3.5">
              <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Stage Gate Passed: Eligible for {stageGate.targetStage}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                All technical validation, pain criteria, and composite MEDDPICC thresholds satisfied.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. Competitive Scanner Badges */}
      {opportunity.competitive_flags && opportunity.competitive_flags.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Identified Competitors
            </h2>
            <span className="text-[10px] text-zinc-500">CRM Flags</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {opportunity.competitive_flags.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span>{name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 5. MEDDPICC 8-Dimension Rubric Card */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-zinc-800/80">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            MEDDPICC 8-Dimension Rubric
          </h2>
          <span className="text-[11px] text-zinc-500">
            {isAssessed ? 'Evaluated' : 'Baseline'}
          </span>
        </div>

        {/* Dimension Grid */}
        <div className="space-y-2 mb-3.5">
          {DIMENSION_ORDER.map((key) => {
            const dim = breakdown[key] as DimensionEvaluation | undefined;
            const score = dim?.score ?? 0;
            const status = dim?.status ?? 'unaddressed';
            const isExpanded = expandedDimension === key;
            const hasDetails = (dim?.evidence && dim.evidence.length > 0) || (dim?.gaps && dim.gaps.length > 0);

            return (
              <div
                key={key}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-2.5 transition-colors hover:border-zinc-700 cursor-pointer"
                onClick={() => toggleDimension(key)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-zinc-200">
                      {dim?.label || key}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MaturityTag status={status} />
                    <span className="text-xs font-semibold font-mono text-zinc-300">
                      {score}/10
                    </span>
                    {hasDetails && (
                      <span className="text-zinc-500 hover:text-zinc-300">
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getBarColor(score)}`}
                    style={{ width: `${Math.min(100, Math.max(0, score * 10))}%` }}
                  />
                </div>

                {/* Expandable Evidence Snippets & Gaps */}
                {isExpanded && hasDetails && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-800/80 space-y-2 text-xs">
                    {dim?.evidence && dim.evidence.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                          <Quote className="w-3 h-3 text-zinc-500" />
                          <span>Direct Citations</span>
                        </div>
                        <div className="space-y-1">
                          {dim.evidence.map((quote, qIdx) => (
                            <p
                              key={qIdx}
                              className="text-[11px] text-zinc-300 italic bg-black/40 border-l-2 border-[#0070f3] pl-2 py-1 rounded-r leading-relaxed"
                            >
                              &ldquo;{quote}&rdquo;
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {dim?.gaps && dim.gaps.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-amber-400 mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Identified Gaps</span>
                        </div>
                        <ul className="space-y-1">
                          {dim.gaps.map((gap, gIdx) => (
                            <li
                              key={gIdx}
                              className="text-[11px] text-amber-200/90 flex items-start gap-1.5 leading-relaxed"
                            >
                              <span className="text-amber-500">•</span>
                              <span>{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Composite Score Banner */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-0.5">
              Composite Qualification Score
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white tracking-tight font-mono">
                {compositeScore}
              </span>
              <span className="text-xs font-normal text-zinc-500 font-mono">/ 100</span>
            </div>
          </div>

          {/* Stage Gate Indicator */}
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1">
              Stage Gate Status
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                passesGate2
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {passesGate2 ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Eligible for {stageGate?.targetStage || 'Stage 3'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Gate Blocked</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaturityTag({ status }: { status: string }) {
  switch (status) {
    case 'verified':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>Verified</span>
        </span>
      );
    case 'partial':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>Partial</span>
        </span>
      );
    case 'unaddressed':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/80 uppercase tracking-wide">
          <XCircle className="w-2.5 h-2.5" />
          <span>Unaddressed</span>
        </span>
      );
  }
}

function getBarColor(score: number): string {
  if (score >= 8) return 'bg-emerald-400';
  if (score >= 4) return 'bg-amber-400';
  return score > 0 ? 'bg-red-400' : 'bg-zinc-700';
}
