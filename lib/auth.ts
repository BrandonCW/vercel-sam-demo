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

  // Constant-time comparison
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
