import { z } from 'zod';

/**
 * The single source of model IDs. Every ID is a current Vercel AI Gateway model
 * ID; the root agent, System 2 and the UI model selector all read from here.
 */
export const SYSTEM2_MODELS = [
  { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash', provider: 'Google', badge: 'Default' },
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5', provider: 'Anthropic', badge: 'Fast' },
] as const;

export type System2ModelOption = (typeof SYSTEM2_MODELS)[number]['id'];

export interface ModelConfig {
  id: System2ModelOption;
  label: string;
  provider: string;
  badge: string;
}

/**
 * Root agent: it calls run_assessment once and returns the structured turn outcome; the session's
 * steps are sequenced in code (issue 19). Gemini 3.8 Flash did this in 5/5 live sessions (one
 * Acme cycle and the four evals).
 */
export const DEFAULT_AGENT_MODEL: System2ModelOption = 'google/gemini-3.8-flash';

/**
 * System 2 when a turn names none: a fast model with schema-constrained output.
 */
export const DEFAULT_SYSTEM2_MODEL: System2ModelOption = 'google/gemini-3.8-flash';

export const System2ModelSchema = z.enum(
  SYSTEM2_MODELS.map((m) => m.id) as [System2ModelOption, ...System2ModelOption[]]
);

function modelFromEnv(env: Record<string, string | undefined>, name: string, fallback: System2ModelOption): System2ModelOption {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const parsed = System2ModelSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Unknown System 2 model: ${raw} (${name}). Supported models: ${System2ModelSchema.options.join(', ')}.`);
  }
  return parsed.data;
}

/** Model for the root eve agent. AGENT_MODEL_ID may override it with one of SYSTEM2_MODELS; anything else throws. */
export function resolveAgentModel(input: string | Record<string, string | undefined> = process.env): System2ModelOption {
  if (typeof input === 'string') {
    const raw = input.trim();
    const parsed = System2ModelSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Unknown Agent model: ${raw}. Supported models: ${System2ModelSchema.options.join(', ')}.`);
    }
    return parsed.data;
  }
  return modelFromEnv(input, 'AGENT_MODEL_ID', DEFAULT_AGENT_MODEL);
}

/** System 2 model when a turn names none. SYSTEM2_MODEL_ID may override it with one of SYSTEM2_MODELS; anything else throws. */
export function resolveSystem2Model(input: string | Record<string, string | undefined> = process.env): System2ModelOption {
  if (typeof input === 'string') {
    const raw = input.trim();
    const parsed = System2ModelSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Unknown System 2 model: ${raw}. Supported models: ${System2ModelSchema.options.join(', ')}.`);
    }
    return parsed.data;
  }
  return modelFromEnv(input, 'SYSTEM2_MODEL_ID', DEFAULT_SYSTEM2_MODEL);
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
