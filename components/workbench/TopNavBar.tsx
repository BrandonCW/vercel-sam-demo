'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Gauge, Settings, X, RotateCcw, ChevronDown } from 'lucide-react';
import type { Opportunity, System2ModelOption } from '@/lib/types/crm';
import { SYSTEM2_MODELS } from '@/lib/types/crm';
import { DEMO_SCENARIOS } from '@/lib/db/scenarios';
import type { WorkbenchMode } from '@/lib/simulation/types';

export interface TopNavBarProps {
  opportunity?: Opportunity;
  mode?: WorkbenchMode;
  onModeChange?: (mode: WorkbenchMode) => void | Promise<void>;
  onReset?: () => void | Promise<void>;
  isResetting?: boolean;
  currentScenarioId?: string;
  onScenarioChange?: (scenarioId: string) => void | Promise<void>;
  selectedModel?: System2ModelOption;
  onModelChange?: (model: System2ModelOption) => void;
  controlsLocked?: boolean;
  runtimeStatus?: string;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}

export function TopNavBar({
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

  const modePillRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isLive = mode === 'live';

  // Focus trap and keyboard dismissal for accessible dialog
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        (lastTriggerRef.current ?? triggerRef.current)?.focus();
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
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3.5 sm:px-6">
        {/* Deal Operations Title & Logo */}
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-[#111215] text-[#FFFFFF]">
            <Gauge className="size-5 text-[#FFFFFF]" aria-hidden="true" />
          </div>
          <div>
            <p className="font-sans text-kicker font-semibold uppercase text-[#787C87]">
              DEAL OPERATIONS
            </p>
            <h1 className="font-sans text-base font-bold tracking-[-0.025em] text-[#111215] sm:text-lg leading-tight">
              Qualification System
            </h1>
          </div>
        </div>

        {/* Right Section: Monochrome Mode Pill & Settings Trigger */}
        <div className="flex items-center gap-2 font-sans text-xs text-[#52545D]">
          {/* Monochrome Execution Mode Pill */}
          <button
            ref={modePillRef}
            type="button"
            title={
              isLive
                ? 'Live AI inference via Gateway — click to configure'
                : 'AI Simulation mode (deterministic responses) — click to switch to Live AI'
            }
            onClick={() => {
              lastTriggerRef.current = modePillRef.current;
              setIsOpen(!isOpen);
            }}
            className={
              isLive
                ? 'inline-flex min-h-8 items-center gap-2 rounded-md border border-[#111215] bg-[#111215] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#FFFFFF] hover:bg-[#111215]/90 transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#111215]'
                : 'inline-flex min-h-8 items-center gap-2 rounded-md border border-[#E2E0D8] bg-[#F1F0EC] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#111215] hover:border-[#111215] transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#111215]'
            }
          >
            <span
              aria-hidden="true"
              className={
                isLive
                  ? 'size-2 shrink-0 rounded-full bg-[#FFFFFF]'
                  : 'size-2 shrink-0 rounded-full border-[1.5px] border-[#787C87]'
              }
            />
            <span className="ui-pill-label">{isLive ? 'Live' : 'Simulation'}</span>
          </button>

          {/* Settings Trigger Button */}
          <button
            ref={triggerRef}
            type="button"
            aria-label="Workbench settings"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onClick={() => {
              lastTriggerRef.current = triggerRef.current;
              setIsOpen(!isOpen);
            }}
            className="inline-flex min-h-8 items-center gap-2 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-1.5 font-sans text-xs font-medium leading-none text-[#111215] hover:bg-[#F1F0EC] transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#111215]"
          >
            <Settings className="size-3.5 shrink-0 text-[#52545D]" aria-hidden="true" />
            <span className="ui-pill-label hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Accessible Settings Popover Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-black/20 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
              (lastTriggerRef.current ?? triggerRef.current)?.focus();
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-label="Workbench settings"
            aria-modal="true"
            className="w-full max-w-[26rem] rounded-lg border border-[#E2E0D8] bg-[#FFFFFF] p-5 font-sans shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] transition space-y-5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#E2E0D8] pb-3">
              <div className="flex items-center gap-2">
                <Settings className="size-4 text-[#111215]" aria-hidden="true" />
                <h2 className="font-sans text-base font-semibold tracking-[-0.015em] text-[#111215]">
                  Workbench Settings
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => {
                  setIsOpen(false);
                  (lastTriggerRef.current ?? triggerRef.current)?.focus();
                }}
                className="rounded p-1 text-[#787C87] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Execution Mode Segmented Control */}
            <div className="space-y-1.5">
              <label className="block font-sans text-xs font-semibold text-[#111215]">
                Execution Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5 rounded-md border border-[#E2E0D8] bg-[#F1F0EC] p-1">
                <button
                  type="button"
                  disabled={controlsLocked}
                  aria-pressed={mode === 'simulation'}
                  onClick={() => {
                    void onModeChange?.('simulation');
                  }}
                  className={`min-h-8 rounded px-2.5 py-1.5 font-sans text-xs font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    mode === 'simulation'
                      ? 'border border-[#E2E0D8] bg-[#FFFFFF] text-[#111215] font-semibold'
                      : 'text-[#52545D] hover:text-[#111215]'
                  }`}
                >
                  Simulated AI (Instant Replay)
                </button>
                <button
                  type="button"
                  disabled={controlsLocked}
                  aria-pressed={mode === 'live'}
                  onClick={() => {
                    void onModeChange?.('live');
                  }}
                  className={`min-h-8 rounded px-2.5 py-1.5 font-sans text-xs font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    mode === 'live'
                      ? 'border border-[#E2E0D8] bg-[#FFFFFF] text-[#111215] font-semibold'
                      : 'text-[#52545D] hover:text-[#111215]'
                  }`}
                >
                  Live AI Inference
                </button>
              </div>
              <p className="font-sans text-xs text-[#787C87] leading-relaxed">
                {mode === 'simulation'
                  ? 'Deterministic AI evaluation replay against the simulated Salesforce CRM.'
                  : 'Live AI Gateway evaluation and writeback to the simulated Salesforce CRM.'}
              </p>
            </div>

            {/* Active Opportunity Selector */}
            {onScenarioChange && (
              <div className="space-y-1.5">
                <label
                  htmlFor="workbench-scenario-select"
                  className="block font-sans text-xs font-semibold text-[#111215]"
                >
                  Active Opportunity
                </label>
                <div className="relative">
                  <select
                    id="workbench-scenario-select"
                    aria-label="Select active opportunity"
                    value={currentScenarioId}
                    onChange={(e) => {
                      void onScenarioChange(e.target.value);
                    }}
                    disabled={controlsLocked}
                    className="w-full min-h-10 appearance-none rounded-md border border-[#E2E0D8] bg-[#F8F8F6] px-3.5 py-2 pr-10 font-sans text-sm font-normal text-[#111215] leading-normal transition-colors hover:border-[#C8C5BA] focus:border-[#111215] focus:bg-[#FFFFFF] focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:bg-[#F1F0EC] disabled:text-[#A6A7AD]"
                  >
                    {Object.entries(DEMO_SCENARIOS).map(([id, scenario]) => (
                      <option key={id} value={id} className="bg-white text-[#111215]">
                        {scenario.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 ${
                      controlsLocked ? 'text-[#A6A7AD]' : 'text-[#52545D]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Gap & Discovery Analysis Model Selector */}
            {onModelChange && (
              <div className="space-y-1.5">
                <label
                  htmlFor="workbench-model-select"
                  className="block font-sans text-xs font-semibold text-[#111215]"
                >
                  Gap &amp; Discovery Analysis Model
                </label>
                <div className="relative">
                  <select
                    id="workbench-model-select"
                    aria-label="Select analysis model"
                    value={selectedModel}
                    disabled={controlsLocked || mode === 'simulation'}
                    onChange={(e) => onModelChange(e.target.value as System2ModelOption)}
                    className="w-full min-h-10 appearance-none rounded-md border border-[#E2E0D8] bg-[#F8F8F6] px-3.5 py-2 pr-10 font-sans text-sm font-normal text-[#111215] leading-normal transition-colors hover:border-[#C8C5BA] focus:border-[#111215] focus:bg-[#FFFFFF] focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:bg-[#F1F0EC] disabled:text-[#A6A7AD]"
                  >
                    {SYSTEM2_MODELS.map((m) => (
                      <option key={m.id} value={m.id} className="bg-white text-[#111215]">
                        {m.label} ({m.badge})
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 ${
                      controlsLocked || mode === 'simulation' ? 'text-[#A6A7AD]' : 'text-[#52545D]'
                    }`}
                  />
                </div>
                {mode === 'simulation' && (
                  <p className="font-sans text-xs text-[#787C87]">
                    Model selection applies in Live AI mode
                  </p>
                )}
              </div>
            )}

            {/* Reset Opportunity Baseline Button */}
            {onReset && (
              <div className="pt-2 border-t border-[#E2E0D8]">
                <button
                  type="button"
                  onClick={async () => {
                    await onReset();
                  }}
                  disabled={isResetting || controlsLocked}
                  aria-label="Reset Opportunity Baseline"
                  className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[#E2E0D8] bg-[#FFFFFF] px-3 py-2 font-sans text-xs font-semibold leading-none text-[#52545D] hover:bg-[#F1F0EC] hover:text-[#111215] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className={`size-3.5 shrink-0 ${isResetting ? 'animate-spin' : ''}`} />
                  <span className="ui-pill-label">Reset Opportunity Baseline</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
