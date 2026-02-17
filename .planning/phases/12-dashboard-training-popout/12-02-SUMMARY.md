---
phase: 12-dashboard-training-popout
plan: 02
subsystem: ui
tags: [react, next.js, poker-table, training-loop, dialog, state-machine]

# Dependency graph
requires:
  - phase: 12-01
    provides: TrainingConfigDialog component, dashboard home page
  - phase: 05-preflop-training
    provides: session loop handlers (submit/next), keyboard shortcuts, session API client
  - phase: 04-table-ui-foundation
    provides: PokerTable, ActionPanel, PlayerSeat components
provides:
  - "/training page with embedded preflop training loop and config dialog overlay"
  - "Inline session start (no route change from /training)"
  - "Mid-session config reopening with locked session-level fields"
affects: [12-03, 12-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State machine pattern: CONFIGURING -> TRAINING -> summary redirect"
    - "Inline session start: fetch /api/session/start then set state (no router.push)"
    - "Config dialog overlay on PokerTable background"
    - "Suspense wrapper for useSearchParams SSR compatibility"

key-files:
  created:
    - src/app/training/page.tsx
  modified: []

key-decisions:
  - "12-02: Suspense wrapper around TrainingPage for useSearchParams SSR compatibility"
  - "12-02: Postflop mode redirects to /postflop-training (stays separate this phase)"
  - "12-02: Back arrow links to / (dashboard) not /lobby"
  - "12-02: ActionPanel shown in both idle/submitted and revealed states (separate render blocks)"

patterns-established:
  - "Inline session start: page creates session via API and updates local state without navigation"
  - "Config dialog overlay: native dialog over PokerTable background with locked fields when session active"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 12 Plan 02: Training Page with Embedded Session Loop Summary

**Full /training page combining PokerTable background, TrainingConfigDialog overlay, and inline preflop session loop with no route change on session start**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T16:55:09Z
- **Completed:** 2026-02-17T16:59:00Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments
- Training page at /training with full state machine: CONFIGURING -> TRAINING -> summary redirect
- Config dialog auto-opens over empty PokerTable background on page load
- Inline session start via fetch POST to /api/session/start (no route change)
- Mid-session gear icon reopens config dialog with mode/gameType/tableSize/stackDepth locked
- Full training flow: submit action -> 500ms reveal delay -> next hand -> session complete -> /summary redirect
- Keyboard shortcuts (1-5 for actions, Space/Enter for next hand)
- URL params support for drill suggestions (heroPosition pre-applied to config)
- Range visualization modal integration (View Ranges button in revealed state)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /training page with embedded training loop** - `89166e1` (feat)

## Files Created/Modified
- `src/app/training/page.tsx` - Full 790-line training page combining session loop with config dialog overlay, PokerTable background, ActionPanel, keyboard shortcuts, and range modal

## Decisions Made
- Suspense wrapper around TrainingPage for useSearchParams SSR compatibility (Next.js requirement)
- Postflop mode (config.mode === 'FLOP') redirects to /postflop-training rather than being handled inline (separate page for postflop remains this phase)
- Back arrow navigates to "/" (dashboard) instead of "/lobby" to match Phase 12-01 dashboard landing
- ActionPanel rendered in separate blocks for idle/submitted vs revealed states (revealed includes next button and view ranges)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - the training page file was already present as an untracked file from initial planning/scaffolding, reviewed against all plan requirements and verified complete.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Training page ready for integration testing with the dashboard (12-03)
- /training route accessible from dashboard "Start Training" button and drill suggestion links
- Session loop functional end-to-end: config -> start -> submit -> reveal -> next -> summary redirect

---
*Phase: 12-dashboard-training-popout*
*Completed: 2026-02-17*
