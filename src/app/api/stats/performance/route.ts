/**
 * GET /api/stats/performance
 * Returns daily performance metrics for time-series charts and hero metric cards.
 * Requires authentication. Uses Supabase daily_stats table.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDailyStats } from '@/lib/supabase/statsService'
import type { PerformanceStatsResponse } from '@/lib/stats/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') ?? undefined
    const endDate = searchParams.get('endDate') ?? undefined

    // Validate dates if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      return NextResponse.json(
        { error: { code: 'INVALID_ARGUMENT', message: 'Invalid date format. Use ISO date strings.' } },
        { status: 400 }
      )
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      return NextResponse.json(
        { error: { code: 'INVALID_ARGUMENT', message: 'Invalid date format. Use ISO date strings.' } },
        { status: 400 }
      )
    }

    const metrics = await getDailyStats(supabase, user.id, { startDate, endDate })

    // Determine granularity based on date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()
    const daySpan = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    const granularity: PerformanceStatsResponse['granularity'] =
      daySpan <= 7 ? 'session' : daySpan <= 90 ? 'day' : 'week'

    const response: PerformanceStatsResponse = { metrics, granularity }
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching performance stats:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch performance stats' } },
      { status: 500 }
    )
  }
}
