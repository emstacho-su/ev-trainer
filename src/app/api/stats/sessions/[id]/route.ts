/**
 * GET /api/stats/sessions/[id]  -- Session detail with entries
 * DELETE /api/stats/sessions/[id]  -- Delete session (ownership verified)
 * Requires authentication. Uses Supabase training_sessions + session_entries.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionDetail, deleteSession } from '@/lib/supabase/statsService'

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/stats/sessions/[id]'>
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

    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: { code: 'INVALID_ARGUMENT', message: 'Session ID is required' } },
        { status: 400 }
      )
    }

    const detail = await getSessionDetail(supabase, id, user.id)

    if (!detail) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Session not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching session detail:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch session detail' } },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<'/api/stats/sessions/[id]'>
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

    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: { code: 'INVALID_ARGUMENT', message: 'Session ID is required' } },
        { status: 400 }
      )
    }

    const deleted = await deleteSession(supabase, id, user.id)

    if (!deleted) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Session not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete session' } },
      { status: 500 }
    )
  }
}
