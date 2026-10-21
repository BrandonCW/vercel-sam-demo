# TODOS

## Deal Desk OS Workbench

- [ ] **Focus-Guarded Stage Hotkeys (`1` / `2` / `3`)** (Deferred from Issue #24 CEO Review — Proposal #5)
  - **Context:** Power users navigating the Deal Desk OS 3-stage stepper (`1. Initial Deal Audit`, `2. Field Discovery Checklist`, `3. Updated Assessment & Next Steps`) could jump between unlocked stages using single-key `1`/`2`/`3` shortcuts when focus is outside form controls (`INPUT`, `TEXTAREA`, `SELECT`, `[role="combobox"]`, or open `[role="dialog"]`).
  - **Why deferred:** Deferred from Issue #24 under Principle 3 (Pragmatic) and Principle 5 (Explicit over clever) to avoid key-capture edge cases with custom select comboboxes and screen-reader navigation during the core layout refactor. Standard `<button>` keyboard navigation (`Tab` / `Enter` / `Space`) on `StepperBar` ships in Issue #24.
  - **Files:** `components/workbench/StepperBar.tsx`, `components/workbench/QualificationWorkbench.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`
