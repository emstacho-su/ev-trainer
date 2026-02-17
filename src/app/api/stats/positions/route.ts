/**
 * GET /api/stats/positions
 * Returns position-based performance breakdown for heatmap and weakness table.
 * Requires authentication. Uses Supabase spot_stats table.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPositionStats } from '@/lib/supabase/statsService'
import type { PositionStatsResponse } from '@/lib/stats/types'

const LOW_CONFIDENCE_THRESHOLD = 20

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
    const positionsParam = searchParams.get('positions')
    const positions = positionsParam ? positionsParam.split(',').filter(Boolean) : undefined

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

    const stats = await getPositionStats(supabase, user.id, {
      startDate,
      endDate,
      positions,
    })

    const response: PositionStatsResponse = {
      stats,
      lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching position stats:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch position stats' } },
      { status: 500 }
    )
  }
}
