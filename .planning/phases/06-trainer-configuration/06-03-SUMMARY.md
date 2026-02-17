---
phase: 06-trainer-configuration
plan: 03
subsystem: ui-configuration
tags: [lobby, config, next-app-router, trainer-setup]
depends_on: [06-01, 06-02]
provides: [lobby-page, trainer-lobby-component, session-start-flow]
affects: [06-04, 06-05, 06-06]
tech-stack:
  added: []
  patterns: [collapsible-details, config-card-layout, session-start-validation]
key-files:
  created:
    - src/app/lobby/page.tsx
    - src/components/config/TrainerLobby.tsx
  modified: []
decisions:
  - Collapsible advanced filters use native HTML details/summary element
  - canStart validation requires both positions and potTypes non-empty
  - Session start POSTs to /api/session/start with crypto.randomUUID() seed
metrics:
  duration: 2 min
  completed: 2026-02-17
---

# Phase 6 Plan 3: Lobby Screen Summary

**Lobby page at /lobby with card-based config layout, collapsible advanced filters, and validated session start button.**

## What Was Done

### Task 1: Create lobby page route
- Created `src/app/lobby/page.tsx` as Next.js App Router client page
- Renders TrainerLobby as main content
- Uses 'use client' directive (interactive page with hooks)
- Commit: `f13d119`

### Task 2: Create TrainerLobby component with config cards and session start
- Created `src/components/config/TrainerLobby.tsx` with full lobby layout
- Integrates useTrainerConfig hook for localStorage persistence
- Essentials card: ModeToggle + GameSetup (game type, table size, stack depth, villain behavior)
- Advanced Filters: collapsible details/summary with PositionFilters and PotTypeFilters in 2-column grid
- Start Training button: validates config (positions + potTypes non-empty), POSTs to /api/session/start, navigates to /session on success
- Loading state while config loads, error display on failure, disabled button when invalid
- Commit: `4ac9ec2`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Native details/summary for collapsible filters | No JS dependency, accessible, semantic HTML |
| canStart = positions.length > 0 && potTypes.length > 0 | Minimum viable validation for session start |
| crypto.randomUUID() for session seed | Browser-native, unique per session |
| 'use client' on page.tsx | Required for hooks (useRouter, useTrainerConfig) |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] File exists at src/app/lobby/page.tsx
- [x] TypeScript typecheck passes (no errors in new files)
- [x] TrainerLobby renders config cards with all sections
- [x] Advanced filters collapsible via details/summary
- [x] Start button disabled when filters invalid
- [x] Validation message shown when canStart is false
- [x] Session start POSTs to /api/session/start and navigates on success

## Next Phase Readiness

No blockers. Lobby screen is ready for:
- 06-04: Sidebar config panel (reuses same filter components)
- 06-05: Config API endpoints
- 06-06: Integration testing
