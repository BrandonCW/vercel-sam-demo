import { NextResponse } from 'next/server';
import { COOKIE_NAME, verifySameOrigin } from '@/lib/auth';

export async function POST(request?: Request) {
  if (request && !verifySameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin request forbidden' }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
