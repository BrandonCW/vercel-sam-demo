# 02: System 1 (Jev) Baseline MEDDPICC Scoring & Rubric Visualization

**What to build:**
The deterministic System 1 (Jev) rubric evaluation engine and real-time visualization on the Split Workbench. When the Solutions Architect clicks "Start Assessment", the backend ingests AE Notes and SA Notes, executes System 1 scoring in $<1.5$ seconds, computes the weighted 8-dimension MEDDPICC Score (0–100), extracts competitive mentions and assigns threat levels, checks Deal Stage Gate thresholds (e.g. Stage 2 $\rightarrow$ Stage 3 prerequisites), persists results to Postgres, and logs an interaction record. The Left Column UI dynamically updates to render colored progress bars, status tags (unaddressed, partial, verified), direct quotation evidence pills, and Stage Gate blocker notifications.

**Blocked by:** 01: Foundation, Simulated CRM Persistence & Split Workbench Shell

**Status:** ready-for-agent

- [ ] Deterministic System 1 (Jev) scoring module with strict Zod output validation (`JevScoringResultSchema`).
- [ ] 8-dimension weighted composite formula implemented adhering strictly to canonical weights: Identify Pain (20%), Champion (15%), Economic Buyer (15%), Decision Criteria (15%), Decision Process (10%), Metrics (10%), Competition (10%), Paper Process (5%).
- [ ] Dimension evaluation assigning integer scores (0–10), status (`unaddressed`, `partial`, `verified`), confidence score (0.0–1.0), textual evidence citations, and gap explanations.
- [ ] Enterprise competitive scanner extracting mentions from notes for target competitors (Netlify, AWS Amplify, Cloudflare Pages, Akamai/Fastly, DIY Kubernetes) with classification of threat levels (`low`, `medium`, `high`).
- [ ] Stage Gate exit logic evaluating readiness for Stage 2 $\rightarrow$ Stage 3 and Stage 3 $\rightarrow$ Stage 4, producing human-readable `gateBlockers`.
- [ ] Assessment initiation API endpoint (`POST /api/qualification/assess`) that runs System 1 scoring, updates the Opportunity in Postgres (`meddpicc_score`, `meddpicc_breakdown`, `competitive_flags`), and records a `deal_interactions` telemetry event.
- [ ] Left column UI components updated to render real-time progress bars, maturity tags, evidence snippets, competitive threat badges, and Stage Gate blocker alert banners upon assessment completion.
