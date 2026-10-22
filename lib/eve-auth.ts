import { localDev, type AuthFn } from 'eve/channels/auth';
import { COOKIE_NAME, verifySessionToken, shouldBypassAuth } from '@/lib/auth';

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** Admits callers holding a valid `deal_qual_session` cookie (the app's password gate). */
export const dealQualSessionAuth: AuthFn<Request> = async (request) => {
  if (shouldBypassAuth()) {
    return {
      attributes: {},
      authenticator: 'deal_qual_session',
      principalId: 'deal-qual-demo-user',
      principalType: 'user',
    };
  }
  const token = readCookie(request.headers.get('cookie'), COOKIE_NAME);
  if (!token) return null;
  try {
    if (!(await verifySessionToken(token))) return null;
  } catch {
    return null;
  }
  return {
    attributes: {},
    authenticator: 'deal_qual_session',
    principalId: 'deal-qual-demo-user',
    principalType: 'user',
  };
};

/** Channel auth walk: localhost during `eve dev` / `vercel dev`, then the app session cookie. Anything else gets 401. */
export const EVE_CHANNEL_AUTH: AuthFn<Request>[] = [localDev(), dealQualSessionAuth];
