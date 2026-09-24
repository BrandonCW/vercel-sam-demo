import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAiGatewayApiKey, getPostgresUrl, getAuthEnv, getEveAgentOrigin } from '@/lib/env';

const KEYS = ['AI_GATEWAY_API_KEY', 'POSTGRES_URL', 'APP_PASSWORD', 'AUTH_SECRET', 'NODE_ENV', 'EVE_AGENT_ORIGIN'] as const;

describe('Required environment configuration (lib/env)', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) saved[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete (process.env as any)[k];
      else (process.env as any)[k] = saved[k];
    }
  });

  it('throws a descriptive error when EVE_AGENT_ORIGIN is unset', () => {
    delete process.env.EVE_AGENT_ORIGIN;
    expect(() => getEveAgentOrigin()).toThrow(/EVE_AGENT_ORIGIN/);
  });

  it('rejects an EVE_AGENT_ORIGIN that is not a bare http(s) origin', () => {
    for (const bad of ['agent.example.com', 'ftp://agent.example.com', 'https://agent.example.com/eve/v1']) {
      process.env.EVE_AGENT_ORIGIN = bad;
      expect(() => getEveAgentOrigin()).toThrow(/EVE_AGENT_ORIGIN/);
    }
  });

  it('returns the configured eve origin', () => {
    process.env.EVE_AGENT_ORIGIN = 'https://deal-qual.example.com/';
    expect(getEveAgentOrigin()).toBe('https://deal-qual.example.com');
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

  it('throws a descriptive error when POSTGRES_URL is unset', () => {
    delete process.env.POSTGRES_URL;
    expect(() => getPostgresUrl()).toThrow(/POSTGRES_URL/);
  });

  it('rejects a POSTGRES_URL that is not a postgres connection string', () => {
    process.env.POSTGRES_URL = 'not-a-url';
    expect(() => getPostgresUrl()).toThrow(/POSTGRES_URL/);
  });

  it('requires APP_PASSWORD and AUTH_SECRET outside development', () => {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.APP_PASSWORD;
    delete process.env.AUTH_SECRET;
    expect(() => getAuthEnv()).toThrow(/APP_PASSWORD|AUTH_SECRET/);
  });

  it('returns auth vars outside development when both are set', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.APP_PASSWORD = 'pw';
    process.env.AUTH_SECRET = 'secret';
    expect(getAuthEnv()).toEqual({ appPassword: 'pw', authSecret: 'secret' });
  });
});
