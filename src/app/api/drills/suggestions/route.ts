/**
 * GET /api/drills/suggestions
 * Returns drill suggestions based on user's weakest spots.
 * Requires authentication. Uses Supabase spot_stats table.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDrillSuggestions } from '@/lib/supabase/statsService'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const suggestions = await getDrillSuggestions(supabase, user.id)
    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Error fetching drill suggestions:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch drill suggestions' } },
      { status: 500 }
    )
  }
}
