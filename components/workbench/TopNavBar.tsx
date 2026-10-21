'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Gauge, Settings, X, RotateCcw } from 'lucide-react';
import type { Opportunity, System2ModelOption } from '@/lib/types/crm';
import { SYSTEM2_MODELS } from '@/lib/types/crm';
import { DEMO_SCENARIOS } from '@/lib/db/scenarios';
import type { WorkbenchMode } from '@/lib/simulation/types';

export interface TopNavBarProps {
  opportunity?: Opportunity;
  mode?: WorkbenchMode;
  onModeChange?: (mode: WorkbenchMode) => void;
  onReset?: () => void | Promise<void>;
  isResetting?: boolean;
  currentScenarioId?: string;
  onScenarioChange?: (scenarioId: string) => void;
  selectedModel?: System2ModelOption;
  onModelChange?: (model: System2ModelOption) => void;
  controlsLocked?: boolean;
  runtimeStatus?: string;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}

export function TopNavBar({
  opportunity,
  mode = 'simulation',
  onModeChange,
  onReset,
  isResetting = false,
  currentScenarioId = 'scenario_acme_netlify',
  onScenarioChange,
  selectedModel = 'google/gemini-3.8-flash',
  onModelChange,
  controlsLocked = false,
  settingsOpen,
  onSettingsOpenChange,
}: TopNavBarProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = settingsOpen !== undefined ? settingsOpen : internalOpen;
  const setIsOpen = onSettingsOpenChange || setInternalOpen;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and keyboard dismissal for accessible dialog
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus into dialog
    const timer = setTimeout(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled])'
      );
      firstFocusable?.focus();
    }, 10);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  return (
    <header className="border-b border-[#E2E0D8] bg-[#FFFFFF]">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
        {/* Deal Operations Title & Logo */}
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-[#111215] text-[#FFFFFF]">
            <Gauge className="size-5 text-[#FFFFFF]" aria-hidden="true" />
          </div>
          <div>
            <p className="font-display text-[11px] font-semibold tracking-[0.05em] uppercase text-[#787C87]">
              DEAL OPERATIONS
            </p>
            <h1 className="font-display text-base font-bold tracking-[-0.03em] text-[#111215] sm:text-lg">
              Qualification System
            </h1>
          </div>
        </div>

        {/* Right Section: Settings Trigger & User Avatar */}
        <div className="flex items-center gap-3 text-xs text-[#52545D]">
          {/* Settings Trigger Button */}
          <button
            ref={triggerRef}
            type="button"
            aria-label="Workbench settings"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#111215] hover:bg-[#F1F0EC] transition cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-[#111215]"
          >
            <Settings className="size-4 text-[#52545D]" aria-hidden="true" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* User Avatar */}
          <div className="flex size-8 items-center justify-center rounded-full bg-[#F1F0EC] border border-[#E2E0D8] font-semibold text-[#111215] text-xs">
            {opportunity?.sa_name
              ? opportunity.sa_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
              : 'AC'}
          </div>
        </div>
      </div>

      {/* Accessible Settings Popover Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-black/20 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
              triggerRef.current?.focus();
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-label="Workbench settings"
            aria-modal="true"
            className="w-full max-w-sm rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] p-5 shadow-xl transition space-y-5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#E2E0D8] pb-3">
              <div className="flex items-center gap-2">
                <Settings className="size-4 text-[#111215]" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-[#111215]">Workbench Settings</h2>
              </div>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className="rounded p-1 text-[#787C87] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Execution Mode Segmented Control */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#111215]">Execution Mode</label>
              <div className="grid grid-cols-2 gap-1.5 rounded-md border border-[#E2E0D8] bg-[#F1F0EC] p-1">
                <button
                  type="button"
                  onClick={() => onModeChange?.('simulation')}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                    mode === 'simulation'
                      ? 'bg-[#FFFFFF] text-[#111215] shadow-xs'
                      : 'text-[#52545D] hover:text-[#111215]'
                  }`}
                >
                  ⚡ Simulation mode
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange?.('live')}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                    mode === 'live'
                      ? 'bg-[#FFFFFF] text-[#111215] shadow-xs'
                      : 'text-[#52545D] hover:text-[#111215]'
                  }`}
                >
                  🌐 Live AI mode
                </button>
              </div>
            </div>

            {/* Scenario Selector */}
            {onScenarioChange && (
              <div className="space-y-1.5">
                <label
                  htmlFor="workbench-scenario-select"
                  className="block text-xs font-semibold text-[#111215]"
                >
                  Demo Scenario
                </label>
                <select
                  id="workbench-scenario-select"
                  aria-label="Select Scenario"
                  value={currentScenarioId}
                  onChange={(e) => onScenarioChange(e.target.value)}
                  disabled={controlsLocked}
                  className="w-full rounded-md border border-[#E2E0D8] bg-[#F1F0EC] px-3 py-2 text-xs font-medium text-[#111215] focus:outline-none focus:ring-1 focus:ring-[#111215] disabled:opacity-50 cursor-pointer"
                >
                  {Object.entries(DEMO_SCENARIOS).map(([id, scenario]) => (
                    <option key={id} value={id} className="bg-white text-[#111215]">
                      {scenario.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* System 2 Model Selector */}
            {onModelChange && (
              <div className="space-y-1.5">
                <label
                  htmlFor="workbench-model-select"
                  className="block text-xs font-semibold text-[#111215]"
                >
                  System 2 Intelligence Model
                </label>
                <select
                  id="workbench-model-select"
                  aria-label="Select System 2 Model"
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value as System2ModelOption)}
                  className="w-full rounded-md border border-[#E2E0D8] bg-[#F1F0EC] px-3 py-2 text-xs font-medium text-[#111215] focus:outline-none focus:ring-1 focus:ring-[#111215] cursor-pointer"
                >
                  {SYSTEM2_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-white text-[#111215]">
                      {m.label} ({m.badge})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Demo Button */}
            {onReset && (
              <div className="pt-2 border-t border-[#E2E0D8]">
                <button
                  type="button"
                  onClick={async () => {
                    await onReset();
                  }}
                  disabled={isResetting || controlsLocked}
                  aria-label="Reset Demo"
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`size-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>Reset Demo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
