---
phase: 12-dashboard-training-popout
plan: 03
subsystem: ui
tags: [next.js, routing, navigation, redirect]

# Dependency graph
requires:
  - phase: 12-01
    provides: Dashboard page at / with DrillSuggestions and TrainingConfigDialog
  - phase: 12-02
    provides: Training page at /training with embedded session loop
provides:
  - Updated AppHeader with Dashboard, Training, Stats nav links
  - All /lobby references replaced with / or /training
  - Backward-compatible /lobby redirect to /
affects: [12-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side redirect for backward compat (next/navigation redirect)"
    - "Root path isActive check with exact match to avoid false positives"

key-files:
  created: []
  modified:
    - src/components/AppHeader.tsx
    - src/app/lobby/page.tsx
    - src/app/session/[id]/page.tsx
    - src/app/summary/[id]/page.tsx
    - src/app/stats/page.tsx
    - src/app/stats/components/WeaknessBreakdown.tsx
    - src/app/signup/page.tsx
    - src/app/review/[id]/page.tsx

key-decisions:
  - "AppHeader hides on /training in addition to /session/ pages"
  - "Root path isActive uses exact match (pathname === '/') to avoid all routes highlighting Dashboard"
  - "WeaknessBreakdown drill navigation goes to /training (not /) since it starts a training session"
  - "Summary page 'New session' links to /training, 'Back' links to / (dashboard)"

patterns-established:
  - "Server-side redirect pattern: import redirect from next/navigation, no 'use client'"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 12 Plan 03: Lobby Reference Migration & AppHeader Nav Update Summary

**Replaced all /lobby navigation with dashboard (/) and training (/training) routes, updated AppHeader with 3-link nav, added backward-compat redirect**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T17:00:06Z
- **Completed:** 2026-02-17T17:04:08Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- AppHeader now shows Dashboard, Training, and Stats navigation links
- All /lobby hrefs across 7 files replaced with / or /training as appropriate
- Lobby page converted to server-side redirect for backward compatibility
- Root path isActive check prevents false positives on all sub-routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Update AppHeader navigation** - `89f3c62` (feat)
2. **Task 2: Update all /lobby references + backward compat redirect** - `b956e35` (feat)

## Files Created/Modified
- `src/components/AppHeader.tsx` - Nav links: Dashboard (/), Training (/training), Stats (/stats); hides on /training; root path isActive fix
- `src/app/lobby/page.tsx` - Converted from TrainerLobby render to server-side redirect to /
- `src/app/session/[id]/page.tsx` - Back link and delete-session push changed from /lobby to /
- `src/app/summary/[id]/page.tsx` - Back link to /, New session link to /training
- `src/app/stats/page.tsx` - Back link from /lobby to /
- `src/app/stats/components/WeaknessBreakdown.tsx` - Drill navigation from /lobby to /training
- `src/app/signup/page.tsx` - Post-registration redirect from /lobby to /
- `src/app/review/[id]/page.tsx` - Back link from /lobby to /

## Decisions Made
- AppHeader hides on /training pages to avoid distraction during active training sessions
- Root path (/) uses exact match for isActive to prevent every page from highlighting Dashboard
- WeaknessBreakdown drill goes to /training (not /) since it initiates a training session with filters
- Summary page "New session" goes to /training, "Back" goes to / (dashboard) -- different destinations for different intents
- Login page already had correct default redirect to '/' -- no change needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All routing restructure complete (plans 01, 02, 03)
- Ready for plan 04 (final cleanup/polish if applicable)
- No blockers or concerns

---
*Phase: 12-dashboard-training-popout*
*Completed: 2026-02-17*
