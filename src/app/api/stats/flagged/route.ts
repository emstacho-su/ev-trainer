/**
 * GET /api/stats/flagged
 * Returns all flagged session entries for the authenticated user.
 * Requires authentication. Uses Supabase session_entries table.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFlaggedHands } from '@/lib/supabase/statsService'

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
    const scenariosParam = searchParams.get('scenarios')
    const streetsParam = searchParams.get('streets')

    const positions = positionsParam ? positionsParam.split(',').filter(Boolean) : undefined
    const scenarios = scenariosParam ? scenariosParam.split(',').filter(Boolean) : undefined
    const streets = streetsParam ? streetsParam.split(',').filter(Boolean) : undefined

    const entries = await getFlaggedHands(supabase, user.id, {
      startDate,
      endDate,
      positions,
      scenarios,
      streets,
    })

    return NextResponse.json({ entries }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching flagged hands:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch flagged hands' } },
      { status: 500 }
    )
  }
}
