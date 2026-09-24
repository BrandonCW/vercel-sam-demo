import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, verifySessionToken, shouldBypassAuth } from './lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass static assets & images
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Bypass in local development or if APP_PASSWORD is unset
  if (shouldBypassAuth()) {
    return NextResponse.next();
  }

  // 3. Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
    return NextResponse.next();
  }

  // 4. Verify session cookie
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
  const isValid = sessionCookie ? await verifySessionToken(sessionCookie) : false;

  if (isValid) {
    return NextResponse.next();
  }

  // 5. Handle unauthorized: API routes return 401 JSON, page routes redirect to /login
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
