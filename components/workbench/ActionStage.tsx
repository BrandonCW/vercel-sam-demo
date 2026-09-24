'use client';

import React, { useState } from 'react';
import {
  Opportunity,
  System2ModelOption,
  AssessmentSessionState,
  StageGateEvaluation,
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
  Copy,
  Check,
} from 'lucide-react';

interface ActionStageProps {
  opportunity: Opportunity;
  selectedModel: System2ModelOption;
  sessionState: AssessmentSessionState;
  dynamicForm: JsonRenderForm | null;
  onStartAssessment?: () => void;
  isAssessing?: boolean;
  onSubmitFeedback?: (
    data: Record<string, string | string[]>,
    notesDelta?: string
  ) => Promise<void> | void;
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
  const [hasCopied, setHasCopied] = useState(false);

  const isPendingFeedback = sessionState === 'pending_feedback' && Boolean(dynamicForm);
  const isCompleted =
    (sessionState === 'closed' || Boolean(opportunity.suggested_next_steps)) &&
    !isPendingFeedback &&
    !isAssessing &&
    !isSubmittingFeedback;

  const stageGate = (opportunity.meddpicc_breakdown?.stageGate || opportunity.stage_gate) as
    | StageGateEvaluation
    | undefined;

  // Default handler if parent doesn't provide one
  const handleFormSubmit = async (
    data: Record<string, string | string[]>,
    notesDelta?: string
  ) => {
    if (onSubmitFeedback) {
      await onSubmitFeedback(data, notesDelta);
    }
  };

  const handleCopy = async () => {
    if (!opportunity.suggested_next_steps) return;
    try {
      await navigator.clipboard.writeText(opportunity.suggested_next_steps);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  if (isSubmittingFeedback) {
    return (
      <div className="bg-[#121215] border border-[#27272a] rounded-xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[380px] text-center space-y-4 animate-in fade-in">
        <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-[#0070f3] animate-spin flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white mb-1">
            Evaluating Discovery Input &amp; Running Delta Re-scoring
          </h3>
          <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
            System 1 is re-evaluating MEDDPICC dimensions against your new discovery notes, computing Deal Stage Gate criteria, and synthesizing the single standardized Suggested Next Steps string for CRM Writeback...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Completed State (CRM Writeback Finalized) */}
      {isCompleted ? (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Header Bar */}
          <div className="bg-[#121215] border border-[#27272a] rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#27272a]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                    Assessment Session: Completed &amp; Written Back
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Qualification Finalized ({opportunity.meddpicc_score}/100)
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>COMPLETED</span>
                </span>
                <button
                  onClick={onStartAssessment}
                  disabled={isAssessing}
                  title="Re-evaluate Opportunity"
                  className="px-2.5 py-1 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className={`w-3 h-3 ${isAssessing ? 'animate-spin text-[#0070f3]' : ''}`} />
                  <span>Re-evaluate Opportunity</span>
                </button>
              </div>
            </div>

            {/* Prominent CRM Writeback Card */}
            <div className="mt-5 rounded-xl bg-gradient-to-b from-[#141e30] via-[#101726] to-[#0d121c] border-2 border-blue-600/40 p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                      Written back to Salesforce CRM
                    </span>
                    <div className="text-[11px] font-mono text-zinc-400">
                      Target Field: <code className="text-blue-300">suggested_next_steps</code>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={opportunity.qualification_status}
                    stepsText={opportunity.suggested_next_steps}
                  />
                </div>
              </div>

              {/* Suggested Next Steps Content */}
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Suggested Next Steps</span>
                  <span className="text-[11px] font-mono text-zinc-500 lowercase">
                    immutable crm directive
                  </span>
                </div>
                <div className="p-4 rounded-lg bg-[#090d16] border border-blue-800/40 text-sm font-mono leading-relaxed text-blue-100 selection:bg-blue-600 selection:text-white">
                  {opportunity.suggested_next_steps}
                </div>
              </div>

              {/* Actions & Delta Summary */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-zinc-300 flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold font-mono">
                    Score: {opportunity.meddpicc_score}/100
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-400">
                    {stageGate?.gateReady
                      ? `Stage Gate Passed: Eligible for ${stageGate.targetStage}`
                      : 'Stage Gate Blocked: Additional Discovery Required'}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors shadow-sm cursor-pointer"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Copy to Clipboard</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={onStartAssessment}
                    disabled={isAssessing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0070f3] hover:bg-[#0060df] disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isAssessing ? 'animate-spin' : ''}`} />
                    <span>Re-evaluate Opportunity</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : isPendingFeedback && dynamicForm ? (
        /* 2. Pending Feedback State (Paused Zero-Cost Session) */
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
        /* 3. Baseline / Ready To Assess Stage */
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

function StatusBadge({ status, stepsText }: { status: string; stepsText?: string | null }) {
  const isDisqualified = status === 'disqualified' || stepsText?.startsWith('[DISQUALIFIED]');
  const isQualified = status === 'qualified' || stepsText?.startsWith('[QUALIFIED]');

  if (isQualified) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider font-mono">
        [QUALIFIED]
      </span>
    );
  }

  if (isDisqualified) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 uppercase tracking-wider font-mono">
        [DISQUALIFIED]
      </span>
    );
  }

  return (
    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider font-mono">
      [IN REVIEW]
    </span>
  );
}
