/**
 * Seeds the Supabase spots table from bundled pack JSON files.
 *
 * Usage: npx tsx scripts/seedSpots.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable to bypass RLS.
 * Also requires NEXT_PUBLIC_SUPABASE_URL.
 *
 * The script:
 * 1. Reads all pack JSON files from public/packs/
 * 2. Converts each spot entry to a Supabase row
 * 3. Upserts into the spots table (ON CONFLICT on spot_id DO UPDATE)
 * 4. Sets is_system = true for all seeded spots
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase.types'
import type { SpotInsert } from '../src/lib/supabase/types'

// We import from the engine/pack modules using relative paths since
// this script runs outside Next.js (no path aliases)
import type { Spot as EngineSpot } from '../src/lib/engine/spot'
import type { Position, Street } from '../src/lib/engine/types'
import type { PotType, SpotMeta, SpotEntry, SpotPack } from '../src/lib/v2/packs/spotPack'
import type { PreflopScenarioType } from '../src/lib/v2/packs/scenarioClassifier'

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`ERROR: Missing required environment variable: ${name}`)
    console.error('Set it in .env.local or pass it directly:')
    console.error(`  ${name}=... npx tsx scripts/seedSpots.ts`)
    process.exit(1)
  }
  return value
}

// ---------------------------------------------------------------------------
// Tag generation (duplicated from spotService to avoid path alias issues)
// ---------------------------------------------------------------------------

function generateTags(spot: EngineSpot, meta: SpotMeta): string[] {
  const tags: string[] = []

  tags.push(meta.street.toLowerCase())
  tags.push(`hero:${meta.heroPosition}`)
  tags.push(`villain:${meta.villainPosition}`)
  tags.push(meta.potType.toLowerCase())

  if (meta.scenarioType) {
    tags.push(`scenario:${meta.scenarioType.toLowerCase()}`)
  }

  const stackBb = meta.effectiveStackBb
  if (stackBb <= 25) tags.push('short-stack')
  else if (stackBb <= 50) tags.push('mid-stack')
  else if (stackBb <= 100) tags.push('deep-stack')
  else tags.push('ultra-deep')

  if (spot.board.length >= 3) {
    tags.push('postflop')
    const ranks = spot.board.map((c) => c[0])
    if (new Set(ranks).size < ranks.length) tags.push('paired-board')
    const suits: Record<string, number> = {}
    for (const card of spot.board) {
      const suit = card[1]
      suits[suit] = (suits[suit] ?? 0) + 1
      if (suits[suit] >= 3) tags.push('flush-draw')
    }
  } else {
    tags.push('preflop')
  }

  return [...new Set(tags)] // deduplicate
}

// ---------------------------------------------------------------------------
// Scenario classification (duplicated to avoid path alias)
// ---------------------------------------------------------------------------

function classifyPreflopScenario(spot: EngineSpot): PreflopScenarioType | null {
  if (spot.board.length > 0) return null
  const { history, heroToAct } = spot
  if ((heroToAct === 'SB' || heroToAct === 'BB') && history.length >= 1) return 'BlindDefense'
  if (history.length === 2) return '3Bet'
  if (history.length === 1) return 'FacingOpen'
  if (history.length === 0) return 'RFI'
  return null
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

function spotEntryToSupabaseRow(entry: SpotEntry): SpotInsert {
  const { spot, meta } = entry

  // Enrich scenario type if not already set
  const scenarioType = meta.scenarioType ?? classifyPreflopScenario(spot) ?? undefined

  const enrichedMeta: SpotMeta = { ...meta, scenarioType }
  const tags = generateTags(spot, enrichedMeta)

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
    scenario_type: scenarioType ?? null,
    board: spot.board,
    history: spot.history,
    is_system: true,
    tags,
    created_by: null,
  }
}

// ---------------------------------------------------------------------------
// Pack loading (minimal parsing -- no full validation for seed speed)
// ---------------------------------------------------------------------------

function loadPackFile(filePath: string): SpotPack {
  const raw = readFileSync(filePath, 'utf-8')
  const json = JSON.parse(raw) as SpotPack
  return json
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('--- Spot Seeder ---')
  console.log('')

  // Load env from .env.local if available (dotenv)
  try {
    const dotenv = await import('dotenv')
    dotenv.config({ path: resolve(process.cwd(), '.env.local') })
    dotenv.config({ path: resolve(process.cwd(), '.env') })
  } catch {
    // dotenv not available, rely on env vars being set
  }

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  // Create admin client with service role key (bypasses RLS)
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Find all pack JSON files
  const packsDir = resolve(process.cwd(), 'public/packs')
  const packFiles = readdirSync(packsDir).filter((f) => f.endsWith('.json'))

  if (packFiles.length === 0) {
    console.log('No pack files found in public/packs/')
    return
  }

  console.log(`Found ${packFiles.length} pack file(s):`)
  packFiles.forEach((f) => console.log(`  - ${f}`))
  console.log('')

  let totalInserted = 0
  let totalSkipped = 0

  for (const file of packFiles) {
    const filePath = resolve(packsDir, file)
    console.log(`Processing: ${file}`)

    const pack = loadPackFile(filePath)
    console.log(`  Pack: ${pack.name} (${pack.spots.length} spots)`)

    // Convert all spots to Supabase rows
    const rows = pack.spots.map((entry) => spotEntryToSupabaseRow(entry))

    // Upsert in batches of 50
    const BATCH_SIZE = 50
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)

      const { data, error } = await supabase
        .from('spots')
        .upsert(batch, {
          onConflict: 'spot_id',
          ignoreDuplicates: false,
        })
        .select('spot_id')

      if (error) {
        console.error(`  ERROR in batch ${i / BATCH_SIZE + 1}: ${error.message}`)
        totalSkipped += batch.length
        continue
      }

      totalInserted += data?.length ?? 0
      process.stdout.write(`  Upserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`)
    }

    console.log(`  Done: ${rows.length} spots processed`)
  }

  console.log('')
  console.log('--- Summary ---')
  console.log(`Total upserted: ${totalInserted}`)
  if (totalSkipped > 0) {
    console.log(`Total skipped (errors): ${totalSkipped}`)
  }
  console.log('Seeding complete!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
