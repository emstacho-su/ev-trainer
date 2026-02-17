/**
 * Spot service for querying and managing spots in Supabase.
 *
 * Provides filtered queries, random selection, single lookups,
 * and conversion between Supabase rows and engine Spot types.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { Spot as EngineSpot } from '@/lib/engine/spot'
import type { Position, Street } from '@/lib/engine/types'
import type { PotType, SpotMeta } from '@/lib/v2/packs/spotPack'
import type { PreflopScenarioType } from '@/lib/v2/packs/scenarioClassifier'
import type { Spot as SupabaseSpotRow, SpotInsert } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Filter types for Supabase spot queries
// ---------------------------------------------------------------------------

export interface SpotQueryFilters {
  street?: Street
  hero_position?: Position
  hero_positions?: Position[]
  villain_position?: Position
  pot_type?: PotType | 'ANY'
  pot_types?: (PotType | 'ANY')[]
  effective_stack_bb_min?: number
  effective_stack_bb_max?: number
  scenario_type?: PreflopScenarioType | 'ANY'
  tags?: string[]
  is_system?: boolean
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Builds a Supabase query with filters applied.
 * Returns the query builder for further chaining (e.g., .limit(), .order()).
 */
function applyFilters(
  query: ReturnType<SupabaseClient<Database>['from']>,
  filters: SpotQueryFilters
) {
  let q = query.select('*')

  if (filters.street) {
    q = q.eq('street', filters.street)
  }

  if (filters.hero_position) {
    q = q.eq('hero_position', filters.hero_position)
  }

  if (filters.hero_positions && filters.hero_positions.length > 0) {
    q = q.in('hero_position', filters.hero_positions)
  }

  if (filters.villain_position) {
    q = q.eq('villain_position', filters.villain_position)
  }

  if (filters.pot_type && filters.pot_type !== 'ANY') {
    q = q.eq('pot_type', filters.pot_type)
  }

  if (filters.pot_types && filters.pot_types.length > 0) {
    const nonAny = filters.pot_types.filter((pt) => pt !== 'ANY')
    if (nonAny.length > 0 && nonAny.length === filters.pot_types.length) {
      q = q.in('pot_type', nonAny)
    }
    // If ANY is in the list, no pot_type filter needed
  }

  if (filters.effective_stack_bb_min !== undefined) {
    q = q.gte('effective_stack_bb', filters.effective_stack_bb_min)
  }

  if (filters.effective_stack_bb_max !== undefined) {
    q = q.lte('effective_stack_bb', filters.effective_stack_bb_max)
  }

  if (filters.scenario_type && filters.scenario_type !== 'ANY') {
    q = q.eq('scenario_type', filters.scenario_type)
  }

  if (filters.tags && filters.tags.length > 0) {
    q = q.overlaps('tags', filters.tags)
  }

  if (filters.is_system !== undefined) {
    q = q.eq('is_system', filters.is_system)
  }

  return q
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Query spots with filters. Returns all matching rows.
 */
export async function getFilteredSpots(
  supabase: SupabaseClient<Database>,
  filters: SpotQueryFilters = {}
): Promise<SupabaseSpotRow[]> {
  const query = applyFilters(supabase.from('spots'), filters)
  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch filtered spots: ${error.message}`)
  }

  return data ?? []
}

/**
 * Get a single spot by its spot_id (content hash).
 */
export async function getSpotById(
  supabase: SupabaseClient<Database>,
  spotId: string
): Promise<SupabaseSpotRow | null> {
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .eq('spot_id', spotId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch spot ${spotId}: ${error.message}`)
  }

  return data
}

/**
 * Get random spots matching filters using a deterministic seed.
 *
 * Strategy: fetch all matching IDs, shuffle deterministically with seed,
 * then fetch the first `count` full rows. This avoids Postgres random()
 * which cannot be seeded deterministically.
 */
export async function getRandomSpots(
  supabase: SupabaseClient<Database>,
  filters: SpotQueryFilters = {},
  count: number = 10,
  seed?: string
): Promise<SupabaseSpotRow[]> {
  // Fetch all matching spot_ids (lightweight)
  const query = supabase.from('spots').select('spot_id')

  // Re-apply filters on the id-only query
  let q = query
  if (filters.street) q = q.eq('street', filters.street)
  if (filters.hero_position) q = q.eq('hero_position', filters.hero_position)
  if (filters.hero_positions && filters.hero_positions.length > 0) {
    q = q.in('hero_position', filters.hero_positions)
  }
  if (filters.villain_position) q = q.eq('villain_position', filters.villain_position)
  if (filters.pot_type && filters.pot_type !== 'ANY') q = q.eq('pot_type', filters.pot_type)
  if (filters.pot_types && filters.pot_types.length > 0) {
    const nonAny = filters.pot_types.filter((pt) => pt !== 'ANY')
    if (nonAny.length > 0 && nonAny.length === filters.pot_types.length) {
      q = q.in('pot_type', nonAny)
    }
  }
  if (filters.effective_stack_bb_min !== undefined) q = q.gte('effective_stack_bb', filters.effective_stack_bb_min)
  if (filters.effective_stack_bb_max !== undefined) q = q.lte('effective_stack_bb', filters.effective_stack_bb_max)
  if (filters.scenario_type && filters.scenario_type !== 'ANY') q = q.eq('scenario_type', filters.scenario_type)
  if (filters.tags && filters.tags.length > 0) q = q.overlaps('tags', filters.tags)
  if (filters.is_system !== undefined) q = q.eq('is_system', filters.is_system)

  const { data: ids, error: idsError } = await q

  if (idsError) {
    throw new Error(`Failed to fetch spot IDs: ${idsError.message}`)
  }

  if (!ids || ids.length === 0) return []

  // Deterministic shuffle using seed
  const spotIds = ids.map((r) => r.spot_id)
  const shuffled = deterministicShuffle(spotIds, seed ?? 'default')
  const selected = shuffled.slice(0, count)

  // Fetch full rows for selected IDs
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .in('spot_id', selected)

  if (error) {
    throw new Error(`Failed to fetch random spots: ${error.message}`)
  }

  // Re-order to match shuffled order
  const byId = new Map((data ?? []).map((row) => [row.spot_id, row]))
  return selected.map((id) => byId.get(id)).filter(Boolean) as SupabaseSpotRow[]
}

/**
 * Insert a new spot (user-created).
 */
export async function createSpot(
  supabase: SupabaseClient<Database>,
  spotData: SpotInsert
): Promise<SupabaseSpotRow> {
  const { data, error } = await supabase
    .from('spots')
    .insert(spotData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create spot: ${error.message}`)
  }

  return data
}

// ---------------------------------------------------------------------------
// Conversion: Supabase row <-> engine Spot
// ---------------------------------------------------------------------------

/**
 * Convert a Supabase spots row to the engine Spot type.
 */
export function convertSupabaseSpotToEngineSpot(row: SupabaseSpotRow): EngineSpot {
  return {
    schemaVersion: '1',
    spotId: row.spot_id,
    gameType: 'NLHE',
    blinds: {
      sb: 0.5,
      bb: 1,
      ante: 0,
    },
    positions: row.positions as Position[],
    stacksBb: row.stacks_bb as unknown as Record<Position, number>,
    potBb: row.pot_bb,
    board: row.board,
    history: row.history,
    heroToAct: row.hero_to_act as Position,
  }
}

/**
 * Extract SpotMeta from a Supabase row.
 */
export function extractSpotMeta(row: SupabaseSpotRow): SpotMeta {
  return {
    street: row.street as Street,
    heroPosition: row.hero_position as Position,
    villainPosition: (row.villain_position ?? row.hero_position) as Position,
    effectiveStackBb: row.effective_stack_bb,
    potType: row.pot_type as PotType,
    scenarioType: row.scenario_type as PreflopScenarioType | undefined,
  }
}

/**
 * Convert an engine Spot + SpotMeta to a Supabase insert row.
 * Used by the seed script to transform bundled pack data into DB rows.
 */
export function convertEngineSpotToSupabaseRow(
  spot: EngineSpot,
  meta: SpotMeta,
  options: {
    is_system?: boolean
    tags?: string[]
    created_by?: string | null
  } = {}
): SpotInsert {
  return {
    spot_id: spot.spotId,
    street: meta.street,
    hero_position: meta.heroPosition,
    villain_position: meta.villainPosition,
    hero_to_act: spot.heroToAct,
    positions: spot.positions,
    stacks_bb: spot.stacksBb as unknown as Database['public']['Tables']['spots']['Insert']['stacks_bb'],
    pot_bb: spot.potBb,
    effective_stack_bb: meta.effectiveStackBb,
    pot_type: meta.potType,
    scenario_type: meta.scenarioType ?? null,
    board: spot.board,
    history: spot.history,
    is_system: options.is_system ?? false,
    tags: options.tags ?? generateTags(spot, meta),
    created_by: options.created_by ?? null,
  }
}

// ---------------------------------------------------------------------------
// Tag generation
// ---------------------------------------------------------------------------

/**
 * Generate descriptive tags for a spot based on its properties.
 * Tags enable flexible filtering beyond the structured columns.
 */
export function generateTags(spot: EngineSpot, meta: SpotMeta): string[] {
  const tags: string[] = []

  // Street tag
  tags.push(meta.street.toLowerCase())

  // Position tags
  tags.push(`hero:${meta.heroPosition}`)
  tags.push(`villain:${meta.villainPosition}`)

  // Pot type tag
  tags.push(meta.potType.toLowerCase())

  // Scenario type tag (preflop only)
  if (meta.scenarioType) {
    tags.push(`scenario:${meta.scenarioType.toLowerCase()}`)
  }

  // Stack depth category
  const stackBb = meta.effectiveStackBb
  if (stackBb <= 25) tags.push('short-stack')
  else if (stackBb <= 50) tags.push('mid-stack')
  else if (stackBb <= 100) tags.push('deep-stack')
  else tags.push('ultra-deep')

  // Board texture tags (postflop only)
  if (spot.board.length >= 3) {
    tags.push('postflop')
    if (hasPairedBoard(spot.board)) tags.push('paired-board')
    if (hasFlushDraw(spot.board)) tags.push('flush-draw')
  } else {
    tags.push('preflop')
  }

  return tags
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple seeded PRNG (mulberry32) for deterministic shuffling.
 */
function seedToNumber(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash)
}

function mulberry32(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function deterministicShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr]
  const rng = mulberry32(seedToNumber(seed))
  // Fisher-Yates shuffle with seeded RNG
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function hasPairedBoard(board: string[]): boolean {
  const ranks = board.map((c) => c[0])
  return new Set(ranks).size < ranks.length
}

function hasFlushDraw(board: string[]): boolean {
  const suits: Record<string, number> = {}
  for (const card of board) {
    const suit = card[1]
    suits[suit] = (suits[suit] ?? 0) + 1
    if (suits[suit] >= 3) return true
  }
  return false
}
