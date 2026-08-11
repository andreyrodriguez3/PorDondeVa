import { NextRequest, NextResponse } from 'next/server';

const ADMIN_HOST = process.env.ADMIN_HOST ?? 'admin.tubus.localhost';

/**
 * D5 — the admin dashboard lives on exactly one fixed hostname; company and custom
 * domains serve the passenger surface only, so admin session state never touches a
 * hostname a customer controls.
 */
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0];
  const { pathname } = request.nextUrl;
  const isAdminHost = hostname === ADMIN_HOST;

  if (isAdminHost) {
    if (pathname === '/' || (!pathname.startsWith('/admin') && !pathname.startsWith('/api'))) {
      return NextResponse.rewrite(
        new URL(`/admin${pathname === '/' ? '' : pathname}`, request.url),
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
