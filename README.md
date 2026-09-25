# Deal Qualification System

A demo of AI-assisted enterprise deal qualification. It reads a sales opportunity's field notes, scores the deal against the MEDDPICC framework, explains the score by citing the notes, and asks the Solutions Architect targeted follow-up questions. Once the SA answers, it re-scores the deal and writes a standardised next step back to the CRM.

It is a working prototype for demonstrating the approach. It is not a production CRM integration: the CRM is simulated and the scenarios are fictional.

## The problem it addresses

Qualifying an enterprise deal means judging scattered, informal notes against a framework such as MEDDPICC:

| Letter | Stands for |
|---|---|
| M | Metrics |
| E | Economic Buyer |
| D | Decision Criteria |
| D | Decision Process |
| P | Paper Process |
| I | Identify Pain |
| C | Champion |
| C | Competition |

Done by hand, this is slow and inconsistent, and the gaps it finds rarely become concrete next steps. This project shows how an agent can:

- **Score consistently** with a dedicated evaluation model rather than a free-form prompt.
- **Show its evidence.** Every dimension comes with quotes taken from the notes and a list of what's missing.
- **Close the gaps** by generating a short discovery form that targets the weakest dimensions.
- **Update the record** with one standardised next step, without touching the Account Executive's original notes.

## How it works

One qualification is one **Assessment Session**, which runs in two halves with a pause in between.

```
 AE + SA notes ──▶ 1. Score (System 1) ──▶ 2. Analyse (System 2) ──▶ 3. Pause for the SA
                                                                            │
     CRM updated ◀── 5. Write back next step ◀── 4. Re-score with answers ◀─┘
```

1. **Score (System 1).** An evaluation model rates each MEDDPICC dimension from 0 to 10, with a confidence level, and flags competitor threats. Plain code turns those ratings into a composite score and checks whether the deal can advance to the next stage.
2. **Analyse (System 2).** A language model explains each score by quoting the notes, lists the gaps, suggests how to position against competitors, and builds a discovery form of 3–5 targeted questions.
3. **Pause.** The session waits, at no cost, while the SA goes back to the customer. The wait can last minutes or days.
4. **Re-score.** The SA's answers are added to the notes, and System 1 scores the deal again so the change is visible.
5. **Write back.** Code decides the qualification status and writes one next step to the CRM, for example `[QUALIFIED] … | Owner: … | Focus: … | Watch: …`.

The workbench shows each result as it arrives: scores first, then the analysis and form.

## Demo scenarios

Three fictional opportunities come pre-loaded, and each can be reset to its starting state:

| Scenario | What it demonstrates |
|---|---|
| **Acme Corp** (Netlify renewal contested) | Strong pain and an engaged champion, but no confirmed Economic Buyer, so the stage gate blocks. After discovery answers, the deal qualifies. |
| **Globex FinTech** (AWS Amplify bake-off) | A competitive evaluation that stays in review. |
| **Soylent Retail** (Shopify Plus replatforming) | A headless commerce deal working around a Q4 code freeze. |

## Built with

| Component | Role |
|---|---|
| [Next.js](https://nextjs.org) | The workbench web app |
| **eve** | The agent framework. The whole assessment runs inside the eve agent (`agent/`): a durable workflow that can pause for the SA and resume later. The web app talks to it directly. |
| [Vercel AI Gateway](https://vercel.com/ai-gateway) | Routes every model call |
| **Jev** (`typesafe-ai/jev`) | System 1 evaluation model |
| Gemini 3.8 Flash | Default model for System 2 and for the agent. Other models can be selected in the UI. |
| [Neon](https://neon.tech) Postgres | The simulated CRM and an audit log of each assessment |

A design principle runs throughout: **fail loudly**. If a model, the Gateway or the database fails, the app shows the error. It never substitutes canned or estimated results.

## Repository layout

| Path | Contents |
|---|---|
| `agent/` | The eve agent: instructions, the assessment workflow and its tools |
| `app/`, `components/` | The Next.js workbench |
| `lib/` | Shared logic: scoring, schemas, database access, UI state |
| `db/`, `scripts/` | Database schema and the demo seed script |
| `evals/`, `tests/` | Live agent evaluations and unit/integration tests |
| `docs/` | The [MEDDPICC rubric](docs/meddpicc-rubric.md) and [development notes](docs/development.md) |
| `CONTEXT.md` | Glossary of the domain terms used across the code |

## Running it locally

You need Node.js, pnpm, a Postgres database (Neon works well), and a Vercel AI Gateway API key.

```bash
pnpm install
cp .env.example .env.local                          # then fill in the values
pnpm exec tsx --env-file=.env.local scripts/db-seed.ts   # create tables and load the demo scenarios
pnpm dev                                            # http://localhost:3000
```

The tests and evals run against a separate test database, configured in `.env.test.local`. They reset it on every run.

```bash
pnpm db:seed:test   # one-time: seed the test database and mark it as safe to reset
pnpm test           # unit and integration tests
pnpm eval           # live end-to-end agent evaluations (makes billed model calls)
```

See [docs/development.md](docs/development.md) for the database setup, test tiers, evals and the details of how the UI and agent connect.
