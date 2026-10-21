# Agent Guidelines

## Behavioral Rules

This project adheres to the gstack behavioral rules and ethos. See `.agents/rules/gstack.md`.

## Skills

Project skills are available under `.agents/skills/`. The skills define their own workflows, entry gates, and validation criteria.

## Domain Documentation

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Design System

Read `DESIGN.md` before visual or UI work: it defines the fonts, colors, spacing, and
aesthetic direction. Ask the user before departing from it. When reviewing or QA-ing
UI, flag code that doesn't match `DESIGN.md`.

## Issue Tracker & Backlog

Backlog and specs live as markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

## Context Lifecycle & Checkpointing (/context-save & /context-restore)

In accordance with gstack engineering discipline, the agent must proactively recommend saving working state via `/context-save` at distinct lifecycle boundaries, and resuming via `/context-restore`:

1. **Post-Planning (After Spec / Brainstorming)**:
   - When an initial plan or spec is drafted via `/office-hours` or `/spec`, save progress before diving into review pipelines.
2. **Post-Review / Pre-Build (Critical Milestone Gate)**:
   - Immediately upon completing the full review pipeline (`/plan-ceo-review`, `/plan-design-review`, prototype verification, and `/plan-eng-review`), **ALWAYS recommend `/context-save` before writing implementation code**.
   - *Why*: Flushes planning context bloat, seals the approved task contract (T1–T8) into an authoritative checkpoint on disk, and allows starting implementation in a fresh session (`/context-restore`) with full context capacity and maximum reasoning precision.
3. **Mid-Build Seams**:
   - When completing a cohesive cluster of implementation tasks (e.g. schema/domain layer finished and tests green, before starting UI wiring).
4. **Session Boundaries & Hand-offs**:
   - Before ending a work session, stepping away, or handing off across worktrees/branches.
5. **Session Start**:
   - At the beginning of any new work session or after context compaction, run `/context-restore` to recover the newest branch checkpoint and verified next steps.

## Skill Routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
