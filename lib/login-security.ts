import { createHash, timingSafeEqual } from 'node:crypto';

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

export function resolveClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwardedFor) return forwardedFor;
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return '127.0.0.1';
}

export function getRecentLoginFailures(ip: string, now: number): number[] {
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

export function recordLoginFailure(ip: string, now: number): void {
  const recent = getRecentLoginFailures(ip, now);
  if (!failedAttemptsByIp.has(ip) && failedAttemptsByIp.size >= 5000) {
    const oldestKey = failedAttemptsByIp.keys().next().value;
    if (oldestKey !== undefined) {
      failedAttemptsByIp.delete(oldestKey);
    }
  }
  recent.push(now);
  failedAttemptsByIp.set(ip, recent);
}

export function clearLoginFailures(ip: string): void {
  failedAttemptsByIp.delete(ip);
}
