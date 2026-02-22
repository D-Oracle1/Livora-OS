import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * ADMIN_ONLY mode: when NEXT_PUBLIC_ADMIN_ONLY=true this deployment only serves
 * the super-admin dashboard. All other dashboard routes are blocked.
 *
 * TENANT mode (default): super-admin routes are blocked so tenants cannot
 * accidentally reach the platform admin panel.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminOnly = process.env.NEXT_PUBLIC_ADMIN_ONLY === 'true';

  // Always allow Next.js internals, static assets, and public API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (isAdminOnly) {
    // ── Admin-only deployment ──
    // Root path: redirect to the platform landing/pricing page
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/platform', request.url));
    }
    // Allow super-admin dashboard, auth pages, and the public platform landing
    const allowed =
      pathname.startsWith('/dashboard/super-admin') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/platform');

    if (!allowed) {
      return NextResponse.redirect(new URL('/platform', request.url));
    }
  } else {
    // ── Tenant deployment ──
    // Block super-admin routes so tenants can't stumble into the platform panel
    if (pathname.startsWith('/dashboard/super-admin')) {
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
