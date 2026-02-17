---
phase: 09-animations
plan: 05
subsystem: ui
tags: [motion, animation, audio, web-audio, chip-animation, sound-effects]

requires:
  - phase: 09-01
    provides: "Motion library setup, ANIM/EASE constants"
  - phase: 09-04
    provides: "useAudio hook, audioManager, SoundName types"
  - phase: 04-05
    provides: "PokerTable with bet chip rendering and z-index layering"
  - phase: 05-03
    provides: "PreflopTrainingSession with state machine and keyboard handlers"
provides:
  - "Animated chip bets with Motion AnimatePresence in PokerTable"
  - "Sound effects wired to card deal, chip slide, and EV reveal events"
affects: [09-06, 09-07]

tech-stack:
  added: []
  patterns:
    - "AnimatePresence wrapping dynamic bet chip list for enter/exit animations"
    - "playSoundRef pattern for stable sound calls in keyboard event handlers"

key-files:
  created: []
  modified:
    - src/components/poker/organisms/PokerTable.tsx
    - src/components/training/PreflopTrainingSession.tsx

key-decisions:
  - "Chip animate in with scale+opacity (CHIP_SLIDE 250ms), exit with CHIP_COLLECT 300ms"
  - "playSoundRef used in keyboard handler to avoid stale closure over playSound"
  - "playSound added to useCallback dependency arrays for handleStart, handleSubmitAction, handleNext"

patterns-established:
  - "playSoundRef pattern: ref updated on every render, used in event listeners with empty deps"

duration: 2min
completed: 2026-02-17
---

# Phase 9 Plan 5: Chip Animation & Sound Effects Summary

**Animated chip bets with Motion scale+opacity transitions; sound effects wired to card deal, chip slide, and EV reveal in PreflopTrainingSession**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T05:32:13Z
- **Completed:** 2026-02-17T05:34:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Bet chips animate in with scale+opacity using motion.div inside AnimatePresence
- Chips exit with CHIP_COLLECT duration when bets are removed
- Sound effects wired at all 3 call-sites: card-deal, chip-slide, ev-correct/ev-incorrect
- Both regular handlers and inline keyboard handlers play sounds correctly via playSoundRef

## Task Commits

Each task was committed atomically:

1. **Task 1: Animate chip bets in PokerTable** - `afa69c5` (feat)
2. **Task 2: Wire sound effects into PreflopTrainingSession** - `ba29a8b` (feat)

## Files Created/Modified
- `src/components/poker/organisms/PokerTable.tsx` - Added motion/AnimatePresence imports, wrapped bet chips with animated motion.div
- `src/components/training/PreflopTrainingSession.tsx` - Imported useAudio, added playSoundRef, wired playSound at card-deal/chip-slide/ev-reveal sites

## Decisions Made
- Used playSoundRef pattern (ref updated every render) for keyboard handler to avoid stale closure, matching existing ref-based pattern in the component
- Added playSound to useCallback dependency arrays for handleStart, handleSubmitAction, handleNext to satisfy React exhaustive-deps

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Chip animations and sound effects complete
- Ready for 09-06 (settings/preferences UI) and 09-07 (final polish)

---
*Phase: 09-animations*
*Completed: 2026-02-17*
