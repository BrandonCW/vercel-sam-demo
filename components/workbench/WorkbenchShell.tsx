'use client';

import React, { useState } from 'react';
import {
  Opportunity,
  System2ModelOption,
  AssessmentSessionState,
} from '@/lib/types/crm';
import { JsonRenderForm } from '@/lib/ui/json-render-schema';
import { TopNavBar } from './TopNavBar';
import { ContextColumn } from './ContextColumn';
import { ActionStage } from './ActionStage';

interface WorkbenchShellProps {
  initialOpportunity: Opportunity;
  initialScenarioId: string;
}

export function WorkbenchShell({
  initialOpportunity,
  initialScenarioId,
}: WorkbenchShellProps) {
  const [opportunity, setOpportunity] = useState<Opportunity>(initialOpportunity);
  const [scenarioId, setScenarioId] = useState<string>(initialScenarioId);
  const [selectedModel, setSelectedModel] = useState<System2ModelOption>('claude-3-5-sonnet');
  const [sessionState, setSessionState] = useState<AssessmentSessionState>(
    initialOpportunity.suggested_next_steps ? 'closed' : 'initiated'
  );
  const [dynamicForm, setDynamicForm] = useState<JsonRenderForm | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function handleScenarioChange(newScenarioId: string) {
    setScenarioId(newScenarioId);
    setSessionState('initiated');
    setDynamicForm(null);
    try {
      const res = await fetch(`/api/crm/opportunity?scenarioId=${newScenarioId}`);
      if (res.ok) {
        const data = await res.json();
        setOpportunity(data);
        showToast(`Switched to scenario: ${newScenarioId}`);
      }
    } catch (err) {
      console.error('Failed to switch scenario:', err);
    }
  }

  async function handleReset() {
    setIsResetting(true);
    setSessionState('initiated');
    setDynamicForm(null);
    try {
      const res = await fetch('/api/crm/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });

      if (res.ok) {
        const data = await res.json();
        setOpportunity(data.opportunity);
        showToast('Demo state reset to default unqualified baseline');
      } else {
        showToast('Failed to reset demo state');
      }
    } catch (err) {
      console.error('Reset error:', err);
      showToast('Error resetting demo state');
    } finally {
      setIsResetting(false);
    }
  }

  async function handleStartAssessment() {
    setIsAssessing(true);
    setSessionState('analyzing');
    showToast('Executing System 1 (Jev) scoring & System 2 deep reasoning...');
    try {
      const res = await fetch('/api/qualification/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          model: selectedModel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOpportunity(data.opportunity);
        if (data.form) {
          setDynamicForm(data.form);
        }
        if (data.sessionState) {
          setSessionState(data.sessionState);
        } else {
          setSessionState('pending_feedback');
        }
        showToast(
          `Assessment complete (${data.modelUsed ?? selectedModel}, Score ${data.opportunity.meddpicc_score}/100). Paused at $0 compute.`
        );
      } else {
        const errorData = await res.json().catch(() => ({}));
        setSessionState('initiated');
        showToast(`Assessment failed: ${errorData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Failed to trigger assessment:', err);
      setSessionState('initiated');
      showToast('Network error triggering assessment');
    } finally {
      setIsAssessing(false);
    }
  }

  async function handleSubmitFeedback(
    feedbackData: Record<string, string | string[]>,
    notesDelta?: string
  ) {
    setIsSubmittingFeedback(true);
    showToast('Submitting discovery findings...');
    try {
      const res = await fetch('/api/qualification/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          formResponses: feedbackData,
          notesDelta,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.opportunity) {
          setOpportunity(data.opportunity);
        }
        setSessionState('closed');
        showToast('Delta Re-scoring complete & Suggested Next Steps written back to CRM!');
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(`Writeback failed: ${errorData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Feedback writeback error:', err);
      showToast('Network error submitting feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  const runtimeStatus = isAssessing
    ? 'ANALYZING'
    : isSubmittingFeedback
    ? 'EVALUATING'
    : sessionState === 'pending_feedback' && Boolean(dynamicForm)
    ? 'PENDING_FEEDBACK'
    : opportunity.suggested_next_steps || sessionState === 'closed'
    ? 'COMPLETED'
    : 'READY_TO_ASSESS';

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-[#f4f4f5]">
      {/* Top Navigation Bar */}
      <TopNavBar
        opportunity={opportunity}
        currentScenarioId={scenarioId}
        onScenarioChange={handleScenarioChange}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onReset={handleReset}
        isResetting={isResetting}
        runtimeStatus={runtimeStatus}
      />

      {/* Main Split Workbench Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-6 items-start">
          {/* Left Column: Context & Real-Time Rubric */}
          <ContextColumn opportunity={opportunity} />

          {/* Right Column: Stage-Based Action Stage */}
          <ActionStage
            opportunity={opportunity}
            selectedModel={selectedModel}
            sessionState={sessionState}
            dynamicForm={dynamicForm}
            onStartAssessment={handleStartAssessment}
            isAssessing={isAssessing}
            onSubmitFeedback={handleSubmitFeedback}
            isSubmittingFeedback={isSubmittingFeedback}
          />
        </div>
      </main>

      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#18181b] border border-blue-500/50 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-[#0070f3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
