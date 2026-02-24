import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Two deployment modes:
 *
 * ADMIN mode  (NEXT_PUBLIC_ADMIN_ONLY=true  — rms-admin-dashboard project)
 *   • / → /platform  (Vicson Estate Suite landing page)
 *   • /dashboard/super-admin, /auth/*, /platform → allowed
 *   • everything else → /platform
 *
 * TENANT mode (default — frontend project, tenant custom domains)
 *   • /dashboard/super-admin → blocked (redirect to /)
 *   • /platform → blocked (redirect to /)
 *   • everything else → allowed
 */

function isMasterDomain(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
  if (platformDomain && hostname === platformDomain) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();

  // Always pass through Next.js internals, static assets, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Admin mode: explicit env flag (rms-admin-dashboard project) OR master hostname
  const isAdminMode =
    process.env.NEXT_PUBLIC_ADMIN_ONLY === 'true' || isMasterDomain(hostname);

  if (isAdminMode) {
    // Root → platform landing page (Vicson Estate Suite)
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/platform', request.url));
    }
    // Allow admin dashboard, auth pages, and the platform landing
    const allowed =
      pathname.startsWith('/dashboard/super-admin') ||
      pathname.startsWith('/dashboard/admin') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/platform');
    if (!allowed) {
      return NextResponse.redirect(new URL('/platform', request.url));
    }
  } else {
    // Tenant mode: block super-admin and platform routes
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
