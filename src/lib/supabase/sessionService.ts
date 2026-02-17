/**
 * Supabase-backed session CRUD operations for training sessions and entries.
 *
 * All functions take a typed Supabase client as the first parameter (created
 * per-request in route handlers). Guest fallback is handled at the API route
 * level -- if no user, routes use the existing in-memory sessionStore instead.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  TrainingSession,
  TrainingSessionInsert,
  TrainingSessionUpdate,
  SessionEntry,
  SessionEntryInsert,
} from '@/lib/supabase/types'
import type { Json } from '@/lib/supabase.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateTrainingSessionParams {
  user_id: string | null
  session_id: string
  seed: string
  mode: string
  filters: Record<string, unknown>
  decisions_per_session: number
  target_stack_bb?: number | null
  decision_index?: number
  current_spot?: unknown | null
}

export interface AddSessionEntryParams {
  session_id: string // UUID of training_sessions row
  index: number
  spot_id: string
  spot: unknown // JSONB
  action_id: string
  result?: unknown | null // JSONB
}

export interface UpdateTrainingSessionFields {
  decision_index?: number
  current_spot?: unknown | null
  is_complete?: boolean
  mode?: string
  filters?: Record<string, unknown>
}

export type TrainingSessionWithEntries = TrainingSession & {
  session_entries: SessionEntry[]
}

// ---------------------------------------------------------------------------
// 1. createTrainingSession
// ---------------------------------------------------------------------------

/**
 * Insert a new row into training_sessions.
 * If a row with the same session_id + seed already exists, return the existing row.
 */
export async function createTrainingSession(
  supabase: SupabaseClient<Database>,
  params: CreateTrainingSessionParams
): Promise<TrainingSession> {
  // Check for existing session first (idempotent start)
  const { data: existing } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('session_id', params.session_id)
    .eq('seed', params.seed)
    .maybeSingle()

  if (existing) return existing

  const row: TrainingSessionInsert = {
    user_id: params.user_id,
    session_id: params.session_id,
    seed: params.seed,
    mode: params.mode,
    filters: params.filters as unknown as Json,
    decisions_per_session: params.decisions_per_session,
    target_stack_bb: params.target_stack_bb ?? null,
    decision_index: params.decision_index ?? 0,
    current_spot: (params.current_spot ?? null) as Json,
  }

  const { data, error } = await supabase
    .from('training_sessions')
    .insert(row)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create training session: ${error.message}`)
  }

  return data
}

// ---------------------------------------------------------------------------
// 2. getTrainingSession
// ---------------------------------------------------------------------------

/**
 * Select a training session by session_id + seed.
 */
export async function getTrainingSession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  seed: string
): Promise<TrainingSession | null> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .eq('seed', seed)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to get training session: ${error.message}`)
  }

  return data
}

// ---------------------------------------------------------------------------
// 3. updateTrainingSession
// ---------------------------------------------------------------------------

/**
 * Partial update of a training_sessions row by its primary key (id).
 */
export async function updateTrainingSession(
  supabase: SupabaseClient<Database>,
  id: string,
  updates: UpdateTrainingSessionFields
): Promise<TrainingSession> {
  const row: TrainingSessionUpdate = {}

  if (updates.decision_index !== undefined) {
    row.decision_index = updates.decision_index
  }
  if (updates.current_spot !== undefined) {
    row.current_spot = updates.current_spot as Json
  }
  if (updates.is_complete !== undefined) {
    row.is_complete = updates.is_complete
  }
  if (updates.mode !== undefined) {
    row.mode = updates.mode
  }
  if (updates.filters !== undefined) {
    row.filters = updates.filters as unknown as Json
  }

  const { data, error } = await supabase
    .from('training_sessions')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update training session: ${error.message}`)
  }

  return data
}

// ---------------------------------------------------------------------------
// 4. addSessionEntry
// ---------------------------------------------------------------------------

/**
 * Insert a new row into session_entries.
 */
export async function addSessionEntry(
  supabase: SupabaseClient<Database>,
  params: AddSessionEntryParams
): Promise<SessionEntry> {
  const row: SessionEntryInsert = {
    session_id: params.session_id,
    index: params.index,
    spot_id: params.spot_id,
    spot: params.spot as Json,
    action_id: params.action_id,
    result: (params.result ?? null) as Json,
  }

  const { data, error } = await supabase
    .from('session_entries')
    .insert(row)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to add session entry: ${error.message}`)
  }

  return data
}

// ---------------------------------------------------------------------------
// 5. getSessionEntries
// ---------------------------------------------------------------------------

/**
 * Select all entries for a training session, ordered by index ASC.
 * Takes the training_sessions UUID (id), not the logical session_id.
 */
export async function getSessionEntries(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<SessionEntry[]> {
  const { data, error } = await supabase
    .from('session_entries')
    .select('*')
    .eq('session_id', sessionId)
    .order('index', { ascending: true })

  if (error) {
    throw new Error(`Failed to get session entries: ${error.message}`)
  }

  return data ?? []
}

// ---------------------------------------------------------------------------
// 6. getSessionWithEntries
// ---------------------------------------------------------------------------

/**
 * Fetch a training session with all its entries in one query.
 * Uses Supabase's relation embedding (foreign key join).
 */
export async function getSessionWithEntries(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  seed: string
): Promise<TrainingSessionWithEntries | null> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*, session_entries(*)')
    .eq('session_id', sessionId)
    .eq('seed', seed)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to get session with entries: ${error.message}`)
  }

  if (!data) return null

  // Sort entries by index
  const entries = (data.session_entries ?? []).sort(
    (a: SessionEntry, b: SessionEntry) => a.index - b.index
  )

  return { ...data, session_entries: entries }
}

// ---------------------------------------------------------------------------
// 7. deleteTrainingSession
// ---------------------------------------------------------------------------

/**
 * Delete a training session by its primary key (id).
 * Session entries cascade-delete via foreign key constraint.
 */
export async function deleteTrainingSession(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete training session: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// 8. flagEntry
// ---------------------------------------------------------------------------

/**
 * Toggle the is_flagged field on a session entry.
 */
export async function flagEntry(
  supabase: SupabaseClient<Database>,
  entryId: string,
  isFlagged: boolean
): Promise<SessionEntry> {
  const { data, error } = await supabase
    .from('session_entries')
    .update({ is_flagged: isFlagged })
    .eq('id', entryId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to flag entry: ${error.message}`)
  }

  return data
}
