import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { routeAuth } from 'eve/channels/auth';
import * as turns from '@/lib/assessment-turns';
import { assessTurnMessage, saAnswerText } from '@/lib/assessment-turns';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';
import { EVE_CHANNEL_AUTH_WITH_CSRF } from '@/agent/channels/eve';
import { COOKIE_NAME, createSessionToken } from '@/lib/auth';

describe('Assessment Session turn contract', () => {
  it('asks the root agent for one run_assessment call with the opportunity and model', () => {
    const message = assessTurnMessage('opp_acme_corp_001', 'anthropic/claude-haiku-5.5');
    expect(message).toMatch(/call run_assessment with opportunityId opp_acme_corp_001 and model anthropic\/claude-haiku-5.5/);
    expect(message).not.toMatch(/writebackWithoutFeedback/);
  });

  it('asks for the writeback without SA feedback only when requested', () => {
    expect(assessTurnMessage('opp_globex_fintech_002', 'google/gemini-3.8-flash', { writeback: true })).toMatch(
      /writebackWithoutFeedback true/
    );
  });

  it('encodes the SA answers as the JSON text run_assessment expects, keyed so tampering is detected', async () => {
    const text = await saAnswerText({ eb: 'CFO signs' }, 'Budget approved.');
    expect(JSON.parse(text)).toEqual({
      formResponses: { eb: 'CFO signs' },
      notesDelta: 'Budget approved.',
      feedbackKey: await saFeedbackKey({ eb: 'CFO signs' }, 'Budget approved.'),
    });
    expect(JSON.parse(await saAnswerText({ eb: 'CFO signs' }))).not.toHaveProperty('notesDelta');
  });

  it('asks for no structured turn outcome: code decides pass or fail from run_assessment', () => {
    expect(Object.keys(turns).sort()).toEqual(['assessTurnMessage', 'saAnswerText']);
  });
});

describe('Eve channel CSRF Origin check (agent/channels/eve.ts)', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...savedEnv, NODE_ENV: 'production', APP_PASSWORD: 'pw-csrf', AUTH_SECRET: 'secret-csrf' };
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('rejects cross-origin POST requests with 403 even when carrying a valid session cookie', async () => {
    const token = await createSessionToken('pw-csrf', 'secret-csrf');
    const req = new Request('https://deal-desk.example.com/eve/v1/session', {
      method: 'POST',
      headers: {
        cookie: `${COOKIE_NAME}=${token}`,
        host: 'deal-desk.example.com',
        origin: 'https://evil.example.org',
      },
    });
    const res = await routeAuth(req, EVE_CHANNEL_AUTH_WITH_CSRF);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it('rejects sandboxed POST requests with Origin: null with 403', async () => {
    const token = await createSessionToken('pw-csrf', 'secret-csrf');
    const req = new Request('https://deal-desk.example.com/eve/v1/session', {
      method: 'POST',
      headers: {
        cookie: `${COOKIE_NAME}=${token}`,
        host: 'deal-desk.example.com',
        origin: 'null',
      },
    });
    const res = await routeAuth(req, EVE_CHANNEL_AUTH_WITH_CSRF);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it('admits same-origin POST requests matching Host or X-Forwarded-Host', async () => {
    const token = await createSessionToken('pw-csrf', 'secret-csrf');
    const reqHost = new Request('https://deal-desk.example.com/eve/v1/session', {
      method: 'POST',
      headers: {
        cookie: `${COOKIE_NAME}=${token}`,
        host: 'deal-desk.example.com',
        origin: 'https://deal-desk.example.com',
      },
    });
    expect(await routeAuth(reqHost, EVE_CHANNEL_AUTH_WITH_CSRF)).not.toBeInstanceOf(Response);

    const reqForwarded = new Request('http://internal.edge/eve/v1/session', {
      method: 'POST',
      headers: {
        cookie: `${COOKIE_NAME}=${token}`,
        host: 'internal.edge',
        'x-forwarded-host': 'deal-desk.example.com, proxy.internal',
        origin: 'https://deal-desk.example.com',
      },
    });
    expect(await routeAuth(reqForwarded, EVE_CHANNEL_AUTH_WITH_CSRF)).not.toBeInstanceOf(Response);
  });

  it('allows CLI and eval callers with no Origin header to authenticate normally', async () => {
    const token = await createSessionToken('pw-csrf', 'secret-csrf');
    const reqNoOrigin = new Request('https://deal-desk.example.com/eve/v1/session', {
      method: 'POST',
      headers: {
        cookie: `${COOKIE_NAME}=${token}`,
        host: 'deal-desk.example.com',
      },
    });
    const res = await routeAuth(reqNoOrigin, EVE_CHANNEL_AUTH_WITH_CSRF);
    expect(res).not.toBeInstanceOf(Response);
    expect(res).toMatchObject({ authenticator: 'deal_qual_session', principalType: 'user' });
  });
});
