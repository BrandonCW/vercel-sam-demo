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

## Workflow & Skill Routing

Once a spec or plan is approved, advance continuously through isolated worktree creation, implementation, `## Verification`, `/review-agy`, `/qa-agy`, and `/ship-agy` without artificial checkpoint stop-gates.

Key routing rules (GStack `--web` tier under `.agents/skills/`):
- Product ideas / discovery → `/office-hours-agy` or `/spec-agy`
- Strategy / scope → `/plan-ceo-review-agy`
- Design system / plan review → `/design-consultation-agy` or `/plan-design-review-agy`
- Full plan review pipeline → `/autoplan-agy`
- Verification / complex debugging → `/verify-agy` (or `/autoplan-agy` for architectural root-cause analysis)
- QA / testing site behavior → `/qa-agy`, `/qa-only-agy`, or `/browse-agy`
- Code review / diff check → `/review-agy`
- Security audit → `/cso-agy`
- Visual polish → `/design-review-agy`
- Ship / deploy / PR → `/ship-agy` or `/land-and-deploy-agy`
- Knowledge sync → `/sync-gbrain-agy` (via native `gbrain` MCP tools)

## Verification
<!-- agy-verify: npm test -->
- Test suite (Vitest): `npm test`
- Typecheck (TypeScript): `npx tsc --noEmit`
- Production build: `npm run build`
- Lint: `npm run lint`

