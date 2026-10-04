'use client';

import React from 'react';
import {
  Opportunity,
  System2ModelOption,
  SYSTEM2_MODELS,
} from '@/lib/types/crm';
import { DEMO_SCENARIOS } from '@/lib/db/scenarios';
import { RotateCcw } from 'lucide-react';

interface TopNavBarProps {
  opportunity: Opportunity;
  currentScenarioId: string;
  onScenarioChange: (scenarioId: string) => void;
  selectedModel: System2ModelOption;
  onModelChange: (model: System2ModelOption) => void;
  onReset: () => Promise<void>;
  isResetting: boolean;
  /** An Assessment Session turn is in flight: a reset or scenario switch would delete or orphan its results. */
  controlsLocked: boolean;
  runtimeStatus: string;
}

export function TopNavBar({
  opportunity,
  currentScenarioId,
  onScenarioChange,
  selectedModel,
  onModelChange,
  onReset,
  isResetting,
  controlsLocked,
  runtimeStatus,
}: TopNavBarProps) {
  // Competitor threat calculation
  const primaryCompetitor = opportunity.competitive_flags[0];

  return (
    <header className="bg-black/90 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-50 px-4 py-2.5">
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left: Deal Identity & Core Meta */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 pr-1">
            <span className="w-2 h-2 rounded-full bg-zinc-400" />
            <h1 className="text-sm font-semibold text-white tracking-tight">
              {opportunity.name}
            </h1>
          </div>

          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-900 text-zinc-300 border border-zinc-800">
            {opportunity.stage_name}
          </span>

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
            <span className="text-zinc-500 font-normal">ACV</span>
            <span className="font-medium text-zinc-200">
              ${Number(opportunity.amount).toLocaleString('en-US')}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
            <span>AE: <span className="text-zinc-200 font-medium">{opportunity.ae_name}</span></span>
            <span className="text-zinc-700">·</span>
            <span>SA: <span className="text-zinc-200 font-medium">{opportunity.sa_name || 'Unassigned'}</span></span>
          </div>

          {primaryCompetitor && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-zinc-900/80 border border-zinc-800 text-zinc-400">
              <span className="text-zinc-500">Competitor:</span>
              <span className="text-zinc-200 font-medium">{primaryCompetitor}</span>
            </div>
          )}

          {/* Runtime Status Pill (Understated) */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-300">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                runtimeStatus.includes('PAUSED') || runtimeStatus === 'PENDING_FEEDBACK'
                  ? 'bg-amber-400'
                  : runtimeStatus === 'COMPLETED'
                  ? 'bg-emerald-400'
                  : runtimeStatus.includes('ASSESS') || runtimeStatus.includes('ANALYZ')
                  ? 'bg-blue-400'
                  : 'bg-zinc-400'
              }`}
            />
            <span className="font-mono text-[10px] tracking-wide uppercase">{runtimeStatus}</span>
          </div>
        </div>

        {/* Right: Environment & Demo Controls (Discreetly Containerized) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800/80 rounded-lg px-2.5 py-1 text-zinc-400">
            {/* Scenario Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 text-[11px]">Scenario:</span>
              <select
                aria-label="Select Scenario"
                value={currentScenarioId}
                onChange={(e) => onScenarioChange(e.target.value)}
                disabled={controlsLocked}
                className="bg-transparent text-zinc-200 text-xs font-medium focus:outline-none cursor-pointer pr-1 disabled:opacity-50"
              >
                {Object.entries(DEMO_SCENARIOS).map(([id, scenario]) => (
                  <option key={id} value={id} className="bg-zinc-900 text-zinc-200">
                    {scenario.title}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-zinc-800">|</span>

            {/* Model Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 text-[11px]">Model:</span>
              <select
                aria-label="Select System 2 Model"
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value as System2ModelOption)}
                className="bg-transparent text-zinc-200 text-xs font-medium focus:outline-none cursor-pointer pr-1"
              >
                {SYSTEM2_MODELS.map((model) => (
                  <option key={model.id} value={model.id} className="bg-zinc-900 text-zinc-200">
                    {model.label} ({model.badge})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-zinc-800">|</span>

            {/* Reset Demo State Button */}
            <button
              onClick={onReset}
              disabled={isResetting || controlsLocked}
              title={controlsLocked ? 'Wait for the running assessment to finish' : 'Reset scenario to baseline'}
              className="flex items-center gap-1 px-2 py-0.5 text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded font-medium disabled:opacity-40 transition-colors cursor-pointer"
            >
              <RotateCcw className={`w-3 h-3 ${isResetting ? 'animate-spin text-zinc-400' : 'text-zinc-500'}`} />
              <span className="text-[11px]">{isResetting ? 'Resetting...' : 'Reset Demo'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
