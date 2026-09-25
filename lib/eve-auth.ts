import { localDev, type AuthFn } from 'eve/channels/auth';
import { COOKIE_NAME, verifySessionToken } from '@/lib/auth';

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
  const token = readCookie(request.headers.get('cookie'), COOKIE_NAME);
  if (!token || !(await verifySessionToken(token))) return null;
  return {
    attributes: {},
    authenticator: 'deal_qual_session',
    principalId: 'deal-qual-demo-user',
    principalType: 'user',
  };
};

/** Channel auth walk: the app session cookie, then localhost during `eve dev` / `vercel dev`. Anything else gets 401. */
export const EVE_CHANNEL_AUTH: AuthFn<Request>[] = [dealQualSessionAuth, localDev()];
