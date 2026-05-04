import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Three deployment contexts:
 *
 * ADMIN mode  (NEXT_PUBLIC_ADMIN_ONLY=true — dedicated admin project)
 *   • / → /platform
 *   • only /dashboard/*, /auth/*, /platform/* allowed
 *
 * PLATFORM mode (default — livoraos.vercel.app, localhost, *.vercel.app)
 *   • no route restrictions — all dashboards accessible
 *
 * TENANT mode (custom domain, e.g. tenant.com)
 *   • /dashboard/super-admin → blocked (redirect to /)
 *   • /platform → blocked (redirect to /)
 *   • everything else → allowed
 */

function isTenantCustomDomain(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  if (hostname.endsWith('.vercel.app')) return false;
  if (hostname.endsWith('.railway.app')) return false;
  if (hostname.endsWith('.render.com')) return false;
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
  if (platformDomain && hostname === platformDomain) return false;
  return true;
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

  const isAdminMode = process.env.NEXT_PUBLIC_ADMIN_ONLY === 'true';

  if (isAdminMode) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/platform', request.url));
    }
    const allowed =
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/platform');
    if (!allowed) {
      return NextResponse.redirect(new URL('/platform', request.url));
    }
  } else if (isTenantCustomDomain(hostname)) {
    // Custom tenant domain: block super-admin and platform routes
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
