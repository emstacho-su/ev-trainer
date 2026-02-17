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

  console.log('[auth/callback] code:', code ? 'present' : 'missing')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }

    console.error('[auth/callback] exchange error:', error)

    // Pass specific error info to login page for diagnostics
    const errorMessage = encodeURIComponent(error?.message || 'unknown')
    return NextResponse.redirect(
      new URL(`/login?error=auth_callback_failed&message=${errorMessage}`, origin)
    )
  }

  // No code present -- redirect to login with error
  console.error('[auth/callback] no code parameter in callback URL')
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_failed&message=no_code_in_callback', origin)
  )
}
