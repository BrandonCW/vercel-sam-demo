import { z } from 'zod';

/**
 * The single source of model IDs. Every ID is a current Vercel AI Gateway model
 * ID; the root agent, System 2 and the UI model selector all read from here.
 */
export const SYSTEM2_MODELS = [
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5', provider: 'Anthropic', badge: 'Fast' },
  { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'Anthropic', badge: 'Default' },
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

/*
 * Defaults are Sonnet 5, not Haiku 4.5 (issue 18). Through the Gateway, Haiku 4.5 did not produce
 * structured output: the root's turn outcome failed (OUTPUT_SCHEMA_NOT_FULFILLED) in 4/4 live
 * sessions, and the System 2 object stopped after its first property in 5/5 calls.
 */

/** Root agent (orchestration only: it calls the tools and reports one line). */
export const DEFAULT_AGENT_MODEL: System2ModelOption = 'anthropic/claude-sonnet-5';

/** System 2 when a turn names no model. */
export const DEFAULT_SYSTEM2_MODEL: System2ModelOption = 'anthropic/claude-sonnet-5';

export const System2ModelSchema = z.enum(
  SYSTEM2_MODELS.map((m) => m.id) as [System2ModelOption, ...System2ModelOption[]]
);

function modelFromEnv(env: Record<string, string | undefined>, name: string, fallback: System2ModelOption): System2ModelOption {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const parsed = System2ModelSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${name} "${raw}" is not a supported model. Use one of: ${System2ModelSchema.options.join(', ')}.`);
  }
  return parsed.data;
}

/** Model for the root eve agent. AGENT_MODEL_ID may override it with one of SYSTEM2_MODELS; anything else throws. */
export function resolveAgentModel(env: Record<string, string | undefined> = process.env): System2ModelOption {
  return modelFromEnv(env, 'AGENT_MODEL_ID', DEFAULT_AGENT_MODEL);
}

/** System 2 model when a turn names none. SYSTEM2_MODEL_ID may override it with one of SYSTEM2_MODELS; anything else throws. */
export function resolveSystem2Model(env: Record<string, string | undefined> = process.env): System2ModelOption {
  return modelFromEnv(env, 'SYSTEM2_MODEL_ID', DEFAULT_SYSTEM2_MODEL);
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
