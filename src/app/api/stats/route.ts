/**
 * GET /api/stats
 * Returns overview stats (lifetime totals with trend data) for the authenticated user.
 * Requires authentication. Uses Supabase daily_stats table.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOverviewStats } from '@/lib/supabase/statsService'

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

    const overview = await getOverviewStats(supabase, user.id)

    return NextResponse.json(overview, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching overview stats:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch overview stats' } },
      { status: 500 }
    )
  }
}
