'use client';

import React from 'react';
import { Opportunity, DimensionEvaluation } from '@/lib/types/crm';
import {
  FileText,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Gauge,
  Lock,
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
  const breakdown = opportunity.meddpicc_breakdown || {};

  // Calculate composite score if not stored directly
  const compositeScore = opportunity.meddpicc_score !== null
    ? opportunity.meddpicc_score
    : calculateCompositeScore(breakdown);

  // Stage Gate 2 status check
  const painScore = breakdown.identifyPain?.score ?? 0;
  const champScore = breakdown.champion?.score ?? 0;
  const metricsScore = breakdown.metrics?.score ?? 0;

  const passesGate2 =
    compositeScore >= 50 && painScore >= 6 && champScore >= 5 && metricsScore >= 4;

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

      {/* 3. MEDDPICC 8-Dimension Rubric Card */}
      <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-purple-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              MEDDPICC 8-Dimension Rubric
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">Weighted Sum (0-100)</span>
        </div>

        {/* Dimension Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          {DIMENSION_ORDER.map((key) => {
            const dim = breakdown[key] as DimensionEvaluation | undefined;
            const score = dim?.score ?? 0;
            const weightPercent = Math.round((dim?.weight ?? 0.1) * 100);
            const status = dim?.status ?? 'unaddressed';

            return (
              <div
                key={key}
                className="bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 transition-colors hover:border-zinc-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-zinc-200">
                      {dim?.label || key}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ({weightPercent}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusIcon status={status} />
                    <span className="text-xs font-bold font-mono text-zinc-300">
                      {score}/10
                    </span>
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
              Stage Gate 2 Status
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
                  <span>Eligible for Stage 3</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Gate Blocked (&lt;50 or gaps)</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function calculateCompositeScore(breakdown: Record<string, DimensionEvaluation | undefined>): number {
  let total = 0;
  for (const key of DIMENSION_ORDER) {
    const dim = breakdown[key];
    if (dim) {
      total += (dim.score || 0) * 10 * (dim.weight || 0);
    }
  }
  return Math.round(total);
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'verified':
      return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
    case 'partial':
      return <AlertTriangle className="w-3 h-3 text-amber-400" />;
    case 'unaddressed':
    default:
      return <XCircle className="w-3 h-3 text-zinc-600" />;
  }
}

function getBarColor(score: number): string {
  if (score >= 8) return 'bg-emerald-500';
  if (score >= 4) return 'bg-amber-500';
  return score > 0 ? 'bg-red-500' : 'bg-zinc-700';
}
