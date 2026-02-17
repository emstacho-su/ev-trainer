import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js middleware to protect routes that require authentication.
 * Protected routes redirect to /login if no access_token cookie is present.
 * The actual token validation happens server-side in API routes.
 */

const PROTECTED_PREFIXES = ['/stats', '/review', '/summary'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this path requires authentication
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for access token in cookies or authorization header
  const token =
    request.cookies.get('access_token')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/stats/:path*', '/review/:path*', '/summary/:path*'],
};
