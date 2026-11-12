import { z } from 'zod';

/**
 * Required runtime configuration. Every accessor validates with Zod on use and
 * throws a descriptive error when a variable is missing or malformed. There are
 * no defaults and no offline substitutes.
 */

const nonEmpty = (name: string, hint: string) =>
  z
    .string({ required_error: `${name} is required. ${hint}` })
    .trim()
    .min(1, `${name} is required. ${hint}`);

const AiGatewaySchema = z.object({
  AI_GATEWAY_API_KEY: nonEmpty(
    'AI_GATEWAY_API_KEY',
    'Create one in Vercel Dashboard -> AI Gateway -> API Keys.'
  ),
});

const PostgresSchema = z.object({
  POSTGRES_URL: nonEmpty('POSTGRES_URL', 'Set it to the Neon Postgres connection string.').regex(
    /^postgres(ql)?:\/\//,
    'POSTGRES_URL must be a postgres:// or postgresql:// connection string.'
  ),
});

const AuthSchema = z.object({
  APP_PASSWORD: nonEmpty('APP_PASSWORD', 'Required outside local development.'),
  AUTH_SECRET: nonEmpty('AUTH_SECRET', 'Required outside local development (openssl rand -base64 32).'),
});

function parse<T extends z.ZodTypeAny>(schema: T, source: NodeJS.ProcessEnv = process.env): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join(' ');
    throw new Error(`Missing or invalid environment configuration: ${messages}`);
  }
  return result.data;
}

export function getAiGatewayApiKey(source: NodeJS.ProcessEnv = process.env): string {
  return parse(AiGatewaySchema, source).AI_GATEWAY_API_KEY;
}

export interface LiveEnvConfig {
  postgresUrl: string;
  aiGatewayAuth: 'api_key' | 'oidc';
  aiGatewayApiKey?: string;
  vercelOidcToken?: string;
}

/**
 * Throws a descriptive error unless the AI Gateway is configured via either
 * static `AI_GATEWAY_API_KEY` or Vercel's runtime `VERCEL_OIDC_TOKEN`.
 */
export function assertAiGatewayConfigured(source: NodeJS.ProcessEnv = process.env): {
  mode: 'api_key' | 'oidc';
  token: string;
} {
  const apiKey = source.AI_GATEWAY_API_KEY?.trim();
  if (apiKey) {
    return { mode: 'api_key', token: apiKey };
  }
  const oidcToken = source.VERCEL_OIDC_TOKEN?.trim();
  if (oidcToken) {
    return { mode: 'oidc', token: oidcToken };
  }
  throw new Error(
    'Missing or invalid environment configuration: AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN is required. ' +
      'Create an API key in Vercel Dashboard -> AI Gateway -> API Keys, or enable Vercel OIDC.'
  );
}

export function getPostgresUrl(source: NodeJS.ProcessEnv = process.env): string {
  return parse(PostgresSchema, source).POSTGRES_URL;
}

/**
 * Validates all required runtime variables for Live AI execution (`POSTGRES_URL` plus
 * either `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`, and auth secrets in production/staging).
 */
export function validateLiveEnv(source: NodeJS.ProcessEnv = process.env): LiveEnvConfig {
  const gatewayAuth = assertAiGatewayConfigured(source);
  const postgresUrl = getPostgresUrl(source);
  if (source.NODE_ENV && source.NODE_ENV !== 'development' && source.NODE_ENV !== 'test') {
    parse(AuthSchema, source);
  }
  return {
    postgresUrl,
    aiGatewayAuth: gatewayAuth.mode,
    ...(gatewayAuth.mode === 'api_key'
      ? { aiGatewayApiKey: gatewayAuth.token }
      : { vercelOidcToken: gatewayAuth.token }),
  };
}

/**
 * Auth gate secrets. Callers only need them outside development, where the gate
 * is enforced; in development the gate is bypassed and this is not called.
 */
export function getAuthEnv(source: NodeJS.ProcessEnv = process.env): {
  appPassword: string;
  authSecret: string;
} {
  const env = parse(AuthSchema, source);
  return { appPassword: env.APP_PASSWORD, authSecret: env.AUTH_SECRET };
}
