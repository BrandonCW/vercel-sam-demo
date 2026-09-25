import { defineTool } from "eve/tools";
import { gateway, streamText, Output } from "ai";
import { z } from "zod";
import { requireOpportunity } from "@/lib/db/crm";
import { loadLatestJevResult, recordSystem2Analysis } from "@/lib/db/assessments";
import { resolveAgentModel, System2ModelSchema } from "@/lib/models";
import { assertAiGatewayConfigured } from "@/lib/env";
import { assessmentScopeOf } from "@/lib/assessment-session";
import {
  System2ModelOutputSchema,
  toSystem2AnalysisResult,
  toSystem2Draft,
  type System2AnalysisResult,
  type System2Draft,
} from "@/lib/agents/system2";
import type { Opportunity } from "@/lib/types/crm";

const SYSTEM_PROMPT = `You are the Vercel Enterprise System 2 Deal Qualification Reasoning Engine.
System 1 (the Jev evaluation model) has already scored the opportunity; it returns scores only, no text.
Reason over the opportunity notes and the System 1 result in three phases:
1. Gap Synthesis (phase1Gaps): one entry per unaddressed or partial MEDDPICC dimension and per Stage Gate blocker. Separate verified facts from AE assumptions.
2. Competitive Playbook (phase2Competitive): one entry per competitor in System 1's competitiveFlags (Netlify, AWS Amplify, Cloudflare Pages, Akamai/Fastly, DIY Kubernetes / AWS ECS), with counter-positioning from Vercel enterprise differentiators and one trap question.
3. Discovery Form (phase3Form): 3 to 5 questions in total for the Solutions Architect, grouped into 1 to 3 sections (e.g. Stage Gate Blockers, Competitive Validation, Architecture & Metrics). Stage Gate blockers come first.

Form rules (the form is rendered as-is):
- Every property in the schema is required. Use null for a description, placeholder, helpCallout, calloutType or calloutText that does not apply; never omit a key.
- text and textarea fields have options: [].
- select, radio and checkbox_group fields have 2 to 5 options. Every option has both a label and a unique snake_case value. Do not repeat an option.
- Field and section ids are unique snake_case; a field's name equals its id.

dimensionFindings: for every one of the 8 dimensions, "citations" are exact sentences copied verbatim from the AE or SA notes that support the score ([] if none), and "gaps" are short callouts of what is missing ([] if none).
Set fatalBlocker only for a confirmed, unresolvable constraint that rules out Vercel; otherwise null.
valueFocus, primaryRisk and nextMilestone are short plain phrases without the "|" character.`;

const TIMEOUT_MS = 180_000;
/** Minimum gap between draft snapshots: each one is a durable stream event, so they are coalesced. */
const DRAFT_INTERVAL_MS = 750;

/** Preliminary snapshot (`action.partial`): what the model has written so far, display-only. */
type System2Drafting = { draft: System2Draft };
/** Final result (`action.result`): the validated, persisted analysis and the Opportunity after the write. */
type System2Persisted = { interactionId: string; system2Result: System2AnalysisResult; opportunity: Opportunity };

export default defineTool({
  description:
    "Run System 2 deep reasoning on an Opportunity already scored by System 1 in this Assessment Session: per-dimension citations and gap callouts, a JSON Render discovery form for the Solutions Architect (the session checkpoint), gap synthesis and a competitive playbook. Loads the Opportunity and the latest System 1 result itself and persists the analysis. Turn 1 only.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to analyze"),
    model: System2ModelSchema.optional().describe("Vercel AI Gateway model for System 2 (defaults to the configured model)"),
  }),
  label: {
    start: () => "Running System 2 analysis",
    delta: (_input, partial: System2Drafting | System2Persisted) => ("draft" in partial && partial.draft.form ? "Drafting the discovery form" : "Citing the notes"),
    complete: () => "System 2 analysis saved",
  },
  // The workbench renders from the full result; the root model only needs to know the checkpoint exists.
  toModelOutput(output: System2Drafting | System2Persisted) {
    if (!("system2Result" in output)) return { type: "json", value: { persisted: false } };
    const { modelUsed, fatalBlocker, phase3Form } = output.system2Result;
    return {
      type: "json",
      value: {
        persisted: true,
        modelUsed,
        fatalBlocker,
        discoveryQuestions: phase3Form.sections.reduce((n, s) => n + s.fields.length, 0),
      },
    };
  },
  async *execute({ opportunityId, model: requested }, ctx): AsyncGenerator<System2Drafting | System2Persisted> {
    const scope = assessmentScopeOf(ctx);
    const [opportunity, jevResult] = await Promise.all([
      requireOpportunity(opportunityId),
      loadLatestJevResult(opportunityId, scope.sessionId),
    ]);
    assertAiGatewayConfigured();
    const model = requested ?? resolveAgentModel();
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const abortSignal = ctx.abortSignal ? AbortSignal.any([ctx.abortSignal, timeout]) : timeout;

    const prompt = JSON.stringify({
      opportunity: {
        id: opportunity.id,
        name: opportunity.name,
        stageName: opportunity.stage_name,
        amount: Number(opportunity.amount),
        aeNotes: opportunity.ae_notes,
        saNotes: opportunity.sa_notes,
      },
      system1JevResult: {
        overallScore: jevResult.overallScore,
        dimensions: jevResult.dimensions,
        competitiveFlags: jevResult.competitiveFlags,
        stageGate: jevResult.stageGate,
      },
    });
    // One streamed structured-output call. Partial objects become display-only drafts; the final
    // object is validated in full. Gateway errors, timeouts and schema-invalid output all throw.
    // streamText reports stream errors to onError rather than throwing them; keep the first so
    // the action fails with the Gateway's own error instead of a generic "no output".
    let streamError: unknown = null;
    const result = streamText({
      model: gateway(model),
      system: SYSTEM_PROMPT,
      prompt,
      output: Output.object({
        schema: System2ModelOutputSchema,
        name: "system2_analysis",
        description: "System 2 per-dimension citations, SA discovery form, gap synthesis and competitive playbook.",
      }),
      abortSignal,
      onError: ({ error }) => {
        streamError ??= error;
      },
    });
    let lastDraftAt = 0;
    let pending: unknown = null;
    for await (const partial of result.partialOutputStream) {
      pending = partial;
      if (Date.now() - lastDraftAt < DRAFT_INTERVAL_MS) continue;
      lastDraftAt = Date.now();
      pending = null;
      yield { draft: toSystem2Draft(partial, opportunity.id) };
    }
    if (streamError) throw streamError;
    if (pending) yield { draft: toSystem2Draft(pending, opportunity.id) };
    const output = await result.output;
    if (!output) throw new Error(`System 2 model ${model} returned no structured output`);

    const system2Result = toSystem2AnalysisResult(output, { opportunityId: opportunity.id, model });
    const { interaction, opportunity: updated } = await recordSystem2Analysis(opportunity, jevResult, system2Result, scope);
    yield { interactionId: interaction.id, system2Result, opportunity: updated };
  },
});
