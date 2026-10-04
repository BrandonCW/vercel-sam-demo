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
  RotateCcw,
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
  /** Jev has scored and System 2 is still running: show the running indicator. */
  isSystem2Running?: boolean;
  onStartAssessment?: () => void;
  isAssessing?: boolean;
  onSubmitFeedback?: (
    data: Record<string, string | string[]>,
    notesDelta?: string
  ) => Promise<void> | void;
  isSubmittingFeedback?: boolean;
  /** Disable the discovery form without the evaluating panel (e.g. while a session resumes). */
  isFormLocked?: boolean;
}

export function ActionStage({
  opportunity,
  selectedModel,
  sessionState,
  dynamicForm,
  isSystem2Running = false,
  onStartAssessment,
  isAssessing = false,
  onSubmitFeedback,
  isSubmittingFeedback = false,
  isFormLocked = false,
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
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-8 flex flex-col items-center justify-center min-h-[340px] text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-white animate-spin" />
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">
            Evaluating Discovery Input &amp; Running Delta Re-scoring
          </h3>
          <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
            Re-evaluating MEDDPICC dimensions against discovery notes, testing Stage Gate criteria, and updating CRM records...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Completed State (CRM Writeback Finalized) */}
      {isCompleted ? (
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-5 space-y-4">
            {/* Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-medium">
                    Assessment Completed
                  </span>
                </div>
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Qualification Finalized ({opportunity.meddpicc_score}/100)
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>COMPLETED</span>
                </span>
                <button
                  onClick={onStartAssessment}
                  disabled={isAssessing}
                  title="Re-evaluate Opportunity"
                  className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw className={`w-3 h-3 ${isAssessing ? 'animate-spin text-zinc-400' : 'text-zinc-400'}`} />
                  <span>Re-evaluate Opportunity</span>
                </button>
              </div>
            </div>

            {/* Clean CRM Result Card */}
            <div className="rounded-lg bg-zinc-900/50 border border-zinc-800/80 p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-zinc-800/60">
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="text-zinc-500">Qualification Status:</span>
                  <StatusBadge
                    status={opportunity.qualification_status}
                    stepsText={opportunity.suggested_next_steps}
                  />
                </div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  Synced to Salesforce CRM
                </div>
              </div>

              {/* Suggested Next Steps Content */}
              <div>
                <div className="text-xs font-medium text-zinc-300 mb-1.5">
                  Suggested Next Steps
                </div>
                <div className="p-3.5 rounded-md bg-black/60 border border-zinc-800/80 text-xs leading-relaxed text-zinc-200 selection:bg-[#0070f3] selection:text-white">
                  {opportunity.suggested_next_steps}
                </div>
              </div>

              {/* Summary & Copy */}
              <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-zinc-400 flex items-center gap-2">
                  <span className="text-emerald-400 font-medium font-mono">
                    Score: {opportunity.meddpicc_score}/100
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span>
                    {stageGate?.gateReady
                      ? `Stage Gate Passed: Eligible for ${stageGate.targetStage}`
                      : 'Stage Gate Blocked: Additional Discovery Required'}
                  </span>
                </div>

                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors cursor-pointer"
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
              </div>
            </div>
          </div>
        </div>
      ) : isPendingFeedback && dynamicForm ? (
        /* 2. Pending Feedback State */
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-medium">
                    Discovery Required
                  </span>
                </div>
                <h2 className="text-base font-semibold text-white tracking-tight">
                  System 2 Reasoning Complete ({opportunity.meddpicc_score}/100)
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
                  <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>PENDING_FEEDBACK</span>
                </span>
                <button
                  onClick={onStartAssessment}
                  disabled={isAssessing}
                  title="Re-run assessment"
                  className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw className={`w-3 h-3 ${isAssessing ? 'animate-spin text-zinc-400' : 'text-zinc-400'}`} />
                  <span>Re-assess</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Initial MEDDPICC evaluation is complete. Please review and answer the targeted discovery questions below to validate gaps before delta re-scoring.
            </p>
          </div>

          {/* Dynamic Form Renderer */}
          <DynamicFormRenderer
            form={dynamicForm}
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmittingFeedback}
            isLocked={isFormLocked}
            submitButtonText="Submit Discovery Findings & Run Delta Re-scoring"
          />
        </div>
      ) : (
        /* 3. Baseline / Ready To Assess Stage */
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    opportunity.meddpicc_score !== null ? 'bg-blue-400' : 'bg-zinc-400'
                  }`}
                />
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium">
                  Lifecycle State
                </span>
              </div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                {opportunity.meddpicc_score !== null
                  ? `Baseline Scored (${opportunity.meddpicc_score}/100)`
                  : 'Ready to Assess'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">
                {opportunity.meddpicc_score !== null
                  ? 'Baseline Rubric Active'
                  : 'Interactive Assessment Pipeline'}
              </span>
            </div>
          </div>

          {/* Clean Deal Assessment Overview */}
          <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-3">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Evaluates Account Executive and Solutions Architect discovery notes against the 8 MEDDPICC dimensions, detects competitive risks, tests Stage Gate advancement criteria, and drafts interactive discovery questions.
            </p>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-zinc-500">
                Target Model: <span className="text-zinc-300 font-mono">{selectedModel}</span>
              </div>

              <button
                onClick={onStartAssessment}
                disabled={isAssessing}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] disabled:opacity-40 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
              >
                {isAssessing ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating Opportunity...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
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

          {isSystem2Running && (
            <div
              role="status"
              className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300"
            >
              <span className="inline-block w-3.5 h-3.5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
              <span className="font-medium text-white">System 2 analysis running&hellip;</span>
              <span className="text-zinc-400">Scoring complete; formulating targeted discovery questions.</span>
            </div>
          )}
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
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider font-mono">
        [QUALIFIED]
      </span>
    );
  }

  if (isDisqualified) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider font-mono">
        [DISQUALIFIED]
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase tracking-wider font-mono">
      [IN REVIEW]
    </span>
  );
}
