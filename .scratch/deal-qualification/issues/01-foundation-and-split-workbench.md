# 01: Foundation, Simulated CRM Persistence & Split Workbench Shell

**What to build:**
A functional Next.js App Router application with the simulated Salesforce CRM persistence layer, the lightweight password authentication gate, and the persistent Split Workbench user interface. The Solutions Architect or Account Executive can view Opportunity records seeded from three realistic enterprise Scenarios (`scenario_acme_netlify`, `scenario_globex_amplify`, `scenario_soylent_headless`), inspect raw qualitative AE Notes and initial SA Notes, view baseline MEDDPICC score placeholders, switch between Scenarios using the topbar selector, and trigger an instant "Reset Demo State" button that re-seeds the active Scenario and revalidates the UI.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Next.js App Router project initialized with Tailwind CSS and base component styling matching the Split Workbench prototype layout.
- [ ] Lightweight stateless password authentication gate implemented in Edge Middleware using HMAC-SHA256 session cookie, completely bypassed when running in local development mode (`NODE_ENV === 'development'`).
- [ ] Dedicated `/login` page with password input for authenticating on staging or production deployments.
- [ ] Simulated Salesforce database schema deployed in Postgres/Neon containing `opportunities`, `deal_scenarios`, and `deal_interactions` tables.
- [ ] Pre-seeded database fixtures for three enterprise Scenarios: Acme Corp (Netlify renewal threat), Globex FinTech (AWS Amplify bake-off), and Soylent Retail (Shopify Plus + Next.js App Router DTC replatforming).
- [ ] Top navigation bar displaying Opportunity name, Deal Stage badge, Annual Contract Value (ACV), assigned AE/SA, runtime status badge, Scenario selector dropdown, and System 2 Model Selector dropdown (options: Claude 3.5 Sonnet [default], Claude 3.5 Haiku, GPT-4o-mini, Gemini 2.0 Flash).
- [ ] Left column rendering read-only AE Notes card, SA Notes card, and initial MEDDPICC 8-dimension rubric cards.
- [ ] Right column rendering the initial `READY_TO_ASSESS` state with a "Start Assessment" action trigger.
- [ ] Demo reset action (`POST /api/crm/reset`) and UI button that re-seeds the selected Scenario to its default unqualified state and triggers page revalidation.
