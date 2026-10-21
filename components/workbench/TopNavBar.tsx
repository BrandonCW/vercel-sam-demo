'use client';

import React from 'react';
import { Gauge, RotateCcw } from 'lucide-react';
import type { Opportunity, System2ModelOption } from '@/lib/types/crm';
import { SYSTEM2_MODELS } from '@/lib/types/crm';
import { DEMO_SCENARIOS } from '@/lib/db/scenarios';
import type { WorkbenchMode } from '@/lib/simulation/types';

export interface TopNavBarProps {
  opportunity: Opportunity;
  mode?: WorkbenchMode;
  onModeChange?: (mode: WorkbenchMode) => void;
  onReset: () => void | Promise<void>;
  isResetting?: boolean;
  currentScenarioId?: string;
  onScenarioChange?: (scenarioId: string) => void;
  selectedModel?: System2ModelOption;
  onModelChange?: (model: System2ModelOption) => void;
  controlsLocked?: boolean;
  runtimeStatus?: string;
}

export function TopNavBar({
  opportunity,
  mode = 'simulation',
  onModeChange,
  onReset,
  isResetting = false,
  currentScenarioId,
  onScenarioChange,
  selectedModel,
  onModelChange,
  controlsLocked = false,
  runtimeStatus,
}: TopNavBarProps) {
  return (
    <header className="border-b border-[#dfe5ed] bg-white">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#14233b] text-[#f3b547]">
            <Gauge className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#718097]">
              DEAL OPERATIONS
            </p>
            <h1 className="text-base font-semibold tracking-tight text-[#152238] sm:text-lg">
              Qualification System
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#718097]">
          {/* Salesforce connection indicator */}
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Salesforce connected</span>
          </span>

          {/* Runtime Status Pill */}
          {runtimeStatus && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#f0f3f7] border border-[#dfe5ed] text-[#152238]">
              <span
                className={`size-1.5 rounded-full ${
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
          )}

          {/* Scenario & Model Selectors (if in live/demo scenario mode) */}
          {currentScenarioId && onScenarioChange && (
            <div className="flex items-center gap-2 rounded-lg border border-[#dfe5ed] bg-[#f8fafc] px-2.5 py-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[#718097] text-[11px]">Scenario:</span>
                <select
                  aria-label="Select Scenario"
                  value={currentScenarioId}
                  onChange={(e) => onScenarioChange(e.target.value)}
                  disabled={controlsLocked}
                  className="bg-transparent text-[#152238] text-xs font-medium focus:outline-none cursor-pointer pr-1 disabled:opacity-50"
                >
                  {Object.entries(DEMO_SCENARIOS).map(([id, scenario]) => (
                    <option key={id} value={id} className="bg-white text-[#152238]">
                      {scenario.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedModel && onModelChange && (
                <>
                  <span className="text-[#dfe5ed]">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#718097] text-[11px]">Model:</span>
                    <select
                      aria-label="Select System 2 Model"
                      value={selectedModel}
                      onChange={(e) => onModelChange(e.target.value as System2ModelOption)}
                      className="bg-transparent text-[#152238] text-xs font-medium focus:outline-none cursor-pointer pr-1"
                    >
                      {SYSTEM2_MODELS.map((m) => (
                        <option key={m.id} value={m.id} className="bg-white text-[#152238]">
                          {m.label} ({m.badge})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg border border-[#dfe5ed] bg-[#f8fafc] p-0.5 shadow-xs">
            <button
              onClick={() => onModeChange?.('simulation')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                mode === 'simulation'
                  ? 'bg-[#14233b] text-white shadow-xs'
                  : 'text-[#718097] hover:text-[#152238]'
              }`}
            >
              ⚡ Simulation mode
            </button>
            <button
              onClick={() => onModeChange?.('live')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                mode === 'live'
                  ? 'bg-[#0070f3] text-white shadow-xs'
                  : 'text-[#718097] hover:text-[#152238]'
              }`}
            >
              🌐 Live AI mode
            </button>
          </div>

          {/* Reset button */}
          <button
            onClick={onReset}
            disabled={isResetting || controlsLocked}
            aria-label="Reset Demo"
            title={controlsLocked ? 'Wait for the running assessment to finish' : 'Reset demo state'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#dfe5ed] bg-white text-[#718097] hover:bg-[#f0f3f7] hover:text-[#152238] transition cursor-pointer disabled:opacity-50 text-xs font-medium"
          >
            <RotateCcw className={`size-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span className="text-[11px]">Reset Demo</span>
          </button>

          {/* User Avatar */}
          <div className="flex size-8 items-center justify-center rounded-full bg-[#dbe5f2] font-semibold text-[#335071] text-xs">
            {opportunity.sa_name
              ? opportunity.sa_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
              : 'AC'}
          </div>
        </div>
      </div>
    </header>
  );
}
