import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Email confirmation handler for magic links and password resets.
 *
 * Supabase sends confirmation emails with a link containing:
 * - token_hash: The OTP hash to verify
 * - type: The OTP type (signup, recovery, email_change, etc.)
 *
 * On successful verification, redirects to '/'.
 * On failure, redirects to '/login?error=confirmation_failed'.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (!error) {
      return NextResponse.redirect(new URL('/', origin))
    }
  }

  // Verification failed -- redirect to login with error
  return NextResponse.redirect(
    new URL('/login?error=confirmation_failed', origin)
  )
}
