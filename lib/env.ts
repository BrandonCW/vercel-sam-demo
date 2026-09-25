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

const isBareOrigin = (raw: string) => {
  if (!URL.canParse(raw)) return false;
  const url = new URL(raw);
  return (
    /^https?:$/.test(url.protocol) &&
    !url.username &&
    !url.password &&
    (url.pathname === '/' || url.pathname === '') &&
    !url.search &&
    !url.hash
  );
};

const EveAgentOriginSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isBareOrigin, 'EVE_AGENT_ORIGIN must be a bare http(s) origin with no path, query or hash.');

/** Vercel's system VERCEL_URL: the deployment host, without scheme (e.g. my-app-abc123.vercel.app). */
const VercelUrlSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?$/i, 'VERCEL_URL must be a bare deployment host.');

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

/**
 * Origin the server-side eve client calls: EVE_AGENT_ORIGIN when set, otherwise
 * the platform-provided VERCEL_URL (this deployment's own URL, so preview
 * deployments reach their own agent) over https. Never taken from the request's
 * Host header, so the forwarded session cookie cannot be sent off-site.
 */
export function getEveAgentOrigin(): string {
  const configured = process.env.EVE_AGENT_ORIGIN;
  if (configured !== undefined && configured.trim() !== '') {
    const parsed = EveAgentOriginSchema.safeParse(configured);
    if (!parsed.success) {
      throw new Error(`Missing or invalid environment configuration: ${parsed.error.issues[0].message}`);
    }
    return new URL(parsed.data).origin;
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl !== undefined && vercelUrl.trim() !== '') {
    const parsed = VercelUrlSchema.safeParse(vercelUrl);
    if (!parsed.success) {
      throw new Error(`Missing or invalid environment configuration: ${parsed.error.issues[0].message}`);
    }
    return new URL(`https://${parsed.data}`).origin;
  }
  throw new Error(
    'Missing or invalid environment configuration: EVE_AGENT_ORIGIN is required when VERCEL_URL is not set. ' +
      'Set it to the origin serving /eve/v1/* (e.g. http://localhost:3000 locally); on Vercel the platform VERCEL_URL is used.'
  );
}
