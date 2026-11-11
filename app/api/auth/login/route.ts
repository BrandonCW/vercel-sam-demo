import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthEnv } from '@/lib/env';
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySameOrigin,
} from '@/lib/auth';

export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;

const failedAttemptsByIp = new Map<string, number[]>();

export function resetLoginRateLimiter(): void {
  failedAttemptsByIp.clear();
}

export function constantTimePasswordEquals(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function resolveClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwardedFor) return forwardedFor;
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return '127.0.0.1';
}

function getRecentFailures(ip: string, now: number): number[] {
  const existing = failedAttemptsByIp.get(ip);
  if (!existing) return [];
  const recent = existing.filter((ts) => now - ts < LOGIN_RATE_LIMIT_WINDOW_MS);
  if (recent.length === 0) {
    failedAttemptsByIp.delete(ip);
  } else if (recent.length !== existing.length) {
    failedAttemptsByIp.set(ip, recent);
  }
  return recent;
}

function recordFailure(ip: string, now: number): void {
  const recent = getRecentFailures(ip, now);
  if (!failedAttemptsByIp.has(ip) && failedAttemptsByIp.size >= 5000) {
    const oldestKey = failedAttemptsByIp.keys().next().value;
    if (oldestKey !== undefined) {
      failedAttemptsByIp.delete(oldestKey);
    }
  }
  recent.push(now);
  failedAttemptsByIp.set(ip, recent);
}

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
  const recentFailures = getRecentFailures(clientIp, now);
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
      recordFailure(clientIp, now);
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    failedAttemptsByIp.delete(clientIp);
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
