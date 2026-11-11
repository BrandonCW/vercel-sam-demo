import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAiGatewayApiKey,
  assertAiGatewayConfigured,
  validateLiveEnv,
  getPostgresUrl,
  getAuthEnv,
} from '@/lib/env';

const KEYS = [
  'AI_GATEWAY_API_KEY',
  'VERCEL_OIDC_TOKEN',
  'POSTGRES_URL',
  'APP_PASSWORD',
  'AUTH_SECRET',
  'NODE_ENV',
] as const;

describe('Required environment configuration (lib/env)', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) saved[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete (process.env as Record<string, string | undefined>)[k];
      else (process.env as Record<string, string | undefined>)[k] = saved[k];
    }
  });

  it('throws a descriptive error when AI_GATEWAY_API_KEY is unset', () => {
    delete process.env.AI_GATEWAY_API_KEY;
    expect(() => getAiGatewayApiKey()).toThrow(/AI_GATEWAY_API_KEY/);
  });

  it('throws a descriptive error when AI_GATEWAY_API_KEY is blank', () => {
    process.env.AI_GATEWAY_API_KEY = '   ';
    expect(() => getAiGatewayApiKey()).toThrow(/AI_GATEWAY_API_KEY/);
  });

  it('returns the AI Gateway key when set', () => {
    process.env.AI_GATEWAY_API_KEY = 'gw_test_value';
    expect(getAiGatewayApiKey()).toBe('gw_test_value');
  });

  it('accepts VERCEL_OIDC_TOKEN when AI_GATEWAY_API_KEY is unset in assertAiGatewayConfigured and validateLiveEnv', () => {
    delete process.env.AI_GATEWAY_API_KEY;
    process.env.VERCEL_OIDC_TOKEN = 'oidc_jwt_token_value';
    process.env.POSTGRES_URL = 'postgresql://user:pass@ep-demo.neon.tech/neondb';

    expect(assertAiGatewayConfigured()).toEqual({
      mode: 'oidc',
      token: 'oidc_jwt_token_value',
    });

    expect(validateLiveEnv()).toEqual({
      postgresUrl: 'postgresql://user:pass@ep-demo.neon.tech/neondb',
      aiGatewayAuth: 'oidc',
      vercelOidcToken: 'oidc_jwt_token_value',
    });
  });

  it('fails assertAiGatewayConfigured and validateLiveEnv when both AI_GATEWAY_API_KEY and VERCEL_OIDC_TOKEN are missing or blank', () => {
    delete process.env.AI_GATEWAY_API_KEY;
    process.env.VERCEL_OIDC_TOKEN = '   ';
    process.env.POSTGRES_URL = 'postgresql://user:pass@ep-demo.neon.tech/neondb';

    expect(() => assertAiGatewayConfigured()).toThrow(/AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN/);
    expect(() => validateLiveEnv()).toThrow(/AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN/);
  });

  it('throws a descriptive error when POSTGRES_URL is unset', () => {
    delete process.env.POSTGRES_URL;
    expect(() => getPostgresUrl()).toThrow(/POSTGRES_URL/);
  });

  it('rejects a POSTGRES_URL that is not a postgres connection string', () => {
    process.env.POSTGRES_URL = 'not-a-url';
    expect(() => getPostgresUrl()).toThrow(/POSTGRES_URL/);
  });

  it('requires APP_PASSWORD and AUTH_SECRET outside development', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.APP_PASSWORD;
    delete process.env.AUTH_SECRET;
    expect(() => getAuthEnv()).toThrow(/APP_PASSWORD|AUTH_SECRET/);

    process.env.VERCEL_OIDC_TOKEN = 'oidc_prod_token';
    process.env.POSTGRES_URL = 'postgres://user:pass@localhost:5432/db';
    expect(() => validateLiveEnv()).toThrow(/APP_PASSWORD|AUTH_SECRET/);
  });

  it('returns auth vars outside development when both are set', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.APP_PASSWORD = 'pw';
    process.env.AUTH_SECRET = 'secret';
    expect(getAuthEnv()).toEqual({ appPassword: 'pw', authSecret: 'secret' });
  });
});
