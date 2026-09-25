import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { createSessionToken, COOKIE_NAME } from '@/lib/auth';

function createRequest(
  url: string,
  options?: {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  }
): NextRequest {
  const req = new NextRequest(url, {
    headers: options?.headers,
  });

  if (options?.cookies) {
    for (const [key, value] of Object.entries(options.cookies)) {
      req.cookies.set(key, value);
    }
  }

  return req;
}

describe('Middleware Security Gate (tests/middleware.test.ts)', () => {
  const originalEnv = { ...process.env };
  const TEST_PASSWORD = 'test-secure-app-password';
  const TEST_SECRET = 'test-hmac-auth-secret';

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.APP_PASSWORD = TEST_PASSWORD;
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Local Development Mode Bypass', () => {
    it('bypasses authentication gate when NODE_ENV === "development"', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      // Protected page route without session cookie
      const pageReq = createRequest('http://localhost:3000/');
      const pageRes = await middleware(pageReq);
      expect(pageRes.status).toBe(200);
      expect(pageRes.headers.get('location')).toBeNull();

      // Protected API route without session cookie
      const apiReq = createRequest('http://localhost:3000/api/crm/reset');
      const apiRes = await middleware(apiReq);
      expect(apiRes.status).toBe(200);
      expect(apiRes.headers.get('location')).toBeNull();
    });
  });

  describe('Staging Environment Enforcement', () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'staging';
    });

    it('redirects unauthenticated page request to /login with redirect parameter', async () => {
      const req = createRequest('http://localhost:3000/workbench');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login?redirect=%2Fworkbench');
    });

    it('returns 401 JSON, not a login redirect, for unauthenticated eve agent requests (useEveAgent fetches)', async () => {
      const res = await middleware(createRequest('http://localhost:3000/eve/v1/session'));
      expect(res.status).toBe(401);
      expect(res.headers.get('location')).toBeNull();
    });

    it('returns 401 JSON for unauthenticated API requests', async () => {
      const req = createRequest('http://localhost:3000/api/crm/reset');
      const res = await middleware(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: 'Authentication required' });
    });
  });

  describe('Production Environment Enforcement', () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    });

    it('redirects unauthenticated root page request to /login', async () => {
      const req = createRequest('http://localhost:3000/');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login?redirect=%2F');
    });

    it('returns 401 for unauthenticated CRM reset API requests', async () => {
      const req = createRequest('http://localhost:3000/api/crm/reset');
      const res = await middleware(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ error: 'Authentication required' });
    });

    it('allows static assets and _next resources through without authentication', async () => {
      const staticReq = createRequest('http://localhost:3000/_next/static/chunks/main.js');
      const staticRes = await middleware(staticReq);
      expect(staticRes.status).toBe(200);

      const faviconReq = createRequest('http://localhost:3000/favicon.ico');
      const faviconRes = await middleware(faviconReq);
      expect(faviconRes.status).toBe(200);

      const staticFolderReq = createRequest('http://localhost:3000/static/images/logo.png');
      const staticFolderRes = await middleware(staticFolderReq);
      expect(staticFolderRes.status).toBe(200);
    });

    it('allows public paths /login and /api/auth/login through without authentication', async () => {
      const loginPageReq = createRequest('http://localhost:3000/login');
      const loginPageRes = await middleware(loginPageReq);
      expect(loginPageRes.status).toBe(200);

      const loginApiReq = createRequest('http://localhost:3000/api/auth/login');
      const loginApiRes = await middleware(loginApiReq);
      expect(loginApiRes.status).toBe(200);
    });

    it('permits authenticated page and API requests with valid session token', async () => {
      const validToken = await createSessionToken(TEST_PASSWORD, TEST_SECRET);

      const pageReq = createRequest('http://localhost:3000/', {
        cookies: { [COOKIE_NAME]: validToken },
      });
      const pageRes = await middleware(pageReq);
      expect(pageRes.status).toBe(200);
      expect(pageRes.headers.get('location')).toBeNull();

      const apiReq = createRequest('http://localhost:3000/api/crm/reset', {
        cookies: { [COOKIE_NAME]: validToken },
      });
      const apiRes = await middleware(apiReq);
      expect(apiRes.status).toBe(200);
      expect(apiRes.headers.get('location')).toBeNull();
    });

    it('rejects tampered or invalid session tokens and redirects pages to /login', async () => {
      const invalidToken = '123456789.bad_signature_hash_value';

      const pageReq = createRequest('http://localhost:3000/opportunities', {
        cookies: { [COOKIE_NAME]: invalidToken },
      });
      const pageRes = await middleware(pageReq);
      expect(pageRes.status).toBe(307);
      expect(pageRes.headers.get('location')).toContain('/login?redirect=%2Fopportunities');

      const apiReq = createRequest('http://localhost:3000/eve/v1/session', {
        cookies: { [COOKIE_NAME]: invalidToken },
      });
      const apiRes = await middleware(apiReq);
      expect(apiRes.status).toBe(401);
      expect(await apiRes.json()).toEqual({ error: 'Authentication required' });
    });
  });
});
