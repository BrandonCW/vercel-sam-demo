import { z } from 'zod';

/**
 * The single source of model IDs. Every ID is a current Vercel AI Gateway model
 * ID; the root agent, System 2 and the UI model selector all read from here.
 */
export const SYSTEM2_MODELS = [
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5', provider: 'Anthropic', badge: 'Default' },
  { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'Anthropic', badge: 'Deeper' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5', provider: 'OpenAI', badge: 'Alternative' },
  { id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash', provider: 'Google', badge: 'Low-latency' },
] as const;

export type System2ModelOption = (typeof SYSTEM2_MODELS)[number]['id'];

export interface ModelConfig {
  id: System2ModelOption;
  label: string;
  provider: string;
  badge: string;
}

export const DEFAULT_SYSTEM2_MODEL: System2ModelOption = 'anthropic/claude-haiku-4.5';

export const System2ModelSchema = z.enum(
  SYSTEM2_MODELS.map((m) => m.id) as [System2ModelOption, ...System2ModelOption[]]
);

/**
 * Model for the root eve agent (and System 2's default). SYSTEM2_MODEL_ID may override the
 * default but must be one of SYSTEM2_MODELS; anything else throws.
 */
export function resolveAgentModel(
  env: Record<string, string | undefined> = process.env
): System2ModelOption {
  const raw = env.SYSTEM2_MODEL_ID?.trim();
  if (!raw) return DEFAULT_SYSTEM2_MODEL;
  const parsed = System2ModelSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `SYSTEM2_MODEL_ID "${raw}" is not a supported model. Use one of: ${System2ModelSchema.options.join(', ')}.`
    );
  }
  return parsed.data;
}

export const DEFAULT_JEV_MODEL = 'typesafe-ai/jev';

/**
 * Evaluation model for System 1. JEV_MODEL_ID may override it with another
 * Gateway evaluation model ID (`provider/model`); the failure eval uses this to
 * force a failing Gateway call. Malformed values throw.
 */
export function resolveJevModel(env: Record<string, string | undefined> = process.env): string {
  const raw = env.JEV_MODEL_ID?.trim();
  if (!raw) return DEFAULT_JEV_MODEL;
  if (!/^[a-z0-9-]+\/[a-z0-9][a-z0-9.-]*$/i.test(raw)) {
    throw new Error(`JEV_MODEL_ID "${raw}" is not a provider/model Gateway ID (e.g. ${DEFAULT_JEV_MODEL}).`);
  }
  return raw;
}
