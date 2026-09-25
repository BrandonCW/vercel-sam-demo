'use client';

import React from 'react';
import {
  Opportunity,
  System2ModelOption,
  SYSTEM2_MODELS,
} from '@/lib/types/crm';
import { DEMO_SCENARIOS } from '@/lib/db/scenarios';
import {
  RotateCcw,
  Sparkles,
  Flame,
  User,
  DollarSign,
  Cpu,
  Clock,
} from 'lucide-react';

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
    <header className="bg-[#121215] border-b border-[#27272a] sticky top-0 z-50 px-4 py-3 shadow-md">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Deal Identity & Meta */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0070f3] animate-pulse" />
            <h1 className="text-base font-bold text-[#f4f4f5] tracking-tight">
              {opportunity.name}
            </h1>
          </div>

          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            {opportunity.stage_name}
          </span>

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono font-medium">
              ${Number(opportunity.amount).toLocaleString('en-US')} ACV
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            <User className="w-3.5 h-3.5 text-zinc-500" />
            <span>AE: <strong className="text-zinc-200">{opportunity.ae_name}</strong></span>
            <span className="text-zinc-600">|</span>
            <span>SA: <strong className="text-zinc-200">{opportunity.sa_name || 'Unassigned'}</strong></span>
          </div>

          {primaryCompetitor && (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>{primaryCompetitor} (Threat)</span>
            </div>
          )}

          {runtimeStatus.includes('PAUSED') || runtimeStatus === 'PENDING_FEEDBACK' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{runtimeStatus}</span>
            </div>
          ) : runtimeStatus === 'COMPLETED' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>{runtimeStatus}</span>
            </div>
          ) : runtimeStatus.includes('ASSESS') || runtimeStatus.includes('ANALYZ') ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>{runtimeStatus}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>{runtimeStatus}</span>
            </div>
          )}
        </div>

        {/* Right: Controls (Scenario, Model, Reset, DB status) */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Scenario Selector */}
          <div className="flex items-center gap-1.5 bg-[#18181b] border border-[#27272a] rounded-lg px-2.5 py-1.5">
            <span className="text-zinc-400 font-medium">Scenario:</span>
            <select
              aria-label="Select Scenario"
              value={currentScenarioId}
              onChange={(e) => onScenarioChange(e.target.value)}
              disabled={controlsLocked}
              className="bg-transparent text-zinc-200 font-semibold focus:outline-none cursor-pointer pr-1"
            >
              {Object.entries(DEMO_SCENARIOS).map(([id, scenario]) => (
                <option key={id} value={id} className="bg-[#18181b] text-zinc-200">
                  {scenario.title}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-1.5 bg-[#18181b] border border-[#27272a] rounded-lg px-2.5 py-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#0070f3]" />
            <span className="text-zinc-400 font-medium">System 2:</span>
            <select
              aria-label="Select System 2 Model"
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value as System2ModelOption)}
              className="bg-transparent text-zinc-200 font-semibold focus:outline-none cursor-pointer pr-1"
            >
              {SYSTEM2_MODELS.map((model) => (
                <option key={model.id} value={model.id} className="bg-[#18181b] text-zinc-200">
                  {model.label} ({model.badge})
                </option>
              ))}
            </select>
          </div>

          {/* Reset Demo State Button */}
          <button
            onClick={onReset}
            disabled={isResetting || controlsLocked}
            title={controlsLocked ? 'Wait for the running assessment to finish' : 'Reset Scenario to baseline unqualified state'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-zinc-200 font-semibold rounded-lg border border-zinc-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-[#0070f3]' : ''}`} />
            <span>{isResetting ? 'Resetting...' : 'Reset Demo'}</span>
          </button>

        </div>
      </div>
    </header>
  );
}
