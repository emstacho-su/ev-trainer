import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/types'

/**
 * Creates a Supabase client for use in browser (Client Components).
 *
 * This client uses browser cookies for session management and is safe
 * to call multiple times -- @supabase/ssr deduplicates instances.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
