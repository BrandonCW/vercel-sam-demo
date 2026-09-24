# MEDDPICC Qualification Rubric & Stage Gate Reference

This document is the canonical reference for the 8-dimension MEDDPICC qualification rubric, scoring formulas, competitive threat classifications, and sales stage gate progression criteria used by Jev (System 1) and the Eve Deal Qualification Agent.

---

## 1. MEDDPICC Dimensions & Weights

The composite qualification score is calculated on a 0–100 integer scale using the weighted sum of all eight dimensions:

$$\text{Composite Score} = \sum_{i=1}^{8} \left( \text{Dimension Score}_i \times 10 \times \text{Weight}_i \right)$$

| Dimension | Key | Weight | Description | Vercel Enterprise Evaluation Focus |
| :--- | :---: | :---: | :--- | :--- |
| **Identify Pain** | `identifyPain` | **20%** | The critical operational or business pain driving change. | Deploy queue bottlenecks, slow build times (30–60m), outage risk during product launches, CDN cache invalidation limits, multi-zone latency issues. |
| **Champion** | `champion` | **15%** | Internal advocate with credibility, influence, and access to decision makers. | Technical leaders (Head of Platform, VP Eng, Staff Architect) actively advocating for Next.js/Vercel and selling internally on Vercel's behalf. |
| **Economic Buyer** | `economicBuyer` | **15%** | Individual with unilateral discretionary power to authorize budget. | Verified executive sponsor (CTO, VP of E-Commerce, Chief Digital Officer, CFO) with sign-off authority and confirmed budget allocation. |
| **Decision Criteria** | `decisionCriteria` | **15%** | Technical and commercial standards used to judge solutions. | Explicit technical requirements: Next.js App Router/Turborepo native support, Edge Middleware latency, SOC2 Type II, 99.99% SLA, and zero-downtime cutover. |
| **Decision Process** | `decisionProcess` | **10%** | Step-by-step workflow and timeline to reach a buying decision. | Formal POC benchmarks, architecture review board signoff, security review milestones, and scheduled committee dates. |
| **Metrics** | `metrics` | **10%** | Quantifiable economic and operational targets. | Core Web Vitals (LCP < 1.5s, INP < 200ms), developer build-time reduction (e.g. 45m $\rightarrow$ 5m), infrastructure cost savings, conversion uplift. |
| **Competition** | `competition` | **10%** | Incumbent or competing vendors under active consideration. | Vendor positioning against Netlify, AWS Amplify, Cloudflare Pages, Fastly/Akamai, or in-house DIY Kubernetes/ECS deployments. |
| **Paper Process** | `paperProcess` | **5%** | Legal, procurement, and contracting procedures required to close. | Vendor onboarding timeline, standard MSA review, custom SLA terms, data processing addendum (DPA), and procurement approvals. |

---

## 2. Dimension Scoring Levels & Status Criteria

Each dimension is graded on an integer scale from **0 to 10** based on discovery evidence:

| Score Range | Status | Definition | Criteria & Evidence Standards |
| :---: | :---: | :--- | :--- |
| **0 – 3** | `unaddressed` | Missing / Unverified | No mention in AE or SA notes, or only speculative assumptions without customer corroboration. |
| **4 – 7** | `partial` | Identified / Qualitative | Qualitative mention or intent expressed, but lacks quantitative metrics, formal signoff, or stakeholder verification. |
| **8 – 10** | `verified` | Confirmed & Documented | Explicitly verified with documented evidence, stakeholder confirmation, or completed technical validation. |

### Confidence Score
Every dimension result includes a `confidence` rating from **0.0 to 1.0**, reflecting the density and recency of direct citations extracted from the Account Executive and Solutions Architect notes.

---

## 3. Stage Gate Progression Criteria

An Opportunity cannot advance to subsequent pipeline stages without passing the designated stage gate thresholds:

### Stage Gate 2: Discovery $\rightarrow$ Technical Validation (Stage 2 $\rightarrow$ Stage 3)
*Ensures the technical team only commits SA resources to deals with validated pain and an engaged champion.*

- **Identify Pain**: $\ge 6 / 10$ (`partial` or higher with clear technical/business blocker)
- **Champion**: $\ge 5 / 10$ (Identified advocate with internal credibility)
- **Metrics**: $\ge 4 / 10$ (Preliminary measurable targets identified)
- **Overall Composite Score**: $\ge 50 / 100$
- **Gate Failure Output**: Flagged as blocked with specific missing criteria (e.g., `"Cannot advance to Technical Validation: No internal Champion identified"`).

### Stage Gate 3: Technical Validation $\rightarrow$ Proposal / Commercial (Stage 3 $\rightarrow$ Stage 4)
*Ensures commercial proposals are only issued when technical architecture is validated and the Economic Buyer is engaged.*

- **Decision Criteria**: $\ge 7 / 10$ (All core technical benchmarks verified and documented)
- **Economic Buyer**: $\ge 6 / 10$ (Direct engagement or verified sponsor sign-off)
- **Decision Process**: $\ge 5 / 10$ (Formal procurement and evaluation steps mapped)
- **Identify Pain**: $\ge 7 / 10$
- **Champion**: $\ge 7 / 10$
- **Overall Composite Score**: $\ge 70 / 100$
- **Gate Failure Output**: Blocks progression and generates targeted SA qualification questions to resolve gaps.

---

## 4. Competitive Detection & Threat Assessment

Jev scans raw AE/SA notes against known frontend and cloud infrastructure competitors:

| Competitor | Category | Threat Indicators | Vercel Strategic Counter-Positioning |
| :--- | :--- | :--- | :--- |
| **Netlify** | Frontend Cloud | Incumbent contract renewal, multi-year discounting (20–40%), familiar dev ergonomics. | Native Next.js first-party optimization, App Router & ISR parity, Turborepo integration, superior global edge latency. |
| **AWS Amplify** | Hyperscaler Native | Existing AWS Enterprise Agreement (EDP) credits, consolidated billing, bundled services. | Superior developer experience, sub-second preview builds, purpose-built frontend infra vs generic container wrappers. |
| **Cloudflare Pages** | Edge / CDN | Aggressive zero-egress cost claims, existing Cloudflare DNS/WAF footprint. | Full-stack serverless compute capabilities, native Node.js ecosystem compatibility, dynamic cache invalidation ergonomics. |
| **DIY Kubernetes / ECS** | In-house Infrastructure | Platform engineering teams defending bespoke Kubernetes/Terraform stacks. | Total Cost of Ownership (TCO), ongoing maintenance overhead, zero-ops CI/CD velocity, instant preview branches for marketing/QA. |

### Threat Levels:
- **`low`**: Casual mention or legacy tool being replaced with full alignment on Vercel.
- **`medium`**: Competing solution is under active evaluation in a bake-off; evaluation criteria not yet locked.
- **`high`**: Competitor is incumbent with multi-year pricing discounts, or executive sponsor prefers incumbent vendor.
