import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { routeAuth } from 'eve/channels/auth';
import { EVE_CHANNEL_AUTH } from '@/lib/eve-auth';
import { createSessionToken, COOKIE_NAME } from '@/lib/auth';

const saved = { ...process.env };

function sessionRequest(cookie?: string): Request {
  return new Request('https://deal-qual.example.com/eve/v1/session', {
    method: 'POST',
    headers: cookie ? { cookie } : {},
  });
}

describe('eve channel auth (non-dev environment)', () => {
  beforeEach(() => {
    process.env = { ...saved, NODE_ENV: 'production', APP_PASSWORD: 'pw-test', AUTH_SECRET: 'secret-test' };
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('rejects an anonymous POST /eve/v1/session with 401', async () => {
    const result = await routeAuth(sessionRequest(), EVE_CHANNEL_AUTH);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it('rejects a forged deal_qual_session cookie with 401', async () => {
    const result = await routeAuth(sessionRequest(`${COOKIE_NAME}=123.deadbeef`), EVE_CHANNEL_AUTH);
    expect((result as Response).status).toBe(401);
  });

  it('admits a caller holding a valid deal_qual_session cookie', async () => {
    const token = await createSessionToken('pw-test', 'secret-test');
    const result = await routeAuth(sessionRequest(`other=1; ${COOKIE_NAME}=${token}`), EVE_CHANNEL_AUTH);
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({ authenticator: 'deal_qual_session', principalType: 'user' });
  });
});
