import { NextResponse } from 'next/server';
import { getAuthEnv } from '@/lib/env';
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySameOrigin,
} from '@/lib/auth';
import {
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  clearLoginFailures,
  constantTimePasswordEquals,
  getRecentLoginFailures,
  recordLoginFailure,
  resolveClientIp,
} from '@/lib/login-security';

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin request forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const now = Date.now();
  const clientIp = resolveClientIp(request);
  const recentFailures = getRecentLoginFailures(clientIp, now);
  if (recentFailures.length >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((recentFailures[0] + LOGIN_RATE_LIMIT_WINDOW_MS - now) / 1000)
    );
    return NextResponse.json(
      { error: 'Too many failed login attempts. Please try again shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      }
    );
  }

  try {
    const { appPassword: expectedPassword } = getAuthEnv();
    const rawPassword = (body as { password?: unknown }).password;
    const candidatePassword = typeof rawPassword === 'string' ? rawPassword : '';
    const isMatch =
      typeof rawPassword === 'string' &&
      rawPassword.length > 0 &&
      constantTimePasswordEquals(candidatePassword, expectedPassword);

    if (!isMatch) {
      recordLoginFailure(clientIp, now);
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    clearLoginFailures(clientIp);
    const token = await createSessionToken(expectedPassword);
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 500 }
    );
  }
}
