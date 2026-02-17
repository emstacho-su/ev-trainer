import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/supabase/types'

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers.
 *
 * IMPORTANT: Create a new client per request -- do NOT cache or share
 * instances across requests (leaks session state between users).
 *
 * Uses getAll()/setAll() cookie methods (individual get/set/remove are deprecated).
 * The setAll try/catch handles Server Components which cannot set cookies;
 * middleware handles token refresh in that case.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component -- can't set cookies, middleware handles this
          }
        },
      },
    }
  )
}
