---
phase: 06-trainer-configuration
plan: 05
subsystem: drill-suggestions
tags: [drill, suggestions, spotstat, api, lobby, session-summary]
depends_on: [06-01, 06-02, 06-03]
provides: [drill-suggestions-api, drill-suggestions-ui, session-summary-screen]
affects: [07, 08]
tech-stack:
  added: []
  patterns: [server-controller-route, prisma-query, client-fetch]
key-files:
  created:
    - src/lib/v2/api/drillSuggestions.ts
    - src/server/controllers/drill.controller.ts
    - src/server/routes/drill.routes.ts
    - src/components/config/DrillSuggestions.tsx
    - src/components/config/SessionSummary.tsx
  modified:
    - src/server/index.ts
    - src/components/config/TrainerLobby.tsx
decisions: []
metrics:
  duration: ~5min
  completed: 2026-02-17
---

# Phase 6 Plan 5: Drill Suggestions Summary

Drill suggestion cards on lobby (top 3 weak spots from SpotStat), session summary screen with Play Again / Back to Lobby actions.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create drill suggestion computation logic | 17abd9a | src/lib/v2/api/drillSuggestions.ts |
| 2 | Create drill suggestions API endpoint | 1ef488e | drill.controller.ts, drill.routes.ts, index.ts |
| 3 | Create DrillSuggestions component for lobby | cb1b264 | DrillSuggestions.tsx |
| 4 | Create SessionSummary screen component | 5a0e633 | SessionSummary.tsx |
| 5 | Integrate DrillSuggestions into TrainerLobby | 76e5786 | TrainerLobby.tsx |

## What Was Built

### Drill Suggestion Engine (drillSuggestions.ts)
- `computeDrillSuggestions(userId)` queries SpotStat for spots with >= 10 decisions
- Sorts by avgEvLoss descending (worst-performing first), returns top 3
- Maps to DrillSuggestion interface with spotLabel, accuracy, avgEvLoss, positions

### API Endpoint (GET /api/drills/suggestions)
- Protected by requireAuth middleware
- Controller delegates to computeDrillSuggestions
- Returns 200 with suggestions array, 401 if unauthenticated, 500 on error
- Mounted in server index alongside session and config routes

### DrillSuggestions Component
- Fetches from /api/drills/suggestions on mount with bearer token
- Four states: loading, guest (401), no data (empty array), suggestions
- Each suggestion is a clickable card showing spot label, accuracy %, and EV loss
- Clicking pre-fills lobby position filters via onSelectDrill callback

### SessionSummary Component
- Displays hands played, accuracy %, and avg EV loss in 3-column stats grid
- Play Again button (primary) and Back to Lobby button (secondary)
- Dark mode support, responsive layout

### TrainerLobby Integration
- Essentials and Drill Suggestions now side-by-side in lg:grid-cols-2 layout
- Clicking a drill suggestion calls updateConfig to pre-fill position filters

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- computeDrillSuggestions queries SpotStat with minimum threshold: YES
- GET /api/drills/suggestions returns suggestions for authenticated users: YES
- DrillSuggestions component fetches and displays top 3 weakest spots: YES
- Clicking drill suggestion pre-fills lobby filters: YES
- SessionSummary component renders stats and action buttons: YES
- TrainerLobby includes DrillSuggestions card: YES
