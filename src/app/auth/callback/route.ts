import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * OAuth callback handler for PKCE code exchange.
 *
 * After a user authenticates with an OAuth provider (Google, GitHub, etc.),
 * the provider redirects here with a `code` query parameter.
 * We exchange that code for a Supabase session, then redirect the user.
 *
 * Query params:
 * - code: The PKCE authorization code from the OAuth provider
 * - next: Optional redirect destination after successful auth (defaults to '/')
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // Auth failed -- redirect to login with error
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_failed', origin)
  )
}
