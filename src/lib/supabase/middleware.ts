import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/types'

/**
 * Routes that require authentication.
 * Unauthenticated users visiting these are redirected to /login.
 */
const PROTECTED_PREFIXES = ['/stats', '/review', '/summary']

/**
 * Refreshes the Supabase auth session on every request via middleware.
 *
 * This function:
 * 1. Creates a Supabase client that reads/writes cookies on the request/response
 * 2. Calls getUser() to validate and refresh the JWT (NOT getSession -- security requirement)
 * 3. Propagates refreshed cookies to both the request and response
 * 4. Redirects unauthenticated users from protected routes to /login
 *
 * Cookie propagation pattern:
 * - request.cookies.set() ensures downstream Server Components see fresh tokens
 * - supabaseResponse.cookies.set() ensures the browser receives fresh tokens
 *
 * Guest access: Training routes (/train, /preflop-training, /postflop-training,
 * /training, /session/*) are accessible without authentication.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: use getUser() not getSession() for security
  // getUser() validates the JWT against Supabase servers
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check if current path requires authentication
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}
