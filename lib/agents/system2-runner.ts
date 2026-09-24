import { System2ModelOption } from '@/lib/types/crm';
import {
  System2Input,
  System2AnalysisResult,
  executeSystem2Pipeline,
} from './system2';
import { JsonRenderFormSchema } from '@/lib/ui/json-render-schema';

export interface RunnerOptions {
  model?: System2ModelOption;
  forceDeterministicFallback?: boolean;
  timeoutMs?: number;
}

/**
 * Check if the environment has credentials configured for the requested model provider.
 */
export function hasProviderKey(model: System2ModelOption): boolean {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  const hasGateway = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_TOKEN);
  if (hasGateway) {
    return true;
  }

  switch (model) {
    case 'claude-3-5-sonnet':
    case 'claude-3-5-haiku':
      return Boolean(process.env.ANTHROPIC_API_KEY || process.env.EVE_API_KEY);
    case 'gpt-4o-mini':
      return Boolean(process.env.OPENAI_API_KEY);
    case 'gemini-2-flash':
      return Boolean(
        process.env.GEMINI_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          process.env.GOOGLE_GENERATIVE_AI_API_KEY
      );
    default:
      return false;
  }
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
 * Call live LLM provider endpoint directly when API keys are configured.
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
    let jsonText = '';

    if (
      (model === 'claude-3-5-sonnet' || model === 'claude-3-5-haiku') &&
      process.env.ANTHROPIC_API_KEY
    ) {
      const modelId =
        model === 'claude-3-5-sonnet'
          ? 'claude-3-5-sonnet-20241022'
          : 'claude-3-5-haiku-20241022';

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      const content = data.content?.[0];
      if (content?.type === 'text') {
        jsonText = content.text;
      }
    } else if (model === 'gpt-4o-mini' && process.env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      jsonText = data.choices?.[0]?.message?.content || '';
    } else if (
      model === 'gemini-2-flash' &&
      (process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY)
    ) {
      const apiKey =
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_TOKEN) {
      const gatewayKey = process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_TOKEN;
      const gatewayModel =
        model === 'claude-3-5-sonnet'
          ? 'anthropic/claude-3-5-sonnet'
          : model === 'claude-3-5-haiku'
          ? 'anthropic/claude-3-5-haiku'
          : model === 'gpt-4o-mini'
          ? 'openai/gpt-4o-mini'
          : 'google/gemini-2.0-flash';

      const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gatewayKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: gatewayModel,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Vercel AI Gateway error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      jsonText = data.choices?.[0]?.message?.content || '';
    }

    if (!jsonText) {
      throw new Error(`No JSON output returned from live model ${model}`);
    }

    // Extract JSON if wrapped in markdown code fence
    const cleaned = jsonText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Enforce opportunityId & validate schema
    parsed.opportunityId = input.opportunity.id;
    parsed.modelUsed = model;
    if (parsed.phase3Form) {
      parsed.phase3Form.opportunityId = input.opportunity.id;
      JsonRenderFormSchema.parse(parsed.phase3Form);
    }

    return {
      opportunityId: input.opportunity.id,
      modelUsed: model,
      phase1Gaps: parsed.phase1Gaps || [],
      phase2Competitive: parsed.phase2Competitive || [],
      phase3Form: parsed.phase3Form,
      summary: parsed.summary || `Live model ${model} completed System 2 deep reasoning.`,
      executionMode: 'live_model',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * System 2 Multi-Model Runner
 * Dispatches to external LLM provider if API keys are configured;
 * otherwise provides deterministic, high-fidelity scenario-aware fallback generations
 * to guarantee offline local dev, tests, and CI work reliably with 0 network dependencies.
 */
export async function runSystem2Analysis(
  input: System2Input,
  options?: RunnerOptions
): Promise<System2AnalysisResult> {
  const model: System2ModelOption = options?.model || input.model || 'claude-3-5-sonnet';
  const forceFallback = options?.forceDeterministicFallback ?? false;

  const effectiveInput: System2Input = {
    ...input,
    model,
  };

  const hasKey = !forceFallback && hasProviderKey(model);

  if (hasKey) {
    try {
      const liveResult = await callLiveModel(effectiveInput, model, options?.timeoutMs);
      return liveResult;
    } catch (err: any) {
      console.warn(
        `Live call for model ${model} failed, falling back to deterministic pipeline:`,
        err
      );
      const fallbackResult = executeSystem2Pipeline(effectiveInput);
      fallbackResult.executionMode = 'deterministic_fallback';
      fallbackResult.fallbackReason = `Live ${model} provider call failed (${err?.message || 'error'}); fell back to deterministic pipeline`;
      JsonRenderFormSchema.parse(fallbackResult.phase3Form);
      return fallbackResult;
    }
  }

  // High-fidelity, deterministic scenario-aware fallback execution
  const result = executeSystem2Pipeline(effectiveInput);
  result.executionMode = 'deterministic_fallback';
  result.fallbackReason = `No credentials found for ${model} in environment (set AI_GATEWAY_API_KEY or provider API key); fell back to deterministic pipeline`;

  // Validate the resulting form strictly
  JsonRenderFormSchema.parse(result.phase3Form);

  return result;
}
