import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next.js middleware: refreshes Supabase auth tokens and protects routes.
 *
 * On every request, updateSession():
 * 1. Validates/refreshes the JWT via getUser()
 * 2. Propagates refreshed cookies to request and response
 * 3. Redirects unauthenticated users away from protected routes
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
