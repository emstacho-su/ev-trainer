---
phase: "08"
plan: "01"
subsystem: "statistics-api"
tags: ["prisma", "aggregation", "express", "stats", "api"]
dependency-graph:
  requires: ["02-backend-foundation", "03-authentication"]
  provides: ["stats-api-routes", "prisma-aggregation-queries", "stats-types"]
  affects: ["08-02 through 08-07 (dashboard UI plans)"]
tech-stack:
  added: []
  patterns: ["server-side Prisma groupBy aggregation", "date-range filtered stats queries", "ownership-verified deletion"]
key-files:
  created:
    - "src/lib/stats/types.ts"
    - "src/lib/stats/aggregation.ts"
    - "src/server/routes/stats.routes.ts"
    - "src/server/controllers/stats.controller.ts"
    - "prisma/migrations/20260217052530_add_stats_indexes/migration.sql"
  modified:
    - "prisma/schema.prisma"
    - "src/server/index.ts"
decisions:
  - id: "08-01-01"
    description: "Server-side Prisma groupBy for all stats aggregation (no client-side reduce)"
  - id: "08-01-02"
    description: "20-hand threshold for position stat confidence flag"
  - id: "08-01-03"
    description: "Granularity auto-detection: session (<7d), day (<90d), week (>90d)"
  - id: "08-01-04"
    description: "Biggest mistakes sorted by absolute EV diff descending, top 5"
metrics:
  duration: "3 min"
  completed: "2026-02-17"
---

# Phase 8 Plan 01: Stats API with Prisma Aggregation Summary

Server-side statistics API with Prisma groupBy aggregation for DailyStat, SpotStat, and Session tables with database indexes for query performance.

## What Was Done

### Task 1: Define stats types and interfaces
- Created `src/lib/stats/types.ts` with all TypeScript interfaces
- PerformanceDataPoint, PositionStat, SessionSummary, SessionDetail
- StatsFilters for date range and position filtering
- API response types: PerformanceStatsResponse, PositionStatsResponse, SessionHistoryResponse
- Commit: `9b1e214`

### Task 2: Add database indexes for aggregation performance
- Added `@@index([userId, lastPracticed])` to SpotStat for date range filtering
- Added `@@index([userId, heroPosition])` to SpotStat for position groupBy queries
- DailyStat already had `@@index([userId, date])`
- Created migration `20260217052530_add_stats_indexes`
- Commit: `7cc05ea`

### Task 3: Implement Prisma aggregation queries
- Created `src/lib/stats/aggregation.ts` with 5 query functions
- getDailyStats: queries DailyStat with date range filter
- getPositionBreakdown: SpotStat groupBy heroPosition/villainPosition with confidence flag
- getSessionList: paginated session history with entry-level accuracy/EV computation
- getSessionDetail: full session with entries and biggest mistakes (top 5 by EV diff)
- deleteUserSession: ownership-verified deletion with cascade
- Commit: `e08a122`

### Task 4: Create stats API routes and controllers
- 5 endpoints mounted at /api/stats with requireAuth
- GET /performance - daily metrics with auto-detected granularity
- GET /positions - position breakdown with low-confidence threshold
- GET /sessions - paginated history (default 20, max 100)
- GET /sessions/:id - session detail with entries and mistakes
- DELETE /sessions/:id - ownership-verified deletion
- Date range filtering defaults to last 30 days
- Mounted in src/server/index.ts
- Commit: `37794a3`

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 08-01-01 | Server-side Prisma groupBy for all aggregation | Scalability - prevents N+1 and client-side memory issues |
| 08-01-02 | 20-hand confidence threshold for position stats | Standard statistical minimum for meaningful percentages |
| 08-01-03 | Auto granularity: session/day/week based on range | Optimal chart density without user configuration |
| 08-01-04 | Top 5 biggest mistakes by absolute EV diff | Actionable feedback - shows highest-impact leaks |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Express 5.x params type handling**
- **Found during:** Task 4
- **Issue:** `req.params.sessionId` is `string | string[]` in Express 5.x, not just `string`
- **Fix:** Added `typeof sessionIdParam === "string"` guard matching existing session controller pattern
- **Files modified:** `src/server/controllers/stats.controller.ts`

**2. [Rule 2 - Missing Critical] Added heroPosition index**
- **Found during:** Task 2
- **Issue:** Position stats groupBy queries would be slow without index on heroPosition
- **Fix:** Added `@@index([userId, heroPosition])` to SpotStat
- **Files modified:** `prisma/schema.prisma`

## Next Phase Readiness

Stats API is ready for dashboard UI consumption in plans 08-02 through 08-07. All response types are exported for frontend type imports.
