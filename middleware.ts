import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Paths that stay public without a Berkeley sign-in:
 * - /login and /auth/* (the sign-in flow itself)
 * - Static files served from public/ (course ICS files, academic
 *   calendar ICS files, parking ICS files, icons, images). These are
 *   fetched by calendar apps and other clients that cannot sign in,
 *   so gating them would break existing subscriptions.
 * - Any path with a file extension (static assets).
 * Everything else (the dashboard, /admin/*, /resources/*) requires a
 * signed-in @berkeley.edu session. API routes are excluded by the
 * matcher below and stay public: the Vercel cron jobs and the
 * calendar/newsletter APIs must work without a browser session.
 */
const PUBLIC_PATHS = ['/login', '/auth'];
const PUBLIC_PREFIXES = [
  '/course_ICS_files',
  '/parking-events',
  '/haas_academic_calendar',
];

function isPublicPath(pathname: string): boolean {
  if (
    PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    )
  ) {
    return true;
  }
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return true;
  }
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return true;
  }
  return false;
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  // Force HTTPS in browsers (HSTS)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  response.headers.set(
    'Referrer-Policy',
    'strict-origin-when-cross-origin'
  );

  return response;
}

export async function middleware(request: NextRequest) {
  // Check if the request is not using HTTPS and not on localhost
  const isLocalhost =
    request.nextUrl.hostname === 'localhost' ||
    request.nextUrl.hostname === '127.0.0.1' ||
    request.nextUrl.hostname.startsWith('192.168.') ||
    request.nextUrl.hostname.endsWith('.local');

  // Only enforce HTTPS in production (not on localhost during development)
  if (!isLocalhost && request.nextUrl.protocol === 'http:') {
    // Redirect to HTTPS version
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';

    return NextResponse.redirect(httpsUrl, 301); // 301 = Permanent redirect
  }

  // Refresh the Supabase session and enforce the Berkeley domain
  // server-side. updateSession redirects non-Berkeley sessions to
  // /auth/signout, which destroys the session. Gating uses the
  // validated user it returns, not cookie presence: a stale or
  // forged cookie is not a session, only a token Supabase validates
  // counts.
  const { response: sessionResponse, user } =
    await updateSession(request);
  if (sessionResponse.headers.get('location')) {
    return applySecurityHeaders(sessionResponse);
  }

  // Gate pages: unauthenticated visitors go to /login, remembering
  // where they were headed.
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(sessionResponse);
}

export const config = {
  // Apply middleware to all routes except API routes, Next.js
  // internals, and favicon.ico. API routes stay public (cron jobs,
  // calendar and newsletter APIs must work without a browser session).
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
