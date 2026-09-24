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

function parse<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join(' ');
    throw new Error(`Missing or invalid environment configuration: ${messages}`);
  }
  return result.data;
}

export function getAiGatewayApiKey(): string {
  return parse(AiGatewaySchema).AI_GATEWAY_API_KEY;
}

/** Throws a descriptive error unless the AI Gateway is configured. */
export function assertAiGatewayConfigured(): void {
  getAiGatewayApiKey();
}

export function getPostgresUrl(): string {
  return parse(PostgresSchema).POSTGRES_URL;
}

/**
 * Auth gate secrets. Callers only need them outside development, where the gate
 * is enforced; in development the gate is bypassed and this is not called.
 */
export function getAuthEnv(): { appPassword: string; authSecret: string } {
  const env = parse(AuthSchema);
  return { appPassword: env.APP_PASSWORD, authSecret: env.AUTH_SECRET };
}
