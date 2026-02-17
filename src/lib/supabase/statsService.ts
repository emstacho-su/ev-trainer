/**
 * Supabase-backed stats/analytics query service.
 *
 * Replaces Prisma-based stats aggregation (src/lib/stats/aggregation.ts) with
 * direct Supabase client queries against daily_stats, spot_stats,
 * training_sessions, and session_entries tables.
 *
 * All functions take a typed Supabase client as the first parameter.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { Json } from '@/lib/supabase.types'
import type {
  PerformanceDataPoint,
  PositionStat,
  SessionSummary,
  SessionDetail,
  SessionEntryDetail,
  FlaggedEntry,
} from '@/lib/stats/types'

const LOW_CONFIDENCE_THRESHOLD = 20

// ---------------------------------------------------------------------------
// 1. getDailyStats
// ---------------------------------------------------------------------------

export interface DailyStatsParams {
  startDate?: string
  endDate?: string
}

/**
 * Query daily_stats with optional date range filters.
 * Returns performance data points for time-series charts.
 */
export async function getDailyStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: DailyStatsParams = {}
): Promise<PerformanceDataPoint[]> {
  let query = supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (params.startDate) {
    query = query.gte('date', params.startDate)
  }
  if (params.endDate) {
    query = query.lte('date', params.endDate)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch daily stats: ${error.message}`)
  }

  return (data ?? []).map((stat) => {
    const accuracy =
      stat.total_decisions > 0
        ? (stat.correct_decisions / stat.total_decisions) * 100
        : 0

    return {
      date: stat.date,
      hands: stat.total_decisions,
      accuracy: Math.round(accuracy * 10) / 10,
      avgEVLoss: Number(stat.avg_ev_loss),
      correctFoldPct: 0,
      correctRaisePct: 0,
      sessionCount: stat.sessions_completed,
    }
  })
}

// ---------------------------------------------------------------------------
// 2. getOverviewStats
// ---------------------------------------------------------------------------

export interface OverviewStats {
  totalDecisions: number
  accuracy: number
  avgEvLoss: number
  sessionsCompleted: number
  trend: {
    decisions: number | null
    accuracy: number | null
    avgEvLoss: number | null
  }
}

/**
 * Compute lifetime totals and 7-day trend from daily_stats.
 */
export async function getOverviewStats(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<OverviewStats> {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch overview stats: ${error.message}`)
  }

  const rows = data ?? []

  const totalDecisions = rows.reduce((s, r) => s + r.total_decisions, 0)
  const totalCorrect = rows.reduce((s, r) => s + r.correct_decisions, 0)
  const sessionsCompleted = rows.reduce((s, r) => s + r.sessions_completed, 0)
  const accuracy = totalDecisions > 0 ? (totalCorrect / totalDecisions) * 100 : 0
  const weightedEvLoss = rows.reduce(
    (s, r) => s + Number(r.avg_ev_loss) * r.total_decisions,
    0
  )
  const avgEvLoss = totalDecisions > 0 ? weightedEvLoss / totalDecisions : 0

  // Trend: last 7 days vs previous 7 days
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const recentStr = sevenDaysAgo.toISOString().split('T')[0]
  const prevStr = fourteenDaysAgo.toISOString().split('T')[0]

  const recent = rows.filter((r) => r.date >= recentStr)
  const prev = rows.filter((r) => r.date >= prevStr && r.date < recentStr)

  const recentDecisions = recent.reduce((s, r) => s + r.total_decisions, 0)
  const prevDecisions = prev.reduce((s, r) => s + r.total_decisions, 0)

  const recentCorrect = recent.reduce((s, r) => s + r.correct_decisions, 0)
  const prevCorrect = prev.reduce((s, r) => s + r.correct_decisions, 0)

  const recentAcc = recentDecisions > 0 ? (recentCorrect / recentDecisions) * 100 : 0
  const prevAcc = prevDecisions > 0 ? (prevCorrect / prevDecisions) * 100 : 0

  return {
    totalDecisions,
    accuracy: Math.round(accuracy * 10) / 10,
    avgEvLoss: Math.round(avgEvLoss * 10000) / 10000,
    sessionsCompleted,
    trend: {
      decisions: prevDecisions > 0
        ? ((recentDecisions - prevDecisions) / prevDecisions) * 100
        : null,
      accuracy: prevAcc > 0 ? recentAcc - prevAcc : null,
      avgEvLoss: null,
    },
  }
}

// ---------------------------------------------------------------------------
// 3. getPositionStats
// ---------------------------------------------------------------------------

export interface PositionStatsParams {
  startDate?: string
  endDate?: string
  positions?: string[]
}

/**
 * Query spot_stats grouped by hero_position x villain_position.
 * Returns data suitable for heatmap and weakness breakdown.
 */
export async function getPositionStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: PositionStatsParams = {}
): Promise<PositionStat[]> {
  let query = supabase
    .from('spot_stats')
    .select('*')
    .eq('user_id', userId)

  if (params.startDate) {
    query = query.gte('last_practiced', params.startDate)
  }
  if (params.endDate) {
    query = query.lte('last_practiced', params.endDate)
  }
  if (params.positions && params.positions.length > 0) {
    query = query.in('hero_position', params.positions)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch position stats: ${error.message}`)
  }

  // Group by hero_position + villain_position client-side
  const groups = new Map<
    string,
    { hero: string; villain: string | null; totalDec: number; correctDec: number; weightedEvLoss: number }
  >()

  for (const row of data ?? []) {
    const key = `${row.hero_position}:${row.villain_position ?? 'null'}`
    const existing = groups.get(key)
    if (existing) {
      existing.totalDec += row.total_decisions
      existing.correctDec += row.correct_decisions
      existing.weightedEvLoss += Number(row.avg_ev_loss) * row.total_decisions
    } else {
      groups.set(key, {
        hero: row.hero_position,
        villain: row.villain_position,
        totalDec: row.total_decisions,
        correctDec: row.correct_decisions,
        weightedEvLoss: Number(row.avg_ev_loss) * row.total_decisions,
      })
    }
  }

  return Array.from(groups.values()).map((g) => {
    const accuracy = g.totalDec > 0 ? (g.correctDec / g.totalDec) * 100 : 0
    const avgEVLoss = g.totalDec > 0 ? g.weightedEvLoss / g.totalDec : 0
    return {
      heroPosition: g.hero,
      villainPosition: g.villain,
      hands: g.totalDec,
      accuracy: Math.round(accuracy * 10) / 10,
      avgEVLoss: Number(avgEVLoss.toFixed(4)),
      confidence: g.totalDec >= LOW_CONFIDENCE_THRESHOLD,
    }
  })
}

// ---------------------------------------------------------------------------
// 4. getWeaknessBreakdown
// ---------------------------------------------------------------------------

/**
 * Query spot_stats for worst spots by avg_ev_loss (descending).
 * Filters to spots with >= 10 decisions (confidence threshold).
 */
export async function getWeaknessBreakdown(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: { limit?: number } = {}
): Promise<Array<{ spotId: string; heroPosition: string; villainPosition: string | null; street: string; avgEvLoss: number; totalDecisions: number }>> {
  const limit = params.limit ?? 10

  const { data, error } = await supabase
    .from('spot_stats')
    .select('*')
    .eq('user_id', userId)
    .gte('total_decisions', 10)
    .order('avg_ev_loss', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch weakness breakdown: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    spotId: row.spot_id,
    heroPosition: row.hero_position,
    villainPosition: row.villain_position,
    street: row.street,
    avgEvLoss: Number(row.avg_ev_loss),
    totalDecisions: row.total_decisions,
  }))
}

// ---------------------------------------------------------------------------
// 5. getSessionHistory
// ---------------------------------------------------------------------------

export interface SessionHistoryParams {
  page: number
  pageSize: number
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Paginated session history with computed accuracy/EV loss per session.
 * Returns shape matching SessionHistoryResponse for the frontend.
 */
export async function getSessionHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: SessionHistoryParams
): Promise<{ sessions: SessionSummary[]; total: number }> {
  const { page, pageSize } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Build the main query
  let query = supabase
    .from('training_sessions')
    .select('*, session_entries(*)', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_complete', true)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.startDate) {
    query = query.gte('created_at', params.startDate)
  }
  if (params.endDate) {
    query = query.lte('created_at', params.endDate)
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch session history: ${error.message}`)
  }

  const total = count ?? 0
  const sessions: SessionSummary[] = (data ?? []).map((session) => {
    const entries = (session.session_entries ?? []).sort(
      (a: { index: number }, b: { index: number }) => a.index - b.index
    )

    const gradedEntries = entries.filter(
      (e: { result: Json | null }) => e.result !== null && typeof e.result === 'object'
    )

    const correctCount = gradedEntries.filter((e: { result: Json | null }) => {
      const result = e.result as Record<string, unknown> | null
      return result?.grade === 'CORRECT' || result?.grade === 'OPTIMAL'
    }).length

    const accuracy =
      gradedEntries.length > 0
        ? (correctCount / gradedEntries.length) * 100
        : 0

    const totalEvLoss = gradedEntries.reduce((sum: number, e: { result: Json | null }) => {
      const result = e.result as Record<string, unknown> | null
      return sum + Math.abs(Number(result?.evDiff ?? 0))
    }, 0)
    const avgEVLoss =
      gradedEntries.length > 0 ? totalEvLoss / gradedEntries.length : 0

    // Duration from first to last entry
    const timestamps = entries.map((e: { created_at: string }) =>
      new Date(e.created_at).getTime()
    )
    const duration =
      timestamps.length >= 2
        ? (Math.max(...timestamps) - Math.min(...timestamps)) / 1000
        : 0

    // Scenario breakdown from spot data
    const scenarioBreakdown: Record<string, number> = {}
    for (const entry of entries) {
      const spot = entry.spot as Record<string, unknown> | null
      const meta = spot?.meta as Record<string, unknown> | undefined
      const scenarioType =
        meta?.scenarioType ?? (spot as Record<string, unknown>)?.scenarioType ?? 'unknown'
      const key = String(scenarioType)
      scenarioBreakdown[key] = (scenarioBreakdown[key] ?? 0) + 1
    }

    return {
      id: session.id,
      sessionId: session.session_id,
      createdAt: new Date(session.created_at),
      decisionsPerSession: session.decisions_per_session,
      decisionsCompleted: entries.length,
      accuracy: Math.round(accuracy * 10) / 10,
      avgEVLoss: Math.round(avgEVLoss * 100) / 100,
      duration: Math.round(duration),
      scenarioBreakdown,
    }
  })

  return { sessions, total }
}

// ---------------------------------------------------------------------------
// 6. getSessionDetail
// ---------------------------------------------------------------------------

/**
 * Get detailed session with all entries and biggest mistakes.
 * Verifies ownership via user_id.
 */
export async function getSessionDetail(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  userId: string
): Promise<SessionDetail | null> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*, session_entries(*)')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch session detail: ${error.message}`)
  }

  if (!data) return null

  const sortedEntries = (data.session_entries ?? []).sort(
    (a: { index: number }, b: { index: number }) => a.index - b.index
  )

  const entries: SessionEntryDetail[] = sortedEntries.map(
    (e: { id: string; index: number; spot_id: string; action_id: string; is_flagged: boolean; result: Json | null }) => ({
      id: e.id,
      index: e.index,
      spotId: e.spot_id,
      actionId: e.action_id,
      isFlagged: e.is_flagged,
      result: e.result as SessionEntryDetail['result'],
    })
  )

  // Biggest mistakes: entries with largest negative EV diff, sorted worst first
  const biggestMistakes = entries
    .filter((e) => e.result !== null && Math.abs(e.result.evDiff) > 0)
    .sort((a, b) => Math.abs(b.result!.evDiff) - Math.abs(a.result!.evDiff))
    .slice(0, 5)

  return {
    id: data.id,
    sessionId: data.session_id,
    createdAt: new Date(data.created_at),
    mode: data.mode,
    packId: 'default',
    decisionsPerSession: data.decisions_per_session,
    isComplete: data.is_complete,
    entries,
    biggestMistakes,
  }
}

// ---------------------------------------------------------------------------
// 7. deleteSession
// ---------------------------------------------------------------------------

/**
 * Delete a training session with ownership check.
 * Returns true if deleted, false if not found/not owned.
 */
export async function deleteSession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  userId: string
): Promise<boolean> {
  // Verify ownership
  const { data: session } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!session) return false

  const { error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('id', session.id)

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`)
  }

  return true
}

// ---------------------------------------------------------------------------
// 8. getFlaggedHands
// ---------------------------------------------------------------------------

export interface FlaggedHandsFilters {
  startDate?: string
  endDate?: string
  positions?: string[]
  scenarios?: string[]
  streets?: string[]
}

/**
 * Get all flagged session entries for a user with session context.
 * Supports optional filters on date range and spot properties.
 */
export async function getFlaggedHands(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters?: FlaggedHandsFilters
): Promise<FlaggedEntry[]> {
  // First get user's training session IDs (filtered by date if needed)
  let sessionQuery = supabase
    .from('training_sessions')
    .select('id, created_at')
    .eq('user_id', userId)

  if (filters?.startDate) {
    sessionQuery = sessionQuery.gte('created_at', filters.startDate)
  }
  if (filters?.endDate) {
    sessionQuery = sessionQuery.lte('created_at', filters.endDate)
  }

  const { data: sessions, error: sessionError } = await sessionQuery

  if (sessionError) {
    throw new Error(`Failed to fetch sessions for flagged hands: ${sessionError.message}`)
  }

  if (!sessions || sessions.length === 0) return []

  const sessionIds = sessions.map((s) => s.id)
  const sessionDates = new Map(sessions.map((s) => [s.id, s.created_at]))

  // Query flagged entries
  const { data: entries, error: entryError } = await supabase
    .from('session_entries')
    .select('*')
    .in('session_id', sessionIds)
    .eq('is_flagged', true)
    .order('created_at', { ascending: false })

  if (entryError) {
    throw new Error(`Failed to fetch flagged entries: ${entryError.message}`)
  }

  return (entries ?? []).map((e) => {
    const result = e.result as Record<string, unknown> | null
    return {
      id: e.id,
      sessionId: e.session_id,
      index: e.index,
      spotId: e.spot_id,
      actionId: e.action_id,
      sessionDate: new Date(sessionDates.get(e.session_id) ?? e.created_at),
      grade: (result?.grade as string) ?? 'UNKNOWN',
      evDiff: Number(result?.evDiff ?? 0),
    }
  })
}

// ---------------------------------------------------------------------------
// 9. toggleEntryFlag
// ---------------------------------------------------------------------------

/**
 * Toggle is_flagged on a session entry.
 * Verifies session ownership via user_id.
 */
export async function toggleEntryFlag(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  entryIndex: number,
  userId: string
): Promise<{ isFlagged: boolean } | null> {
  // Verify session ownership
  const { data: session } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!session) return null

  // Find the entry by session_id + index
  const { data: entry, error: findError } = await supabase
    .from('session_entries')
    .select('id, is_flagged')
    .eq('session_id', sessionId)
    .eq('index', entryIndex)
    .maybeSingle()

  if (findError) {
    throw new Error(`Failed to find entry: ${findError.message}`)
  }

  if (!entry) return null

  // Toggle flag
  const newFlagged = !entry.is_flagged
  const { error: updateError } = await supabase
    .from('session_entries')
    .update({ is_flagged: newFlagged })
    .eq('id', entry.id)

  if (updateError) {
    throw new Error(`Failed to toggle flag: ${updateError.message}`)
  }

  return { isFlagged: newFlagged }
}

// ---------------------------------------------------------------------------
// 10. getDrillSuggestions
// ---------------------------------------------------------------------------

export interface DrillSuggestion {
  spotLabel: string
  accuracy: number
  avgEvLoss: number
  positions: string[]
  potTypes: string[]
}

/**
 * Top 5 worst-performing spot categories for drill suggestions.
 */
export async function getDrillSuggestions(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<DrillSuggestion[]> {
  const { data, error } = await supabase
    .from('spot_stats')
    .select('*')
    .eq('user_id', userId)
    .gte('total_decisions', 10)
    .order('avg_ev_loss', { ascending: false })
    .limit(5)

  if (error) {
    throw new Error(`Failed to fetch drill suggestions: ${error.message}`)
  }

  return (data ?? []).map((stat) => {
    const accuracy =
      stat.total_decisions > 0
        ? (stat.correct_decisions / stat.total_decisions) * 100
        : 0

    const spotLabel = stat.villain_position
      ? `${stat.hero_position} vs ${stat.villain_position}`
      : stat.hero_position

    return {
      spotLabel,
      accuracy,
      avgEvLoss: Number(stat.avg_ev_loss),
      positions: [stat.hero_position],
      potTypes: [],
    }
  })
}

// ---------------------------------------------------------------------------
// 11. upsertDailyStats
// ---------------------------------------------------------------------------

export interface DailyStatsUpsert {
  totalDecisions: number
  correctDecisions: number
  avgEvLoss: number
  sessionsCompleted: number
}

/**
 * Upsert daily_stats row, incrementing on conflict.
 * Called after session completion to update daily aggregates.
 */
export async function upsertDailyStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  date: string,
  stats: DailyStatsUpsert
): Promise<void> {
  // Check if row exists
  const { data: existing } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (existing) {
    // Increment existing totals
    const newTotal = existing.total_decisions + stats.totalDecisions
    const newCorrect = existing.correct_decisions + stats.correctDecisions
    const oldWeighted = Number(existing.avg_ev_loss) * existing.total_decisions
    const newWeighted = stats.avgEvLoss * stats.totalDecisions
    const newAvg = newTotal > 0 ? (oldWeighted + newWeighted) / newTotal : 0

    const { error } = await supabase
      .from('daily_stats')
      .update({
        total_decisions: newTotal,
        correct_decisions: newCorrect,
        avg_ev_loss: Math.round(newAvg * 10000) / 10000,
        sessions_completed: existing.sessions_completed + stats.sessionsCompleted,
      })
      .eq('id', existing.id)

    if (error) {
      throw new Error(`Failed to update daily stats: ${error.message}`)
    }
  } else {
    // Insert new row
    const { error } = await supabase.from('daily_stats').insert({
      user_id: userId,
      date,
      total_decisions: stats.totalDecisions,
      correct_decisions: stats.correctDecisions,
      avg_ev_loss: Math.round(stats.avgEvLoss * 10000) / 10000,
      sessions_completed: stats.sessionsCompleted,
    })

    if (error) {
      throw new Error(`Failed to insert daily stats: ${error.message}`)
    }
  }
}

// ---------------------------------------------------------------------------
// 12. upsertSpotStats
// ---------------------------------------------------------------------------

export interface SpotStatsUpsert {
  spotId: string
  street: string
  heroPosition: string
  villainPosition: string | null
  isCorrect: boolean
  evLoss: number
}

/**
 * Upsert spot_stats row, updating running averages on conflict.
 * Called after each decision submission for authenticated users.
 */
export async function upsertSpotStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  stats: SpotStatsUpsert
): Promise<void> {
  const now = new Date().toISOString()

  // Check if row exists
  const { data: existing } = await supabase
    .from('spot_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('spot_id', stats.spotId)
    .maybeSingle()

  if (existing) {
    // Update running averages
    const newTotal = existing.total_decisions + 1
    const newCorrect = existing.correct_decisions + (stats.isCorrect ? 1 : 0)
    const oldWeighted = Number(existing.avg_ev_loss) * existing.total_decisions
    const newAvg = (oldWeighted + stats.evLoss) / newTotal

    const { error } = await supabase
      .from('spot_stats')
      .update({
        total_decisions: newTotal,
        correct_decisions: newCorrect,
        avg_ev_loss: Math.round(newAvg * 10000) / 10000,
        last_practiced: now,
      })
      .eq('id', existing.id)

    if (error) {
      throw new Error(`Failed to update spot stats: ${error.message}`)
    }
  } else {
    // Insert new row
    const { error } = await supabase.from('spot_stats').insert({
      user_id: userId,
      spot_id: stats.spotId,
      street: stats.street,
      hero_position: stats.heroPosition,
      villain_position: stats.villainPosition,
      total_decisions: 1,
      correct_decisions: stats.isCorrect ? 1 : 0,
      avg_ev_loss: Math.round(stats.evLoss * 10000) / 10000,
      last_practiced: now,
    })

    if (error) {
      throw new Error(`Failed to insert spot stats: ${error.message}`)
    }
  }
}
