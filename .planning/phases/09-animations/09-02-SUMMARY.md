---
phase: 09-animations
plan: 02
subsystem: ui
tags: [motion, animation, 3d-flip, card-deal, poker-ui]

requires:
  - phase: 09-01
    provides: Motion library, ANIM/EASE constants, AnimationProvider
  - phase: 04-02
    provides: Card and CardBack atoms with size variants
  - phase: 04-03
    provides: PlayerSeat molecule with hero/villain rendering
provides:
  - AnimatedCard atom with deal entry, 3D flip, and muck animations
  - PlayerSeat updated to use AnimatedCard for all card rendering
affects: [09-03, 09-05, 09-06]

tech-stack:
  added: []
  patterns: [3D CSS flip with perspective/backfaceVisibility, motion.div orchestration for sequential animations]

key-files:
  created: [src/components/poker/atoms/AnimatedCard.tsx]
  modified: [src/components/poker/molecules/PlayerSeat.tsx]

key-decisions:
  - "Perspective 600px on parent wrapper for 3D flip depth"
  - "Sequential deal+flip: flip starts after CARD_DEAL delay completes"
  - "Muck animation reuses TABLE_RESET timing constant"

patterns-established:
  - "AnimatedCard wraps Card/CardBack: all card rendering goes through AnimatedCard for consistent animation"
  - "3D flip pattern: perspective wrapper > motion.div with rotateY > two absolute-positioned faces with backfaceVisibility hidden"

duration: 1min
completed: 2026-02-17
---

# Phase 9 Plan 2: Card Deal and Flip Animation Summary

**AnimatedCard component with deal entry (opacity+scale), 3D Y-axis flip for hero cards, and muck animation for folded state**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-17T05:28:16Z
- **Completed:** 2026-02-17T05:29:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created AnimatedCard atom with deal entry animation (opacity 0->1, scale 0.3->1)
- Implemented 3D Y-axis card flip using CSS perspective + backfaceVisibility for hero cards
- Added muck animation (fade + shrink + slide up) triggered by isMucking prop
- Updated PlayerSeat to use AnimatedCard with staggered deal delays

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AnimatedCard component with deal entry + 3D flip** - `550847e` (feat)
2. **Task 2: Update PlayerSeat to use AnimatedCard with stagger and muck** - `79054bb` (feat)

## Files Created/Modified
- `src/components/poker/atoms/AnimatedCard.tsx` - Animated card wrapper with deal, flip, and muck animations
- `src/components/poker/molecules/PlayerSeat.tsx` - Updated to render AnimatedCard instead of raw Card/CardBack

## Decisions Made
- Perspective set to 600px for natural 3D flip depth
- Flip animation uses EASE.IN_OUT for smooth rotation feel (vs EASE.OUT for deal)
- Flip delay = dealDelay + CARD_DEAL so flip starts after deal entry completes
- Villain cards skip flip entirely (faceUp=false branch returns early)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AnimatedCard ready for use by community card animations (09-03)
- Chip animations (09-05) and table reset (09-06) can build on muck pattern
- All ANIM constants referenced correctly for timing consistency

---
*Phase: 09-animations*
*Completed: 2026-02-17*
