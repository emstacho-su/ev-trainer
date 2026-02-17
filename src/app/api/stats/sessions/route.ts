/**
 * GET /api/stats/sessions
 * Returns paginated session history for the authenticated user.
 * Requires authentication. Uses Supabase training_sessions table.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionHistory } from '@/lib/supabase/statsService'
import type { SessionHistoryResponse } from '@/lib/stats/types'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    )
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

    const { sessions, total } = await getSessionHistory(supabase, user.id, {
      page,
      pageSize,
      startDate,
      endDate,
    })

    const response: SessionHistoryResponse = {
      sessions,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching session history:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch session history' } },
      { status: 500 }
    )
  }
}
