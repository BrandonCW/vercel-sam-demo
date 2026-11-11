import { getAuthEnv } from './env';

export const COOKIE_NAME = 'deal_qual_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSessionToken(
  password: string,
  secret?: string,
  timestamp: number = Date.now()
): Promise<string> {
  const secretKey = secret || getAuthEnv().authSecret;
  const message = `${timestamp}:${password}`;
  const sig = await hmacSha256(message, secretKey);
  return `${timestamp}.${sig}`;
}

export async function verifySessionToken(
  token: string,
  password?: string,
  secret?: string,
  maxAgeSeconds: number = SESSION_MAX_AGE
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [tsStr, providedSig] = parts;
  const timestamp = parseInt(tsStr, 10);
  if (isNaN(timestamp)) return false;

  // Check expiration
  const ageMs = Date.now() - timestamp;
  if (ageMs < 0 || ageMs > maxAgeSeconds * 1000) {
    return false;
  }

  const expectedPassword = password || getAuthEnv().appPassword;
  const secretKey = secret || getAuthEnv().authSecret;
  const expectedSig = await hmacSha256(`${timestamp}:${expectedPassword}`, secretKey);

  // Constant-time comparison (Web Crypto / Edge-compatible)
  if (providedSig.length !== expectedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < providedSig.length; i++) {
    mismatch |= providedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }

  return mismatch === 0;
}

export function shouldBypassAuth(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Sanitizes post-login `redirect` paths to prevent CWE-601 Open Redirects.
 * Only permits relative root paths starting with a single `/` and containing no backslashes or control characters.
 */
export function sanitizeRedirectPath(redirect: string | null | undefined): string {
  if (!redirect || typeof redirect !== 'string') {
    return '/';
  }
  const trimmed = redirect.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return '/';
  }
  return trimmed;
}

/**
 * Validates same-origin `Origin` header on state-changing `POST` endpoints when `Origin` is present.
 * Allows server-side / CLI requests that omit `Origin`.
 */
export function verifySameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }
  if (origin === 'null') {
    return false;
  }
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const hostHeader = request.headers.get('host')?.trim();
    const expectedHost = (forwardedHost || hostHeader || new URL(request.url).host).toLowerCase();
    return Boolean(originHost && expectedHost && originHost === expectedHost);
  } catch {
    return false;
  }
}
