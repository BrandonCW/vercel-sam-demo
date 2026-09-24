'use client';

import React from 'react';
import {
  Opportunity,
  System2ModelOption,
  AssessmentSessionState,
} from '@/lib/types/crm';
import { JsonRenderForm } from '@/lib/ui/json-render-schema';
import { DynamicFormRenderer } from './DynamicFormRenderer';
import {
  Play,
  Sparkles,
  Zap,
  RotateCcw,
  Clock,
  Database,
  PauseCircle,
  CheckCircle2,
} from 'lucide-react';

interface ActionStageProps {
  opportunity: Opportunity;
  selectedModel: System2ModelOption;
  sessionState: AssessmentSessionState;
  dynamicForm: JsonRenderForm | null;
  onStartAssessment?: () => void;
  isAssessing?: boolean;
  onSubmitFeedback?: (data: Record<string, string | string[]>) => Promise<void> | void;
  isSubmittingFeedback?: boolean;
}

export function ActionStage({
  opportunity,
  selectedModel,
  sessionState,
  dynamicForm,
  onStartAssessment,
  isAssessing = false,
  onSubmitFeedback,
  isSubmittingFeedback = false,
}: ActionStageProps) {
  const isPendingFeedback = sessionState === 'pending_feedback' && Boolean(dynamicForm);

  // Default handler if parent doesn't provide one
  const handleFormSubmit = async (data: Record<string, string | string[]>) => {
    if (onSubmitFeedback) {
      await onSubmitFeedback(data);
    }
  };

  return (
    <div className="space-y-5">
      {/* Pending Feedback State (Paused Zero-Cost Session) */}
      {isPendingFeedback && dynamicForm ? (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Header Bar */}
          <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#27272a]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                    Assessment Session: Paused
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  System 2 Reasoning Complete ({opportunity.meddpicc_score}/100)
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                  <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>PENDING_FEEDBACK</span>
                </span>
                <button
                  onClick={onStartAssessment}
                  disabled={isAssessing}
                  title="Re-run System 1 & System 2 reasoning"
                  className="px-2.5 py-1 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className={`w-3 h-3 ${isAssessing ? 'animate-spin text-[#0070f3]' : ''}`} />
                  <span>Re-assess</span>
                </button>
              </div>
            </div>

            {/* Prominent Amber Zero-Cost Paused Banner */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-950/20 border-2 border-amber-500/40 shadow-lg shadow-amber-950/30 flex items-start gap-3.5">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-xs space-y-1">
                <div className="text-sm font-bold text-amber-300 tracking-tight">
                  Zero-Compute Paused Lifecycle: 0 tokens/sec & $0 compute burn while awaiting Solutions Architect discovery.
                </div>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  System 1 scoring and System 2 deep reasoning have concluded. Active session state and dynamic discovery questions are checkpointed in CRM persistence. The agent run has completed; no LLM polling or serverless background compute is consumed while you conduct customer discovery.
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Form Renderer */}
          <DynamicFormRenderer
            form={dynamicForm}
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmittingFeedback}
            submitButtonText="Submit Discovery Findings & Run Delta Re-scoring"
          />
        </div>
      ) : (
        /* Baseline / Ready To Assess Stage */
        <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#27272a]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    opportunity.meddpicc_score !== null ? 'bg-[#0070f3]' : 'bg-emerald-400'
                  }`}
                />
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Lifecycle State
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {opportunity.meddpicc_score !== null
                  ? `Baseline Scored (${opportunity.meddpicc_score}/100)`
                  : 'Ready to Assess'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                {opportunity.meddpicc_score !== null
                  ? 'Baseline Rubric Active'
                  : 'Interactive Assessment Pipeline'}
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
                  <span>
                    {opportunity.meddpicc_score !== null
                      ? 'Re-run Qualification Assessment'
                      : 'Start Qualification Assessment'}
                  </span>
                  <span className="text-xs font-normal text-blue-400 font-mono">
                    ({selectedModel})
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                  Trigger autonomous ingestion of AE Notes & SA Notes. System 1 will score baseline MEDDPICC dimensions, followed by System 2 deep reasoning to generate targeted qualification questions.
                </p>
              </div>

              <button
                onClick={onStartAssessment}
                disabled={isAssessing}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0070f3] hover:bg-[#0060df] disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0 cursor-pointer"
              >
                {isAssessing ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating Opportunity...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>
                      {opportunity.meddpicc_score !== null
                        ? 'Re-run Assessment'
                        : 'Start Assessment'}
                    </span>
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
      )}
    </div>
  );
}
