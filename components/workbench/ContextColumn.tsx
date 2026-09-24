'use client';

import React, { useState } from 'react';
import { Opportunity, DimensionEvaluation, StageGateEvaluation } from '@/lib/types/crm';
import { computeCompositeScore } from '@/lib/agents/jev-scorer';
import {
  FileText,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Gauge,
  Lock,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
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
    <div className="space-y-5">
      {/* 1. Account Executive Notes Card */}
      <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0070f3]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Account Executive Notes
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">Immutable CRM Log</span>
        </div>
        <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-3.5 text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto selection:bg-[#0070f3]">
          {opportunity.ae_notes || 'No qualitative AE notes recorded.'}
        </div>
      </div>

      {/* 2. Solutions Architect Notes Card */}
      <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Solutions Architect Notes
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">Technical Discovery</span>
        </div>
        <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-3.5 text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto selection:bg-emerald-500/30">
          {opportunity.sa_notes || 'No technical SA notes recorded.'}
        </div>
      </div>

      {/* 3. Stage Gate Blocker Alert Banner (Post-Assessment) */}
      {isAssessed && stageGate && (
        <div>
          {!stageGate.gateReady ? (
            <div className="bg-amber-950/25 border border-amber-500/40 rounded-xl p-4 animate-in fade-in">
              <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  Stage Gate Blocked: {stageGate.currentStage} &rarr; {stageGate.targetStage}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mb-2.5">
                The Opportunity does not meet Stage Gate criteria to advance to{' '}
                <strong className="text-amber-300">{stageGate.targetStage}</strong>:
              </p>
              <ul className="space-y-1.5 pl-1">
                {stageGate.gateBlockers.map((blocker, idx) => (
                  <li key={idx} className="text-xs text-amber-200/90 flex items-start gap-2">
                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                    <span>{blocker}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-emerald-950/25 border border-emerald-500/40 rounded-xl p-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Stage Gate Passed: Eligible for {stageGate.targetStage}</span>
              </div>
              <p className="text-xs text-zinc-300 mt-1.5">
                All technical validation, pain criteria, and composite MEDDPICC thresholds
                satisfied.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. Enterprise Competitive Scanner Threat Badges */}
      {opportunity.competitive_flags && opportunity.competitive_flags.length > 0 && (
        <div className="bg-[#121215] border border-[#27272a] rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Detected Competitive Threats
              </h2>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">CRM Competitive Flags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {opportunity.competitive_flags.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-red-500/15 text-red-400 border-red-500/30"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                <span>{name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 5. MEDDPICC 8-Dimension Rubric Card */}
      <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-purple-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              MEDDPICC 8-Dimension Rubric
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">
            {isAssessed ? 'Evaluated (Jev System 1)' : 'Baseline'}
          </span>
        </div>

        {/* Dimension Grid */}
        <div className="space-y-2.5 mb-4">
          {DIMENSION_ORDER.map((key) => {
            const dim = breakdown[key] as DimensionEvaluation | undefined;
            const score = dim?.score ?? 0;
            const weightPercent = Math.round((dim?.weight ?? 0.1) * 100);
            const status = dim?.status ?? 'unaddressed';
            const isExpanded = expandedDimension === key;
            const hasDetails = (dim?.evidence && dim.evidence.length > 0) || (dim?.gaps && dim.gaps.length > 0);

            return (
              <div
                key={key}
                className="bg-[#18181b] border border-[#27272a] rounded-lg p-3 transition-colors hover:border-zinc-700 cursor-pointer"
                onClick={() => toggleDimension(key)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-zinc-200">
                      {dim?.label || key}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ({weightPercent}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MaturityTag status={status} />
                    <span className="text-xs font-bold font-mono text-zinc-300">
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
                <div className="h-1.5 bg-[#27272a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(score)}`}
                    style={{ width: `${Math.min(100, Math.max(0, score * 10))}%` }}
                  />
                </div>

                <div className="flex justify-between items-center mt-1.5 text-[10px] text-zinc-500">
                  <span className="capitalize">{status}</span>
                  {dim?.confidence !== undefined && (
                    <span>Conf: {Math.round(dim.confidence * 100)}%</span>
                  )}
                </div>

                {/* Expandable Evidence Snippets & Gaps */}
                {isExpanded && hasDetails && (
                  <div className="mt-3 pt-2.5 border-t border-[#27272a] space-y-2 text-xs">
                    {dim?.evidence && dim.evidence.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-400 mb-1 flex items-center gap-1">
                          <Quote className="w-3 h-3 text-[#0070f3]" />
                          <span>Direct Citations</span>
                        </div>
                        <div className="space-y-1">
                          {dim.evidence.map((quote, qIdx) => (
                            <p
                              key={qIdx}
                              className="text-[11px] text-zinc-300 italic bg-[#09090b] border border-[#27272a] p-2 rounded leading-relaxed font-mono"
                            >
                              &ldquo;{quote}&rdquo;
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {dim?.gaps && dim.gaps.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase font-bold text-amber-400 mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Identified Gaps</span>
                        </div>
                        <ul className="space-y-1">
                          {dim.gaps.map((gap, gIdx) => (
                            <li
                              key={gIdx}
                              className="text-[11px] text-amber-300/90 flex items-start gap-1.5 leading-relaxed"
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
        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">
              Composite Qualification Score
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {compositeScore}
              </span>
              <span className="text-sm font-semibold text-zinc-500 font-mono">/ 100</span>
            </div>
          </div>

          {/* Stage Gate 2 Indicator */}
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">
              Stage Gate Status
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                passesGate2
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
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
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>Verified</span>
        </span>
      );
    case 'partial':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>Partial</span>
        </span>
      );
    case 'unaddressed':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wider">
          <XCircle className="w-2.5 h-2.5" />
          <span>Unaddressed</span>
        </span>
      );
  }
}

function getBarColor(score: number): string {
  if (score >= 8) return 'bg-emerald-500';
  if (score >= 4) return 'bg-amber-500';
  return score > 0 ? 'bg-red-500' : 'bg-zinc-700';
}
