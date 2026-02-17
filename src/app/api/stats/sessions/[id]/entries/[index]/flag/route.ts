/**
 * PATCH /api/stats/sessions/[id]/entries/[index]/flag
 * Toggles the is_flagged state on a session entry.
 * Requires authentication. Uses Supabase session_entries with ownership check.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toggleEntryFlag } from '@/lib/supabase/statsService'

export async function PATCH(
  request: NextRequest,
  context: RouteContext<'/api/stats/sessions/[id]/entries/[index]/flag'>
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { id, index } = await context.params
    const entryIndex = parseInt(index, 10)

    if (!id || isNaN(entryIndex)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ARGUMENT', message: 'Session ID and entry index are required' } },
        { status: 400 }
      )
    }

    const result = await toggleEntryFlag(supabase, id, entryIndex, user.id)

    if (!result) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Session entry not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ isFlagged: result.isFlagged })
  } catch (error) {
    console.error('Error toggling hand flag:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle hand flag' } },
      { status: 500 }
    )
  }
}
