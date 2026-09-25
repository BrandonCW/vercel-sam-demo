import { evaluate } from "eve/ai";
import { gateway, generateText, Output } from "ai";
import { z } from "zod";
import { requireOpportunity } from "@/lib/db/crm";
import { buildJevEvaluationRequest, interpretJevEvaluation } from "@/lib/agents/jev-scorer";
import {
  recordJevScoring,
  recordSaFeedback,
  recordSystem2Analysis,
  writebackQualification,
} from "@/lib/db/assessments";
import { assertAiGatewayConfigured } from "@/lib/env";
import { resolveJevModel, type System2ModelOption } from "@/lib/models";
import { System2ModelOutputSchema, toSystem2AnalysisResult, type System2AnalysisResult } from "@/lib/agents/system2";
import type { AssessmentScope } from "@/lib/assessment-session";
import type { JevScoringResult } from "@/lib/agents/jev-schema";
import type { Opportunity } from "@/lib/types/crm";
import { AssessmentResultSchema, type AssessmentResult } from "@/lib/assessment-progress";

/**
 * The durable steps of `run_assessment`. Each is a `"use step"` function: eve records its
 * result, so a replayed workflow body never repeats a Gateway call or a CRM write. Every
 * step fails loudly and is never retried (`maxRetries = 0`): a failed step fails the
 * `run_assessment` action with its error.
 */

/** System 1: loads the Opportunity and scores it with Jev. Writes nothing. */
export async function scoreWithJev(opportunityId: string): Promise<{ opportunity: Opportunity; jevResult: JevScoringResult }> {
  "use step";
  assertAiGatewayConfigured();
  const opportunity = await requireOpportunity(opportunityId);
  const input = {
    opportunityId: opportunity.id,
    name: opportunity.name,
    accountName: opportunity.account_name,
    stageName: opportunity.stage_name,
    amount: opportunity.amount,
    aeNotes: opportunity.ae_notes,
    saNotes: opportunity.sa_notes,
  };
  // Jev answers typed questions; composite and stage gate are computed in code.
  const evaluation = await evaluate({ model: resolveJevModel(), ...buildJevEvaluationRequest(input) });
  return { opportunity, jevResult: interpretJevEvaluation(input, evaluation) };
}
scoreWithJev.maxRetries = 0;

/** Persists a System 1 result atomically (scores on the Opportunity plus its `initial_scoring` row). */
export async function saveJevScoring(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  scope: AssessmentScope
): Promise<Opportunity> {
  "use step";
  return (await recordJevScoring(opportunity, jevResult, scope)).opportunity;
}
saveJevScoring.maxRetries = 0;

const SYSTEM2_PROMPT = `You are the Vercel Enterprise System 2 Deal Qualification Reasoning Engine.
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

const SYSTEM2_TIMEOUT_MS = 180_000;

/**
 * System 2: one structured-output call on `model`, validated in full, then persisted with its
 * `questions_generated` checkpoint row. Not streamed: a step returns one value, and only the
 * workflow body's yields reach the workbench (issue 19).
 */
export async function analyzeWithSystem2(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  model: System2ModelOption,
  scope: AssessmentScope
): Promise<{ system2Result: System2AnalysisResult; opportunity: Opportunity }> {
  "use step";
  assertAiGatewayConfigured();
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
  // Gateway errors, timeouts and schema-invalid output all throw.
  const result = await generateText({
    model: gateway(model),
    system: SYSTEM2_PROMPT,
    prompt,
    output: Output.object({
      schema: System2ModelOutputSchema,
      name: "system2_analysis",
      description: "System 2 per-dimension citations, SA discovery form, gap synthesis and competitive playbook.",
    }),
    abortSignal: AbortSignal.timeout(SYSTEM2_TIMEOUT_MS),
  });
  if (!result.output) throw new Error(`System 2 model ${model} returned no structured output`);
  const system2Result = toSystem2AnalysisResult(result.output, { opportunityId: opportunity.id, model });
  const { opportunity: updated } = await recordSystem2Analysis(opportunity, jevResult, system2Result, scope);
  return { system2Result, opportunity: updated };
}
analyzeWithSystem2.maxRetries = 0;

/** The SA's answer to the discovery pause, as the workbench sends it (`respond([{ requestId, text }])`). */
export const SaAnswerSchema = z
  .object({
    formResponses: z.record(z.union([z.string(), z.array(z.string())])),
    notesDelta: z.string().optional(),
    feedbackKey: z.string().min(1),
  })
  .strict();
export type SaAnswer = z.infer<typeof SaAnswerSchema>;

/** Parses the answer text; anything that is not exactly an SA answer fails loudly. Pure. */
export function parseSaAnswer(text: string | undefined): SaAnswer {
  if (!text) throw new Error("The SA discovery answer was empty: the workbench must send the form answers as JSON text.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("The SA discovery answer is not JSON: the workbench must send { formResponses, notesDelta?, feedbackKey }.");
  }
  const parsed = SaAnswerSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `The SA discovery answer is malformed: ${parsed.error.issues.map((i) => `${i.path.join(".") || "answer"}: ${i.message}`).join("; ")}`
    );
  }
  return parsed.data;
}

/**
 * Records the SA answers once (sa_notes only, never ae_notes). The feedbackKey the workbench
 * computed must match the answers, or nothing is written.
 */
export async function recordFeedback(
  opportunityId: string,
  answer: SaAnswer,
  scope: AssessmentScope
): Promise<{ recorded: boolean; feedbackKey: string }> {
  "use step";
  return recordSaFeedback(
    opportunityId,
    { formResponses: answer.formResponses, notesDelta: answer.notesDelta, expectedKey: answer.feedbackKey },
    scope
  );
}
recordFeedback.maxRetries = 0;

/** Decides status and Suggested Next Steps in code, writes back atomically (closing the session) and returns the verdict. */
export async function writeBack(
  opportunityId: string,
  scope: AssessmentScope,
  feedback: AssessmentResult["feedback"]
): Promise<AssessmentResult> {
  "use step";
  const opportunity = await requireOpportunity(opportunityId);
  const written = await writebackQualification(opportunity, scope);
  // The verdict is built here, in code, and validated before it leaves the step.
  return AssessmentResultSchema.parse({
    status: "written_back",
    opportunityId,
    qualificationStatus: written.opportunity.qualification_status,
    baselineScore: written.baselineScore,
    finalScore: written.finalScore,
    delta: written.deltaScore,
    nextSteps: written.suggestedNextSteps,
    writebackId: written.writebackId,
    feedback,
    opportunity: written.opportunity,
  });
}
writeBack.maxRetries = 0;
