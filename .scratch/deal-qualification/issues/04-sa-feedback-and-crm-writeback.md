# 04: SA Feedback Ingestion, Delta Re-scoring & Atomic CRM Writeback

**What to build:**
The feedback ingestion loop, secondary Delta Re-scoring by System 1, standardized Suggested Next Steps synthesis, and atomic CRM Writeback into Postgres. When the Solutions Architect submits answers via the dynamic qualification form, the backend appends the structured findings to SA Notes with a timestamp, executes System 1 Delta Re-scoring, re-evaluates the Stage Gate thresholds, maps the resulting Qualification Status (unqualified, in_review, qualified, disqualified), synthesizes the single standardized Suggested Next Steps string, and performs an atomic writeback to the Opportunity record. The UI transitions to the `COMPLETED` state, rendering the high-contrast Suggested Next Steps card with a 1-click clipboard copy button and updated CRM metrics.

**Blocked by:** 03: System 2 Deep Reasoning, JSON Render Dynamic Form & Zero-Cost Paused Session

**Status:** ready-for-agent

- [ ] Feedback API endpoint (`POST /api/qualification/feedback`) that ingests form responses and optional manual SA discovery observations.
- [ ] Structured discovery note formatter that appends timestamped discovery updates directly into the Opportunity's `sa_notes` while leaving raw `ae_notes` strictly untouched.
- [ ] System 1 Delta Re-scoring trigger re-evaluating the augmented Opportunity notes, updating dimension scores, and computing whether the Deal Stage Gate is cleared.
- [ ] Qualification Status transition logic updating status to `qualified` (if stage gate passed), `in_review` (if improved but gate blocked), or `disqualified` (if fatal blocker identified).
- [ ] Standardized Suggested Next Steps synthesis generating a single actionable string formatted as: `[<STATUS>] <Immediate Milestone Action> | Owner: <AE/SA> | Focus: <Core Technical or Business Value> | Watch: <Risk/Competitor>`.
- [ ] Atomic database Writeback updating ONLY `suggested_next_steps`, `sa_notes`, `qualification_status`, `meddpicc_score`, `meddpicc_breakdown`, and `updated_at` in the Postgres `opportunities` table.
- [ ] Audit telemetry row recorded in `deal_interactions` capturing feedback payload, delta scores, and writeback text.
- [ ] Assessment Session marked as `closed`, and Next.js path revalidated.
- [ ] Right-hand UI stage transitions to `COMPLETED` state, displaying the prominent Suggested Next Steps card, a "Copy to Clipboard" button, writeback confirmation badge, and a "Re-evaluate Deal" action.
