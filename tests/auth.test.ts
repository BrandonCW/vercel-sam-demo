// @vitest-environment happy-dom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  shouldBypassAuth,
  sanitizeRedirectPath,
  verifySameOrigin,
  COOKIE_NAME,
} from '@/lib/auth';
import {
  POST as loginPost,
  constantTimePasswordEquals,
  resetLoginRateLimiter,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
} from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { POST as crmResetPost } from '@/app/api/crm/reset/route';
import { GET as crmOpportunityGet } from '@/app/api/crm/opportunity/route';

/**
 * In happy-dom, `new Request(..., { headers })` filters browser-forbidden request headers
 * (`origin`, `host`), whereas Node's incoming HTTP server populates them on `request.headers`.
 */
function serverRequest(url: string, init?: RequestInit & { rawHeaders?: Record<string, string> }): Request {
  const { rawHeaders, ...rest } = init || {};
  const req = new Request(url, rest);
  if (rawHeaders) {
    for (const [k, v] of Object.entries(rawHeaders)) {
      req.headers.set(k, v);
    }
  }
  return req;
}

const pushMock = vi.fn();
const refreshMock = vi.fn();
let mockedRedirectParam: string | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'redirect' ? mockedRedirectParam : null),
  }),
}));

describe('Authentication Gate, Hardened Routes & Login Desk OS', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetLoginRateLimiter();
    pushMock.mockReset();
    refreshMock.mockReset();
    mockedRedirectParam = null;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('uses standard cookie name deal_qual_session', () => {
    expect(COOKIE_NAME).toBe('deal_qual_session');
  });

  it('generates a valid timestamp.signature token and verifies it with matching password', async () => {
    const password = 'test-secret-password-123';
    const secret = 'custom-hmac-secret-abc';

    const token = await createSessionToken(password, secret);
    expect(token).toContain('.');
    expect(token.split('.').length).toBe(2);

    const isValid = await verifySessionToken(token, password, secret);
    expect(isValid).toBe(true);
  });

  it('rejects tokens signed with wrong password, tampered signatures, or expired timestamps', async () => {
    const password = 'correct-password';
    const secret = 'shared-secret';

    const token = await createSessionToken(password, secret);
    expect(await verifySessionToken(token, 'wrong-password', secret)).toBe(false);

    const [ts, sig] = token.split('.');
    const tampered = `${ts}.${sig.slice(0, -4)}dead`;
    expect(await verifySessionToken(tampered, password, secret)).toBe(false);
    expect(await verifySessionToken('malformed-token-without-dot', password, secret)).toBe(false);
    expect(await verifySessionToken('', password, secret)).toBe(false);

    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const expiredToken = await createSessionToken(password, secret, eightDaysAgo);
    expect(await verifySessionToken(expiredToken, password, secret)).toBe(false);
  });

  it('correctly reports shouldBypassAuth in development vs production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    process.env.APP_PASSWORD = 'super-secret-password';
    expect(shouldBypassAuth()).toBe(true);

    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.APP_PASSWORD;
    expect(shouldBypassAuth()).toBe(false);
  });

  it('throws instead of signing with a default secret when AUTH_SECRET and APP_PASSWORD are unset', async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.APP_PASSWORD;
    await expect(createSessionToken('pw')).rejects.toThrow(/AUTH_SECRET|APP_PASSWORD/);
  });

  describe('Open Redirect Sanitization (CWE-601)', () => {
    it('permits safe single-slash relative paths and blocks protocol-relative, backslash, and external URLs', () => {
      expect(sanitizeRedirectPath(null)).toBe('/');
      expect(sanitizeRedirectPath(undefined)).toBe('/');
      expect(sanitizeRedirectPath('')).toBe('/');
      expect(sanitizeRedirectPath('/')).toBe('/');
      expect(sanitizeRedirectPath('/workbench?scenario=acme')).toBe('/workbench?scenario=acme');

      expect(sanitizeRedirectPath('//evil.example')).toBe('/');
      expect(sanitizeRedirectPath('///evil.example')).toBe('/');
      expect(sanitizeRedirectPath('/\\evil.example')).toBe('/');
      expect(sanitizeRedirectPath('https://evil.example/phish')).toBe('/');
      expect(sanitizeRedirectPath('javascript:alert(1)')).toBe('/');
      expect(sanitizeRedirectPath('/valid\r\nLocation: https://evil.example')).toBe('/');
    });
  });

  describe('Same-Origin CSRF Verification', () => {
    it('allows requests with matching Origin or omitted Origin, and rejects cross-origin or null Origin', () => {
      const sameOriginReq = serverRequest('https://deal.example.com/api/auth/login', {
        method: 'POST',
        rawHeaders: { origin: 'https://deal.example.com', host: 'deal.example.com' },
      });
      expect(verifySameOrigin(sameOriginReq)).toBe(true);

      const noOriginReq = serverRequest('https://deal.example.com/api/auth/login', {
        method: 'POST',
      });
      expect(verifySameOrigin(noOriginReq)).toBe(true);

      const crossOriginReq = serverRequest('https://deal.example.com/api/auth/login', {
        method: 'POST',
        rawHeaders: { origin: 'https://evil.example', host: 'deal.example.com' },
      });
      expect(verifySameOrigin(crossOriginReq)).toBe(false);

      const nullOriginReq = serverRequest('https://deal.example.com/api/auth/login', {
        method: 'POST',
        rawHeaders: { origin: 'null', host: 'deal.example.com' },
      });
      expect(verifySameOrigin(nullOriginReq)).toBe(false);
    });
  });

  describe('POST /api/auth/login Hardening', () => {
    beforeEach(() => {
      process.env.APP_PASSWORD = 'correct-horse-battery-staple';
      process.env.AUTH_SECRET = 'super-secret-hmac-key-12345';
    });

    it('compares passwords in constant time via SHA-256 + timingSafeEqual', () => {
      expect(constantTimePasswordEquals('alpha', 'alpha')).toBe(true);
      expect(constantTimePasswordEquals('alpha', 'alpha-extended')).toBe(false);
      expect(constantTimePasswordEquals('', 'alpha')).toBe(false);
    });

    it('returns 400 Invalid JSON request body instead of leaking a 500 V8 SyntaxError on malformed JSON', async () => {
      const res = await loginPost(
        new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid',
        })
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: 'Invalid JSON request body' });
    });

    it('fails with 500 without leaking raw env error.message when APP_PASSWORD / AUTH_SECRET are unset', async () => {
      delete process.env.APP_PASSWORD;
      delete process.env.AUTH_SECRET;
      const res = await loginPost(
        new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'anything' }),
        })
      );
      expect(res.status).toBe(500);
      expect(res.headers.get('set-cookie')).toBeNull();
      const data = await res.json();
      expect(data.error).toBe('Authentication service unavailable');
      expect(String(data.error)).not.toMatch(/SyntaxError|AUTH_SECRET|openssl/i);
    });

    it('enforces sliding-window rate limiting per IP after 10 failed attempts', async () => {
      for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; i++) {
        const failRes = await loginPost(
          new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-forwarded-for': '203.0.113.42',
            },
            body: JSON.stringify({ password: `wrong-${i}` }),
          })
        );
        expect(failRes.status).toBe(401);
      }

      const throttledRes = await loginPost(
        new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.42',
          },
          body: JSON.stringify({ password: 'correct-horse-battery-staple' }),
        })
      );
      expect(throttledRes.status).toBe(429);
      expect(throttledRes.headers.get('retry-after')).toBeTruthy();

      // Independent IP is unaffected
      const otherIpRes = await loginPost(
        new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '198.51.100.7',
          },
          body: JSON.stringify({ password: 'correct-horse-battery-staple' }),
        })
      );
      expect(otherIpRes.status).toBe(200);
      expect(otherIpRes.headers.get('set-cookie')).toContain(`${COOKIE_NAME}=`);
    });

    it('rejects cross-origin POST /api/auth/login with 403', async () => {
      const res = await loginPost(
        serverRequest('https://deal.example.com/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          rawHeaders: {
            origin: 'https://attacker.example',
            host: 'deal.example.com',
          },
          body: JSON.stringify({ password: 'correct-horse-battery-staple' }),
        })
      );
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/auth/logout & CRM Route Hardening', () => {
    it('clears expired deal_qual_session cookie with 200 and Max-Age=0, and rejects cross-origin POST', async () => {
      const res = await logoutPost(
        serverRequest('http://localhost/api/auth/logout', {
          method: 'POST',
          rawHeaders: { cookie: `${COOKIE_NAME}=expired.sig` },
        })
      );
      expect(res.status).toBe(200);
      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie).toContain(`${COOKIE_NAME}=`);
      expect(setCookie).toMatch(/Max-Age=0/i);

      const csrfRes = await logoutPost(
        serverRequest('https://deal.example.com/api/auth/logout', {
          method: 'POST',
          rawHeaders: {
            origin: 'https://evil.example',
            host: 'deal.example.com',
          },
        })
      );
      expect(csrfRes.status).toBe(403);
    });

    it('blocks { full: true } on POST /api/crm/reset in production unless ALLOW_FULL_CRM_RESET=true', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.ALLOW_FULL_CRM_RESET;

      const blockedRes = await crmResetPost(
        serverRequest('https://deal.example.com/api/crm/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          rawHeaders: {
            origin: 'https://deal.example.com',
            host: 'deal.example.com',
          },
          body: JSON.stringify({ full: true }),
        })
      );
      expect(blockedRes.status).toBe(403);

      const csrfRes = await crmResetPost(
        serverRequest('https://deal.example.com/api/crm/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          rawHeaders: {
            origin: 'https://evil.example',
            host: 'deal.example.com',
          },
          body: JSON.stringify({ scenarioId: 'scenario_acme_netlify' }),
        })
      );
      expect(csrfRes.status).toBe(403);
    });

    it('falls back to DEMO_SCENARIOS on GET /api/crm/opportunity when POSTGRES_URL is unconfigured', async () => {
      delete process.env.POSTGRES_URL;

      const res = await crmOpportunityGet(
        new Request('http://localhost/api/crm/opportunity?scenarioId=scenario_globex_amplify')
      );
      expect(res.status).toBe(200);
      const opp = await res.json();
      expect(opp.id).toBe('opp_globex_fintech_002');
      expect(opp.amount).toBe(240000);

      const byIdRes = await crmOpportunityGet(
        new Request('http://localhost/api/crm/opportunity?id=opp_soylent_retail_003')
      );
      expect(byIdRes.status).toBe(200);
      expect((await byIdRes.json()).name).toContain('Soylent Retail');

      const missingRes = await crmOpportunityGet(
        new Request('http://localhost/api/crm/opportunity?scenarioId=nonexistent_scenario')
      );
      expect(missingRes.status).toBe(404);
    });
  });

  describe('/login Warm Stone Desk OS & SSR Form Markup', () => {
    it('SSR-renders real form HTML without dark-mode #09090b, System 2 jargon, NODE_ENV text, or autoFocus', async () => {
      const { default: LoginPage } = await import('@/app/login/page');
      const html = renderToString(React.createElement(LoginPage));

      expect(html).toContain('<form');
      expect(html).toContain('type="password"');
      expect(html).toContain('Enter Workbench');
      expect(html).toContain('#F8F8F6');
      expect(html).toContain('#0F52BA');
      expect(html).not.toContain('#09090b');
      expect(html).not.toContain('#0070f3');
      expect(html).not.toContain('shadow-2xl');
      expect(html).not.toContain('System 2');
      expect(html).not.toContain('NODE_ENV');
      expect(html).not.toContain('autofocus');
    });

    it('sanitizes malicious ?redirect=//evil.example to "/" upon successful login', async () => {
      mockedRedirectParam = '//evil.example';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const { default: LoginPage } = await import('@/app/login/page');
      render(React.createElement(LoginPage));

      const pwInput = screen.getByLabelText(/Access Password/i);
      fireEvent.change(pwInput, { target: { value: 'valid-pw' } });
      fireEvent.click(screen.getByRole('button', { name: /Enter Workbench/i }));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/');
      });
    });
  });
});
