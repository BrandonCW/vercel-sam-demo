'use client';

import React from 'react';
import { Opportunity, System2ModelOption } from '@/lib/types/crm';
import {
  Play,
  Sparkles,
  Zap,
  CheckSquare,
  ShieldAlert,
  ArrowRight,
  Info,
  Clock,
  Layers,
  Database,
} from 'lucide-react';

interface ActionStageProps {
  opportunity: Opportunity;
  selectedModel: System2ModelOption;
  onStartAssessment?: () => void;
  isAssessing?: boolean;
}

export function ActionStage({
  opportunity,
  selectedModel,
  onStartAssessment,
  isAssessing = false,
}: ActionStageProps) {
  return (
    <div className="space-y-5">
      {/* Stage Header Banner */}
      <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#27272a]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Lifecycle State
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Ready to Assess
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              Interactive Assessment Pipeline
            </span>
          </div>
        </div>

        {/* Pipeline overview cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-3.5">
            <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-zinc-200 mb-1">
              1. System 1 (Jev)
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Deterministic 8-dimension scoring, evidence extraction, and competitor detection in &lt;1.5s.
            </p>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-3.5">
            <div className="w-7 h-7 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-zinc-200 mb-1">
              2. System 2 Reasoning
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Deep gap synthesis, competitive counter-positioning, and dynamic question schema generation.
            </p>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-3.5">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
              <Database className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-zinc-200 mb-1">
              3. CRM Writeback
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Delta Re-scoring, Stage Gate exit check, and atomic writeback of Suggested Next Steps to CRM.
            </p>
          </div>
        </div>

        {/* Action Trigger Card */}
        <div className="mt-6 p-6 rounded-xl bg-gradient-to-b from-[#18181b] to-[#121215] border border-blue-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <span>Start Qualification Assessment</span>
                <span className="text-xs font-normal text-blue-400 font-mono">
                  ({selectedModel})
                </span>
              </h3>
              <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                Trigger autonomous ingestion of AE Notes &amp; SA Notes. System 1 will compute baseline rubric scores and System 2 will construct interactive discovery questions.
              </p>
            </div>

            <button
              onClick={onStartAssessment}
              disabled={isAssessing}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0070f3] hover:bg-[#0060df] disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
            >
              {isAssessing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Evaluating Opportunity...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Assessment</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Zero-Cost Banner Preview */}
        <div className="mt-5 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-amber-300 mr-1.5">
              Zero-Compute Paused Lifecycle:
            </span>
            <span className="text-zinc-300 leading-relaxed">
              Once initial evaluation completes, the agent pauses with zero token burn and zero background compute while the Solutions Architect gathers missing discovery evidence.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
