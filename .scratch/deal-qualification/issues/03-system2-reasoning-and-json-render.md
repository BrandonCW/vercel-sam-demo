# 03: System 2 Deep Reasoning, JSON Render Dynamic Form & Zero-Cost Paused Session

**What to build:**
The deep-reasoning System 2 analysis engine and declarative JSON Render dynamic form interface. Following System 1 evaluation, the backend invokes System 2 across three sequential phases (Gap Synthesis $\rightarrow$ Competitive Playbook $\rightarrow$ Form Generation) using the model selected in the UI dropdown (defaulting to Claude 3.5 Sonnet, with options for Claude 3.5 Haiku, GPT-4o-mini, and Gemini 2.0 Flash). The resulting structured JSON component schema is rendered dynamically in the right-hand action stage. Simultaneously, the Assessment Session enters an explicit zero-cost paused state (`pending_feedback`), displaying the prominent amber Zero-Cost Paused banner indicating that in-memory state is persisted with $0 compute/token burn while awaiting SA input.

**Blocked by:** 02: System 1 (Jev) Baseline MEDDPICC Scoring & Rubric Visualization

**Status:** ready-for-agent

- [ ] Phased System 2 reasoning pipeline implemented within the Eve agent framework:
  - Phase 1 (Gap Analysis): Evaluates unaddressed dimensions and Stage Gate blockers, isolating verified facts from AE assumptions.
  - Phase 2 (Competitive Playbook): Generates tactical counter-positioning points against detected competitors using Vercel enterprise differentiators (App Router native streaming, ISR, Edge Middleware, Turborepo remote caching).
  - Phase 3 (Form Generation): Formulates 3–5 interactive discovery questions targeting primary qualification blind spots.
- [ ] Multi-model client runner supporting runtime model selection passed from the UI (Claude 3.5 Sonnet default, Claude 3.5 Haiku, GPT-4o-mini, Gemini 2.0 Flash) with fallback to environment configuration.
- [ ] Strict declarative schema definition and validation for JSON Render forms (`JsonRenderFormSchema` supporting sections, callouts, text, textarea, select, and radio fields).
- [ ] Frontend `DynamicFormRenderer` React component that compiles declarative JSON schemas into accessible, interactive input fields with validation.
- [ ] Assessment Session state machine tracking lifecycle states (`initiated`, `analyzing`, `pending_feedback`, `resumed`, `delta_scoring`, `writeback`, `closed`).
- [ ] Persistent checkpointing of the active session state in Postgres upon completing form generation.
- [ ] High-visibility amber Zero-Cost Paused banner displayed in `pending_feedback` state confirming 0 tokens/sec and $0 compute incurred while awaiting the Solutions Architect.
