/**
 * Overview: Loads spots from Supabase (primary) or bundled JSON packs (fallback).
 * Interacts with: Supabase spotService, filesystem pack parser/validator.
 * Importance: Unified spot loading for v2 session flows with Supabase-first strategy.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SpotPack, SpotEntry } from "./spotPack";
import { parseSpotPack } from "./spotPack";
import type { SpotFilterInput } from "../filters/spotFilters";
import { filterSpotEntries } from "../filters/spotFilters";
import {
  getFilteredSpots,
  convertSupabaseSpotToEngineSpot,
  extractSpotMeta,
  type SpotQueryFilters,
} from "@/lib/supabase/spotService";

// ---------------------------------------------------------------------------
// Bundled pack loading (filesystem fallback)
// ---------------------------------------------------------------------------

const PACK_PATH = "public/packs/ev-dev-pack-v1.json";
let cachedPack: SpotPack | null = null;

export function loadBundledPack(): SpotPack {
  if (cachedPack) return cachedPack;
  const packPath = resolve(process.cwd(), PACK_PATH);
  const raw = readFileSync(packPath, "utf-8");
  const json = JSON.parse(raw) as unknown;
  cachedPack = parseSpotPack(json);
  return cachedPack;
}

export function clearBundledPackCache(): void {
  cachedPack = null;
}

// ---------------------------------------------------------------------------
// Supabase spot loading
// ---------------------------------------------------------------------------

/**
 * Convert SpotFilterInput (used by UI/session code) to SpotQueryFilters
 * (used by the Supabase spotService).
 */
function toSupabaseFilters(filters: SpotFilterInput): SpotQueryFilters {
  const q: SpotQueryFilters = {}

  if (filters.street) q.street = filters.street
  if (filters.heroPosition) q.hero_position = filters.heroPosition
  if (filters.heroPositions && filters.heroPositions.length > 0) {
    q.hero_positions = filters.heroPositions
  }
  if (filters.villainPosition) q.villain_position = filters.villainPosition
  if (filters.potType && filters.potType !== "ANY") {
    q.pot_type = filters.potType
  }
  if (filters.potTypes && filters.potTypes.length > 0) {
    q.pot_types = filters.potTypes
  }
  if (filters.scenarioType && filters.scenarioType !== "ANY") {
    q.scenario_type = filters.scenarioType
  }

  // Stack bucket -> min/max range
  if (filters.effectiveStackBbBucket) {
    const bucket = filters.effectiveStackBbBucket
    if (bucket === "20") { q.effective_stack_bb_min = 0; q.effective_stack_bb_max = 20 }
    else if (bucket === "40") { q.effective_stack_bb_min = 21; q.effective_stack_bb_max = 40 }
    else if (bucket === "60") { q.effective_stack_bb_min = 41; q.effective_stack_bb_max = 60 }
    else if (bucket === "100") { q.effective_stack_bb_min = 61; q.effective_stack_bb_max = 100 }
    else if (bucket === "150+") { q.effective_stack_bb_min = 101 }
  }

  // Default: only system spots from Supabase
  q.is_system = true

  return q
}

/**
 * Load spots from Supabase, converting rows to SpotEntry format.
 * Returns entries compatible with the existing session/filter infrastructure.
 */
export async function loadSpotsFromSupabase(
  supabase: SupabaseClient<Database>,
  filters: SpotFilterInput = {}
): Promise<SpotEntry[]> {
  const supabaseFilters = toSupabaseFilters(filters)
  const rows = await getFilteredSpots(supabase, supabaseFilters)

  return rows.map((row) => ({
    spot: convertSupabaseSpotToEngineSpot(row),
    meta: extractSpotMeta(row),
  }))
}

// ---------------------------------------------------------------------------
// Unified loader: Supabase-first, bundled fallback
// ---------------------------------------------------------------------------

/**
 * Load spots with Supabase as primary source, falling back to bundled packs.
 *
 * When a Supabase client is provided:
 * 1. Try loading from Supabase with filters applied server-side
 * 2. If Supabase fails or returns empty, fall back to bundled pack
 *
 * When no Supabase client is provided (guests, development):
 * - Load from bundled pack directly and apply filters client-side
 */
export async function loadSpots(
  filters: SpotFilterInput = {},
  supabase?: SupabaseClient<Database>
): Promise<SpotEntry[]> {
  // Supabase-first when client is available
  if (supabase) {
    try {
      const entries = await loadSpotsFromSupabase(supabase, filters)
      if (entries.length > 0) {
        return entries
      }
      // Supabase returned empty -- fall through to bundled
    } catch {
      // Supabase error -- fall through to bundled pack
    }
  }

  // Bundled pack fallback
  const pack = loadBundledPack()
  return filterSpotEntries(pack.spots, filters)
}
