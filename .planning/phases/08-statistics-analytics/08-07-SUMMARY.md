---
phase: 08-statistics-analytics
plan: 07
subsystem: stats-flagged-hands
tags: [prisma, api, react, flagged-hands, bookmarking]
depends_on:
  requires: ["08-05"]
  provides: ["flagged-hands-feature", "flag-toggle-api", "flagged-hands-list"]
  affects: []
tech-stack:
  added: []
  patterns: ["optimistic-ui-removal", "toggle-api-pattern"]
key-files:
  created:
    - prisma/migrations/20260217053945_add_flagged_hands/migration.sql
    - src/app/stats/components/FlaggedHandsList.tsx
  modified:
    - prisma/schema.prisma
    - src/server/routes/stats.routes.ts
    - src/server/controllers/stats.controller.ts
    - src/lib/stats/aggregation.ts
    - src/lib/stats/types.ts
    - src/app/stats/components/SessionHistory.tsx
    - src/app/stats/page.tsx
decisions:
  - id: "08-07-01"
    decision: "Toggle API pattern for flag (PATCH toggles, not separate PUT true/false)"
    rationale: "Simpler API, single endpoint, server-side state management"
  - id: "08-07-02"
    decision: "Optimistic local state removal on unflag in FlaggedHandsList"
    rationale: "Instant UI feedback consistent with session delete pattern from 08-05"
metrics:
  duration: "4 min"
  completed: "2026-02-17"
---

# Phase 8 Plan 7: Flagged Hands Feature Summary

**One-liner:** Flag/unflag hands during session review with dedicated Flagged tab showing all bookmarked hands.

## What Was Done

### Task 1: Add isFlagged field to SessionEntry schema
- Added `isFlagged Boolean @default(false)` to SessionEntry model
- Added composite index `@@index([sessionId, isFlagged])` for efficient queries
- Ran Prisma migration `add_flagged_hands`

### Task 2: Create API endpoints for flag toggle and flagged list
- `PATCH /api/stats/sessions/:sessionId/entries/:entryIndex/flag` - toggles isFlagged
- `GET /api/stats/flagged` - returns all flagged entries with session context
- Session ownership verified before flag operations
- Added `toggleEntryFlag` and `getFlaggedEntries` to aggregation layer
- Added `FlaggedEntry` type and `isFlagged` to `SessionEntryDetail`
- Updated `getSessionDetail` to include isFlagged in entry selection

### Task 3: Add flag buttons to SessionHistory expanded view
- Replaced `SessionMistakes` with `SessionEntries` showing all hands with flag buttons
- Each entry row has star toggle: filled yellow star (flagged) / outline star (unflagged)
- Flag state updates locally on API response
- Biggest mistakes section preserved below all hands table

### Task 4: Create FlaggedHandsList component
- Fetches from `GET /api/stats/flagged`
- Displays: session date, hand number, spot, action, result grade, EV loss
- Unflag button removes entry from list optimistically
- Empty state guides user to flag hands from session review
- Dark theme consistent with other stats components

### Task 5: Integrate FlaggedHandsList into stats page
- Added "Flagged" as fourth tab in tab navigation
- Renders FlaggedHandsList with Suspense/TableSkeleton fallback

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 6783d67 | feat(08-07): add isFlagged field to SessionEntry schema |
| 2 | a12615b | feat(08-07): add toggle flag and get flagged hands API endpoints |
| 3 | cf1e1b3 | feat(08-07): add flag buttons to SessionHistory expanded view |
| 4 | 8951ce0 | feat(08-07): create FlaggedHandsList component |
| 5 | 711664b | feat(08-07): integrate FlaggedHandsList as fourth tab on stats page |

## Next Phase Readiness

Phase 8 (Statistics & Analytics) is now complete with all 7 plans done. No blockers for subsequent phases.
