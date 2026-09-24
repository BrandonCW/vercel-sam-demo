import { System2ModelOption } from '@/lib/types/crm';
import { System2Input, System2AnalysisResult } from './system2';
import { assertAiGatewayConfigured } from '@/lib/env';
import { JsonRenderFormSchema } from '@/lib/ui/json-render-schema';
import { gateway, generateText } from 'ai';

export interface RunnerOptions {
  model?: System2ModelOption;
  timeoutMs?: number;
}

function buildSystem2Prompts(input: System2Input) {
  const { opportunity, jevResult, model } = input;

  const systemPrompt = `You are the Vercel Enterprise System 2 Deal Qualification Reasoning Engine.
Your task is to perform deep reasoning on an enterprise opportunity across 3 sequential phases:
1. Phase 1: Gap Synthesis & Risk Analysis: Evaluate unaddressed or partial MEDDPICC dimensions and Stage Gate blockers. Isolate verified facts from AE assumptions.
2. Phase 2: Competitive Playbook & Battlecard Synthesis: Formulate tactical counter-positioning angles and trap questions for detected competitors (Netlify, AWS Amplify, Cloudflare Pages, Akamai/Fastly, DIY Kubernetes) using Vercel enterprise differentiators.
3. Phase 3: Dynamic JSON Render Form Generation: Formulate strictly 3 to 5 interactive discovery questions for the Solutions Architect targeting key blind spots. Group fields into logical sections (e.g. Stage Gate Blockers, Competitive Validation, Architecture & Metrics). Supported field types: "text", "textarea", "select", "radio", "checkbox_group".

You MUST return a JSON object with this EXACT structure:
{
  "phase1Gaps": [
    {
      "dimension": "economicBuyer" | "metrics" | "decisionCriteria" | "decisionProcess" | "paperProcess" | "identifyPain" | "champion" | "competition",
      "dimensionLabel": string,
      "score": number,
      "status": "unaddressed" | "partial",
      "isStageGateBlocker": boolean,
      "riskLevel": "critical" | "high" | "medium" | "low",
      "verifiedFact": string,
      "aeAssumption": string,
      "riskAnalysis": string
    }
  ],
  "phase2Competitive": [
    {
      "competitor": string,
      "threatLevel": "low" | "medium" | "high",
      "competitorClaim": string,
      "vercelDifferentiator": string,
      "tacticalAngle": string,
      "trapQuestion": string
    }
  ],
  "phase3Form": {
    "opportunityId": "${opportunity.id}",
    "title": "Technical Qualification & Discovery Validation",
    "summary": string,
    "sections": [
      {
        "id": string,
        "title": string,
        "description": string,
        "calloutType": "info" | "warning" | "tip",
        "calloutText": string,
        "fields": [
          {
            "id": string,
            "name": string,
            "label": string,
            "description": string,
            "type": "text" | "textarea" | "select" | "radio" | "checkbox_group",
            "required": boolean,
            "placeholder": string (optional),
            "dimensionTarget": "metrics" | "economicBuyer" | "decisionCriteria" | "decisionProcess" | "paperProcess" | "identifyPain" | "champion" | "competition",
            "helpCallout": string (optional),
            "options": [{ "label": string, "value": string, "description": string (optional) }] (for select/radio/checkbox_group)
          }
        ]
      }
    ]
  },
  "summary": string
}`;

  const userPrompt = JSON.stringify({
    opportunity: {
      id: opportunity.id,
      name: opportunity.name,
      stageName: opportunity.stageName,
      amount: opportunity.amount,
      aeNotes: opportunity.aeNotes,
      saNotes: opportunity.saNotes,
    },
    system1JevResult: {
      overallScore: jevResult.overallScore,
      dimensions: jevResult.dimensions,
      competitiveFlags: jevResult.competitiveFlags,
      stageGate: jevResult.stageGate,
    },
    requestedModel: model,
  });

  return { systemPrompt, userPrompt };
}

/**
 * Call the System 2 model through Vercel AI Gateway.
 */
async function callLiveModel(
  input: System2Input,
  model: System2ModelOption,
  timeoutMs: number = 15000
): Promise<System2AnalysisResult> {
  const { systemPrompt, userPrompt } = buildSystem2Prompts(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const gatewayModelId =
      model === 'claude-3-5-sonnet'
        ? 'anthropic/claude-3-5-sonnet'
        : model === 'claude-3-5-haiku'
        ? 'anthropic/claude-3-5-haiku'
        : model === 'gpt-4o-mini'
        ? 'openai/gpt-4o-mini'
        : 'google/gemini-2.5-flash';

    const { text: jsonText } = await generateText({
      model: gateway(gatewayModelId),
      system: systemPrompt,
      prompt: userPrompt,
      abortSignal: controller.signal,
    });

    if (!jsonText) {
      throw new Error(`No JSON output returned from Vercel AI Gateway for model ${model}`);
    }

    // Extract JSON if wrapped in markdown code fence
    const cleaned = jsonText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Enforce opportunityId and validate the generated form; a missing or invalid form throws.
    if (!parsed.phase3Form || typeof parsed.phase3Form !== 'object') {
      throw new Error(`System 2 model ${model} returned no phase3Form`);
    }
    const phase3Form = JsonRenderFormSchema.parse({
      ...parsed.phase3Form,
      opportunityId: input.opportunity.id,
    });

    return {
      opportunityId: input.opportunity.id,
      modelUsed: model,
      phase1Gaps: parsed.phase1Gaps || [],
      phase2Competitive: parsed.phase2Competitive || [],
      phase3Form,
      summary: parsed.summary || `Live model ${model} completed System 2 deep reasoning.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * System 2 Multi-Model Runner
 * Dispatches to the selected model through Vercel AI Gateway. Missing
 * AI_GATEWAY_API_KEY, Gateway errors, and invalid model output all throw.
 */
export async function runSystem2Analysis(
  input: System2Input,
  options?: RunnerOptions
): Promise<System2AnalysisResult> {
  assertAiGatewayConfigured();
  const model: System2ModelOption = options?.model || input.model || 'claude-3-5-sonnet';
  return callLiveModel({ ...input, model }, model, options?.timeoutMs);
}
