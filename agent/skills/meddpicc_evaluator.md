---
description: Reference for MEDDPICC dimensions and Gate 2/3 exit criteria when explaining a Jev score or stage gate result. The rules are applied in code; docs/meddpicc-rubric.md is the source of truth.
---

# MEDDPICC Rubric Evaluator Skill

This skill provides the standard evaluation rules, formulas, and weights for enterprise deal qualification:

## Dimension Weights & Formulas

$$\text{Composite Score} = \sum_{i=1}^{8} \left( \text{Dimension Score}_i \times 10 \times \text{Weight}_i \right)$$

| Dimension | Key | Weight | Status Thresholds |
| :--- | :--- | :--- | :--- |
| **Identify Pain** | `identifyPain` | 20% | 0–3: unaddressed, 4–7: partial, 8–10: verified |
| **Champion** | `champion` | 15% | 0–3: unaddressed, 4–7: partial, 8–10: verified |
| **Economic Buyer** | `economicBuyer` | 15% | 0–3: unaddressed, 4–7: partial, 8–10: verified |
| **Decision Criteria** | `decisionCriteria` | 15% | 0–3: unaddressed, 4–7: partial, 8–10: verified |
| **Decision Process** | `decisionProcess` | 10% | 0–3: unaddressed, 4–7: partial, 8–10: verified |
| **Metrics** | `metrics` | 10% | 0–3: unaddressed, 4–7: partial, 8–10: verified |
| **Competition** | `competition` | 10% | 0–3: unaddressed, 4–7: partial, 8–10: verified |
| **Paper Process** | `paperProcess` | 5% | 0–3: unaddressed, 4–7: partial, 8–10: verified |

## Gate 2 Exit Criteria (Discovery -> Technical Validation)
- Identify Pain $\ge 6$
- Champion $\ge 5$
- Metrics $\ge 4$
- Economic Buyer $\ge 4$
- Overall MEDDPICC score $\ge 50$

## Gate 3 Exit Criteria (Technical Validation -> Proposal)
- Decision Criteria $\ge 7$
- Economic Buyer $\ge 6$
- Decision Process $\ge 5$
- Identify Pain $\ge 7$
- Champion $\ge 7$
- Overall MEDDPICC score $\ge 70$
