import { evaluate } from "eve/ai";
import { gateway, generateText, Output } from "ai";
import { z } from "zod";
import { getOpportunity, getOpportunityWithServerTimestamp } from "@/lib/db/crm";
import { buildJevEvaluationRequest, interpretJevEvaluation } from "@/lib/agents/jev-scorer";
import {
  finalizeAssessmentWriteback,
  recordJevScoring,
  recordSaFeedback,
  recordSystem2Analysis,
  type WritebackInMemoryContext,
} from "@/lib/db/assessments";
import { assertAiGatewayConfigured } from "@/lib/env";
import { resolveJevModel, type System2ModelOption } from "@/lib/models";
import { System2ModelOutputSchema, toSystem2AnalysisResult, type System2AnalysisResult } from "@/lib/agents/system2";
import type { AssessmentScope } from "@/lib/assessment-session";
import type { JevScoringResult } from "@/lib/agents/jev-schema";
import type { Opportunity } from "@/lib/types/crm";
import { AssessmentResultSchema, type AssessmentResult } from "@/lib/assessment-progress";

export class FatalError extends Error {
  readonly fatal = true;
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FatalError";
  }
}

/**
 * The durable steps of `run_assessment`. Each is a `"use step"` function: eve records its
 * result, so a replayed workflow body never repeats a Gateway call or a CRM write. Every
 * step fails loudly and is never retried (`maxRetries = 0`): a failed step fails the
 * `run_assessment` action with its error.
 */

/** Loads the Opportunity (with DB server timestamp) and scores all 8 MEDDPICC dimensions. Writes nothing. */
export async function scoreWithJev(
  opportunityId: string,
  signal?: AbortSignal
): Promise<{ opportunity: Opportunity; jevResult: JevScoringResult; sessionStartedAt: string }> {
  "use step";
  assertAiGatewayConfigured();
  const snapshot = await getOpportunityWithServerTimestamp(opportunityId);
  if (!snapshot) {
    throw new FatalError(`Opportunity "${opportunityId}" not found in CRM.`);
  }
  const { opportunity, serverTimestamp } = snapshot;
  const input = {
    opportunityId: opportunity.id,
    name: opportunity.name,
    accountName: opportunity.account_name,
    stageName: opportunity.stage_name,
    amount: opportunity.amount,
    aeNotes: opportunity.ae_notes,
    saNotes: opportunity.sa_notes,
  };
  const evaluation = await evaluate({
    model: resolveJevModel(),
    ...buildJevEvaluationRequest(input),
    abortSignal: signal,
  });
  return {
    opportunity,
    jevResult: interpretJevEvaluation(input, evaluation),
    sessionStartedAt: serverTimestamp,
  };
}
scoreWithJev.maxRetries = 0;

/** Persists a MEDDPICC rubric result atomically (scores on the Opportunity plus its `initial_scoring` row). */
export async function saveJevScoring(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  scope: AssessmentScope,
  sessionStartedAt?: string | null
): Promise<Opportunity> {
  "use step";
  return (await recordJevScoring(opportunity, jevResult, scope, { sessionStartedAt })).opportunity;
}
saveJevScoring.maxRetries = 0;

const SYSTEM2_PROMPT = `You are the Vercel Enterprise Deal Desk Qualification & Gap Analysis Engine.
Baseline MEDDPICC rubric scores have already been evaluated from the Opportunity notes (scores only, no prose).
Synthesize verbatim buyer citations, unresolved rubric gaps, and a targeted discovery checklist from the Opportunity notes and baseline rubric scores:
1. Discovery Form (phase3Form): 3 to 5 questions in total for the Solutions Architect, grouped into 1 to 3 sections (e.g. Stage Gate Blockers, Competitive Validation, Architecture & Metrics). Stage Gate blockers come first.

Form rules (the form is rendered as-is):
- Every property in the schema is required. Use null for a description, placeholder, helpCallout, calloutType or calloutText that does not apply; never omit a key.
- text and textarea fields have options: [].
- select, radio and checkbox_group fields have 2 to 5 options. Every option has both a label and a unique snake_case value. Do not repeat an option.
- Field and section ids are unique snake_case; a field's name equals its id.

dimensionFindings: for every one of the 8 dimensions, "citations" are exact sentences copied verbatim from the AE or SA notes that support the score ([] if none), and "gaps" are short callouts of what is missing ([] if none).
Set fatalBlocker only for a confirmed, unresolvable constraint that rules out Vercel; otherwise null.
valueFocus, primaryRisk and nextMilestone are short plain phrases without the "|" character.`;

const SYSTEM2_TIMEOUT_MS = 180_000;
const GEMINI_THINKING_BUDGET = 1024;

async function runSystem2Inference(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  model: System2ModelOption,
  signal?: AbortSignal
): Promise<System2AnalysisResult> {
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
    baselineRubricResult: {
      overallScore: jevResult.overallScore,
      dimensions: jevResult.dimensions,
      competitiveFlags: jevResult.competitiveFlags,
      stageGate: jevResult.stageGate,
    },
  });
  const abortSignal = signal
    ? AbortSignal.any([AbortSignal.timeout(SYSTEM2_TIMEOUT_MS), signal])
    : AbortSignal.timeout(SYSTEM2_TIMEOUT_MS);
  const result = await generateText({
    model: gateway(model),
    system: SYSTEM2_PROMPT,
    prompt,
    output: Output.object({
      schema: System2ModelOutputSchema,
      name: "system2_analysis",
      description: "Per-dimension buyer citations, Solutions Architect discovery form, and gap synthesis.",
    }),
    ...(model.startsWith("google/")
      ? { providerOptions: { google: { thinkingConfig: { thinkingBudget: GEMINI_THINKING_BUDGET } } } }
      : {}),
    abortSignal,
  });
  if (!result.output) {
    throw new FatalError(`Analysis model ${model} returned no structured gap analysis output.`);
  }
  return toSystem2AnalysisResult(result.output, { opportunityId: opportunity.id, model });
}

/**
 * Runs deep gap & citation synthesis against the already-loaded Opportunity in memory so it can
 * execute concurrently with `saveJevScoring` without waiting on a serial DB barrier or re-reading Neon.
 */
export async function generateSystem2Analysis(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  model: System2ModelOption,
  signal?: AbortSignal
): Promise<System2AnalysisResult> {
  "use step";
  return runSystem2Inference(opportunity, jevResult, model, signal);
}
generateSystem2Analysis.maxRetries = 0;

/** Persists a validated gap & citation analysis result (`questions_generated` checkpoint row) after baseline scoring is saved. */
export async function saveSystem2Analysis(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  system2Result: System2AnalysisResult,
  scope: AssessmentScope,
  writebackWithoutFeedback?: boolean,
  sessionStartedAt?: string | null
): Promise<Opportunity> {
  "use step";
  const { opportunity: updated } = await recordSystem2Analysis(
    opportunity,
    jevResult,
    system2Result,
    scope,
    writebackWithoutFeedback ? "skipped_feedback" : "pending_feedback",
    { sessionStartedAt }
  );
  return updated;
}
saveSystem2Analysis.maxRetries = 0;

/**
 * Combined structured-output synthesis + persistence step (retained for direct step callers).
 */
export async function analyzeWithSystem2(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  model: System2ModelOption,
  scope: AssessmentScope,
  signal?: AbortSignal,
  writebackWithoutFeedback?: boolean
): Promise<{ system2Result: System2AnalysisResult; opportunity: Opportunity }>;
export async function analyzeWithSystem2(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  model: System2ModelOption,
  scope: AssessmentScope,
  options?: { signal?: AbortSignal; writebackWithoutFeedback?: boolean; sessionStartedAt?: string | null }
): Promise<{ system2Result: System2AnalysisResult; opportunity: Opportunity }>;
export async function analyzeWithSystem2(
  opportunity: Opportunity,
  jevResult: JevScoringResult,
  model: System2ModelOption,
  scope: AssessmentScope,
  signalOrOptions?:
    | AbortSignal
    | { signal?: AbortSignal; writebackWithoutFeedback?: boolean; sessionStartedAt?: string | null },
  writebackWithoutFeedbackParam?: boolean
): Promise<{ system2Result: System2AnalysisResult; opportunity: Opportunity }> {
  "use step";
  const signal = signalOrOptions instanceof AbortSignal ? signalOrOptions : signalOrOptions?.signal;
  const writebackWithoutFeedback =
    signalOrOptions instanceof AbortSignal
      ? Boolean(writebackWithoutFeedbackParam)
      : Boolean(signalOrOptions?.writebackWithoutFeedback ?? writebackWithoutFeedbackParam);
  const sessionStartedAt =
    signalOrOptions instanceof AbortSignal ? undefined : signalOrOptions?.sessionStartedAt;
  const system2Result = await runSystem2Inference(opportunity, jevResult, model, signal);
  const { opportunity: updated } = await recordSystem2Analysis(
    opportunity,
    jevResult,
    system2Result,
    scope,
    writebackWithoutFeedback ? "skipped_feedback" : "pending_feedback",
    { sessionStartedAt }
  );
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
 * Records the SA answers once (`sa_notes` only, never `ae_notes`). The `feedbackKey` the workbench
 * computed must match the answers, or nothing is written.
 */
export async function recordFeedback(
  opportunityId: string,
  answer: SaAnswer,
  scope: AssessmentScope,
  options?: { phase3Form?: System2AnalysisResult["phase3Form"]; sessionStartedAt?: string | null }
): Promise<{ recorded: boolean; feedbackKey: string }> {
  "use step";
  return recordSaFeedback(
    opportunityId,
    { formResponses: answer.formResponses, notesDelta: answer.notesDelta, expectedKey: answer.feedbackKey },
    scope,
    options
  );
}
recordFeedback.maxRetries = 0;

export interface WriteBackStepContext extends WritebackInMemoryContext {
  opportunity?: Opportunity;
}

/** Decides status and Suggested Next Steps in code, writes back atomically (closing the session) and returns the verdict. */
export async function writeBack(
  opportunityId: string,
  scope: AssessmentScope,
  feedback: AssessmentResult["feedback"],
  inMemory?: WriteBackStepContext
): Promise<AssessmentResult> {
  "use step";
  const opportunity = inMemory?.opportunity ?? (await getOpportunity(opportunityId));
  if (!opportunity) {
    throw new FatalError(`Opportunity "${opportunityId}" not found in CRM.`);
  }
  const written = await finalizeAssessmentWriteback(opportunity, scope, inMemory);
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
