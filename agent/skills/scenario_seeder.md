---
description: Describes the canonical demo scenarios (Acme/Netlify, Globex/AWS Amplify, Soylent/Headless) to pick a scenarioId for reset_crm_data.
---

# Scenario Seeder Skill

This skill defines the canonical demo scenarios and seed datasets used to simulate enterprise CRM opportunities:

## Canonical Demo Scenarios

1. **`scenario_acme_netlify` (Acme Corp)**:
   - **Type**: Enterprise Replatforming & Incumbent Renewal
   - **Stage**: Stage 2 - Discovery
   - **Amount**: $180,000
   - **Competitor**: Netlify (High threat; 30% renewal discount offer)
   - **Pain Points**: 45-minute build queues, lack of ISR, Black Friday preview outage (~$400k lost orders)
   - **Gate Status**: Blocked by unverified Economic Buyer sign-off authority and missing quantitative KPIs

2. **`scenario_globex_amplify` (Globex FinTech)**:
   - **Type**: Regulated FinTech & Cloud Hyperscaler Bake-Off
   - **Stage**: Stage 2 - Discovery
   - **Amount**: $240,000
   - **Competitor**: AWS Amplify (High threat; AWS account team credits and cloud bundling)
   - **Pain Points**: SOC2 Type II compliance, strict egress IP filtering / VPC peering requirements, SSO
   - **Gate Status**: Active discovery & security architecture evaluation

3. **`scenario_soylent_headless` (Soylent Retail)**:
   - **Type**: Headless E-Commerce Replatforming
   - **Stage**: Stage 2 - Discovery
   - **Amount**: $90,000
   - **Competitor**: Akamai/Fastly (Legacy CDN edge rules requiring migration or cache-control parity)
   - **Pain Points**: Urgent Q4 peak freeze deadline (Nov 1), Core Web Vitals (LCP < 1.5s), marketing preview branches & Sanity CMS webhooks
   - **Gate Status**: Fast-moving discovery requiring urgent architectural sign-off
