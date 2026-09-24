'use client';

import React, { useState } from 'react';
import { Opportunity, System2ModelOption } from '@/lib/types/crm';
import { TopNavBar } from './TopNavBar';
import { ContextColumn } from './ContextColumn';
import { ActionStage } from './ActionStage';

interface WorkbenchShellProps {
  initialOpportunity: Opportunity;
  initialScenarioId: string;
  isPostgres: boolean;
}

export function WorkbenchShell({
  initialOpportunity,
  initialScenarioId,
  isPostgres,
}: WorkbenchShellProps) {
  const [opportunity, setOpportunity] = useState<Opportunity>(initialOpportunity);
  const [scenarioId, setScenarioId] = useState<string>(initialScenarioId);
  const [selectedModel, setSelectedModel] = useState<System2ModelOption>('claude-3-5-sonnet');
  const [isResetting, setIsResetting] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function handleScenarioChange(newScenarioId: string) {
    setScenarioId(newScenarioId);
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

  function handleStartAssessment() {
    setIsAssessing(true);
    showToast('Starting System 1 & System 2 evaluation pipeline...');
    setTimeout(() => {
      setIsAssessing(false);
      showToast('Assessment pipeline initialized (Ticket 02 will connect live Jev engine)');
    }, 1200);
  }

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
        isPostgres={isPostgres}
        runtimeStatus={opportunity.qualification_status.toUpperCase()}
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
            onStartAssessment={handleStartAssessment}
            isAssessing={isAssessing}
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
