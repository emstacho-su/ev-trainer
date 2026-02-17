---
phase: 11-supabase-database-integration
plan: 06
subsystem: stats-analytics
tags: [supabase, stats, api-routes, analytics, session-history, flagged-hands, drill-suggestions]
dependency_graph:
  requires: ["11-02", "11-03"]
  provides: ["Stats API routes backed by Supabase", "statsService query module", "drill suggestions endpoint"]
  affects: ["11-08", "11-09"]
tech_stack:
  added: []
  patterns: ["Supabase server client per request", "Cookie-based auth for API routes", "Client-side aggregation for GROUP BY"]
key_files:
  created:
    - src/lib/supabase/statsService.ts
    - src/app/api/stats/performance/route.ts
    - src/app/api/stats/positions/route.ts
    - src/app/api/stats/flagged/route.ts
    - src/app/api/stats/sessions/route.ts
    - src/app/api/stats/sessions/[id]/route.ts
    - src/app/api/stats/sessions/[id]/entries/[index]/flag/route.ts
  modified:
    - src/app/api/stats/route.ts
    - src/app/api/drills/suggestions/route.ts
decisions:
  - "Client-side aggregation for position grouping (Supabase lacks server-side groupBy equivalent to Prisma)"
  - "Cookie-based Supabase auth replaces Bearer token auth (existing Bearer headers harmless but unused)"
  - "Check-then-insert pattern for upserts (Supabase JS client lacks ON CONFLICT INCREMENT syntax)"
  - "Stats page components unchanged -- response shapes preserved exactly"
metrics:
  duration: "8 min"
  completed: "2026-02-17"
---

# Phase 11 Plan 06: Stats Data Layer Rewrite Summary

Supabase statsService with 12 query functions and 8 Next.js API routes replacing all Prisma-based analytics.

## What Was Done

### Task 1: Create Supabase stats service (78cfa67)

Created `src/lib/supabase/statsService.ts` with 12 exported functions:

1. **getDailyStats** -- queries daily_stats with date range, returns PerformanceDataPoint[]
2. **getOverviewStats** -- lifetime totals with 7-day vs previous 7-day trend
3. **getPositionStats** -- spot_stats grouped by hero x villain position (client-side aggregation)
4. **getWeaknessBreakdown** -- worst spots by avg_ev_loss with 10-decision confidence threshold
5. **getSessionHistory** -- paginated training_sessions with embedded session_entries, computes accuracy/duration/scenarioBreakdown per session
6. **getSessionDetail** -- single session with entries and top 5 biggest mistakes
7. **deleteSession** -- ownership-verified session deletion
8. **getFlaggedHands** -- flagged entries joined with session dates
9. **toggleEntryFlag** -- ownership-verified flag toggle
10. **getDrillSuggestions** -- top 5 worst spots for drill recommendations
11. **upsertDailyStats** -- check-then-insert/update daily aggregates
12. **upsertSpotStats** -- check-then-insert/update per-spot running averages

All functions take SupabaseClient<Database> as first parameter. No Prisma imports anywhere.

### Task 2: Create all stats API routes (7a502db)

Created 7 new route files and updated 2 existing ones:

| Route | Methods | Purpose |
|-------|---------|---------|
| /api/stats | GET | Overview stats with lifetime totals |
| /api/stats/performance | GET | Daily time-series metrics for charts |
| /api/stats/positions | GET | Position heatmap data from spot_stats |
| /api/stats/flagged | GET | Flagged hands list with filters |
| /api/stats/sessions | GET | Paginated session history |
| /api/stats/sessions/[id] | GET, DELETE | Session detail and delete |
| /api/stats/sessions/[id]/entries/[index]/flag | PATCH | Toggle entry flag |
| /api/drills/suggestions | GET | Top 5 worst-performing spots |

All routes use Supabase server client with cookie-based auth. Response shapes match exactly what the existing frontend components (PerformanceChart, MetricCards, PositionHeatmap, WeaknessBreakdown, SessionHistory, FlaggedHandsList) expect.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Client-side position grouping | Supabase JS client has no groupBy equivalent; spot_stats rows per user are bounded (< 1000), so client-side Map aggregation is efficient |
| Check-then-insert for upserts | Supabase JS .upsert() cannot express INCREMENT semantics; read-modify-write with existing row check handles running averages correctly |
| Cookie-based auth only | Supabase server client reads auth from cookies via middleware; Bearer tokens from old auth system are ignored but harmless |
| Stats page components unchanged | All API response shapes preserved exactly -- no frontend modifications needed |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- [x] `npm run build` passes with zero errors
- [x] statsService.ts exports all 12 functions
- [x] All functions use Supabase client (not Prisma)
- [x] No Prisma imports in any stats-related files
- [x] All 8 API routes registered and building correctly
- [x] Response shapes match existing frontend component expectations

## Next Phase Readiness

Plan 11-08 (Prisma removal and cleanup) can proceed -- stats queries are fully migrated to Supabase. The old Prisma-based files (`src/lib/stats/aggregation.ts`, `src/server/controllers/stats.controller.ts`, `src/lib/v2/api/drillSuggestions.ts`) are no longer used by any API route and can be safely removed.
