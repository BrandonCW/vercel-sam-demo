import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  shouldBypassAuth,
  COOKIE_NAME,
} from '@/lib/auth';

describe('Authentication Gate & Web Crypto Session Verification', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses standard cookie name deal_qual_session', () => {
    expect(COOKIE_NAME).toBe('deal_qual_session');
  });

  it('generates a valid timestamp.signature token and verifies it with matching password', async () => {
    const password = 'test-secret-password-123';
    const secret = 'custom-hmac-secret-abc';

    const token = await createSessionToken(password, secret);
    expect(token).toContain('.');
    const parts = token.split('.');
    expect(parts.length).toBe(2);

    // Verify returns true for identical password and secret
    const isValid = await verifySessionToken(token, password, secret);
    expect(isValid).toBe(true);
  });

  it('rejects tokens signed with wrong password', async () => {
    const password = 'correct-password';
    const secret = 'shared-secret';

    const token = await createSessionToken(password, secret);
    const isValid = await verifySessionToken(token, 'wrong-password', secret);
    expect(isValid).toBe(false);
  });

  it('rejects tampered signatures or malformed tokens', async () => {
    const password = 'correct-password';
    const secret = 'shared-secret';

    const token = await createSessionToken(password, secret);
    const [ts, sig] = token.split('.');
    const tampered = `${ts}.${sig.slice(0, -4)}dead`;

    expect(await verifySessionToken(tampered, password, secret)).toBe(false);
    expect(await verifySessionToken('malformed-token-without-dot', password, secret)).toBe(false);
    expect(await verifySessionToken('', password, secret)).toBe(false);
  });

  it('rejects expired session tokens', async () => {
    const password = 'test-password';
    const secret = 'shared-secret';
    // 8 days ago
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const expiredToken = await createSessionToken(password, secret, eightDaysAgo);

    const isValid = await verifySessionToken(expiredToken, password, secret);
    expect(isValid).toBe(false);
  });

  it('correctly reports shouldBypassAuth in development vs production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    process.env.APP_PASSWORD = 'super-secret-password';
    expect(shouldBypassAuth()).toBe(true);

    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.APP_PASSWORD;
    expect(shouldBypassAuth()).toBe(false);

    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.APP_PASSWORD = 'super-secret-password';
    expect(shouldBypassAuth()).toBe(false);
  });

  it('throws instead of signing with a default secret when AUTH_SECRET and APP_PASSWORD are unset', async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.APP_PASSWORD;
    await expect(createSessionToken('pw')).rejects.toThrow(/AUTH_SECRET|APP_PASSWORD/);
  });

  it('login route fails loudly instead of issuing a bypass session when APP_PASSWORD is unset', async () => {
    delete process.env.APP_PASSWORD;
    delete process.env.AUTH_SECRET;
    const { POST } = await import('@/app/api/auth/login/route');
    const res = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'anything' }),
      })
    );
    expect(res.status).toBe(500);
    expect(res.headers.get('set-cookie')).toBeNull();
    const data = await res.json();
    expect(String(data.error)).toMatch(/APP_PASSWORD|AUTH_SECRET/);
  });
});
