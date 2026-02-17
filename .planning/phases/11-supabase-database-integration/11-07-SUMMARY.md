---
phase: 11
plan: 07
subsystem: data-layer
tags: [supabase, spot-service, seed-script, data-loading]
depends_on:
  requires: [11-01, 11-02]
  provides: [spot-service, seed-script, unified-spot-loader]
  affects: [11-08, 11-09]
tech_stack:
  added: []
  patterns: [supabase-service-pattern, unified-loader-with-fallback, seeded-prng-shuffle]
key_files:
  created:
    - src/lib/supabase/spotService.ts
    - scripts/seedSpots.ts
  modified:
    - src/lib/v2/packs/loadBundledPack.ts
    - vitest.config.ts
    - package.json
    - .env.example
decisions:
  - Deterministic shuffle using mulberry32 seeded PRNG for reproducible training spot selection
  - Tag generation includes street, position, pot type, scenario, stack depth, and board texture
  - Seed script uses Supabase service role key to bypass RLS for admin-level inserts
  - Unified loader tries Supabase first, falls back to bundled packs silently on error/empty
  - Stack bucket filter converted to min/max range for Supabase query (e.g., "40" -> 21-40)
  - Default is_system=true filter on Supabase queries to only return system spots
metrics:
  duration: 11min
  completed: 2026-02-17
---

# Phase 11 Plan 07: Spot Service & Seed Script Summary

Supabase spot service with filtered queries, deterministic random selection, and engine type conversion; seed script to populate spots table from bundled JSON packs; unified loader with Supabase-first strategy and bundled fallback.

## Tasks Completed

### Task 1: Create spot service and seed script
**Commit:** e438a2e

Created `src/lib/supabase/spotService.ts` with the full spot service API:
- `getFilteredSpots()` - query spots with street, position, pot type, stack range, scenario, tags, is_system filters
- `getSpotById()` - single spot lookup by content-hash spot_id
- `getRandomSpots()` - deterministic random selection using seeded PRNG (mulberry32 + Fisher-Yates shuffle)
- `createSpot()` - insert user-created spots
- `convertSupabaseSpotToEngineSpot()` - DB row to engine Spot type
- `extractSpotMeta()` - DB row to SpotMeta type
- `convertEngineSpotToSupabaseRow()` - engine Spot + SpotMeta to DB insert row
- `generateTags()` - auto-generate descriptive tags for flexible filtering

Created `scripts/seedSpots.ts`:
- Reads all JSON pack files from `public/packs/`
- Converts each spot entry to Supabase row format with is_system=true
- Enriches with scenario type classification and auto-generated tags
- Upserts in batches of 50 (ON CONFLICT on spot_id DO UPDATE)
- Uses service role key to bypass RLS
- Loads env from .env.local/.env via dotenv

Added `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` and `seed:spots` script to `package.json`.

### Task 2: Update pack loader to support Supabase source
**Commit:** 4691617

Updated `src/lib/v2/packs/loadBundledPack.ts` with:
- `loadSpotsFromSupabase()` - queries Supabase and converts rows to SpotEntry format
- `loadSpots()` - unified loader: Supabase-first when client provided, bundled fallback otherwise
- `toSupabaseFilters()` - converts SpotFilterInput to SpotQueryFilters with stack bucket range mapping
- Existing `loadBundledPack()` preserved unchanged as standalone fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @/ path alias to vitest.config.ts**
- **Found during:** Task 2 verification
- **Issue:** `loadBundledPack.ts` now imports from `@/lib/supabase/spotService`, but vitest had no path alias configured, causing all tests importing from loadBundledPack to fail with "Cannot find package @/lib/supabase/spotService"
- **Fix:** Added `resolve.alias` with `@` -> `src/` mapping to `vitest.config.ts`
- **Files modified:** vitest.config.ts
- **Commit:** 4691617

## Verification

- `npx tsc --noEmit` passes with zero errors
- `npm run build` passes (Next.js production build)
- All tests that use loadBundledPack pass (spotCorrectness, sessionLifecycle, determinismReplay, apiSessionContract)
- Seed script was NOT run (requires SUPABASE_SERVICE_ROLE_KEY from user)

## Next Steps

- User provides SUPABASE_SERVICE_ROLE_KEY in .env.local
- Run `npm run seed:spots` to populate spots table
- Plan 11-08 can integrate the unified loader into session handlers
