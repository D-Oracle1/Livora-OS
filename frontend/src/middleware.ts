import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route requests based on whether this is the master platform domain
 * or a tenant custom domain.
 *
 * Master domain  → super-admin & platform routes allowed, root → /platform
 * Tenant domain  → super-admin & platform routes blocked, root → tenant app
 */
function isMasterDomain(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.endsWith('.vercel.app') || hostname.endsWith('.railway.app')) return true;
  const platformDomain = process.env.PLATFORM_DOMAIN;
  if (platformDomain && hostname === platformDomain) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();

  // Always allow Next.js internals, static assets, and public API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (isMasterDomain(hostname)) {
    // ── Master platform domain ──
    // Redirect bare root straight to the admin login page
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
    // Allow all routes (including /dashboard/super-admin)
    return NextResponse.next();
  } else {
    // ── Tenant custom domain ──
    // Block super-admin and platform-level routes
    if (
      pathname.startsWith('/dashboard/super-admin') ||
      pathname.startsWith('/platform')
    ) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
