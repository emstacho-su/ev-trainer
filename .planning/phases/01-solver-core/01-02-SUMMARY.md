---
phase: 01-solver-core
plan: 02
subsystem: solver
tags: [bet-sizing, action-abstraction, poker-solver]

# Dependency graph
requires:
  - phase: 01-solver-core
    provides: BetSizeConfig, ActionAbstractionConfig, AbstractedAction types
provides:
  - getAbstractedBetSizes function for pot fraction to BB conversion
  - getAbstractedRaiseSizes function for raise multiples to BB conversion
  - toEngineActionAbstraction bridge function for engine compatibility
  - DEFAULT_BET_SIZES and DEFAULT_RAISE_SIZES constants
affects: [game-tree-building, solver-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [pot-fraction-sizing, raise-multiples, 0.5BB-rounding, all-in-threshold]

key-files:
  created:
    - src/lib/solver/abstraction/actions.ts
    - src/lib/solver/abstraction/actions.test.ts
  modified:
    - src/lib/solver/index.ts

key-decisions:
  - "Use 0.5 BB precision for rounding (standard solver practice)"
  - "All-in threshold 2.0 for bets (stack <= 2x pot adds all-in option)"
  - "All-in threshold 3.0 for raises (stack <= 3x facing bet adds all-in option)"
  - "Default sizes: 33%, 50%, 75%, 100% pot for bets; 2.2x, 2.5x, 3.0x for raises"

patterns-established:
  - "Bet sizes as pot fractions converted to BB amounts"
  - "Raise sizes as multiples of facing bet"
  - "Automatic all-in inclusion for shallow stacks"
  - "Bridge functions to convert solver config to engine format"

# Metrics
duration: 8min
completed: 2026-02-05
---

# Phase 01-02: Bet Size Abstraction Summary

**Bet sizing abstraction layer with pot fractions, raise multiples, and automatic all-in handling for shallow stacks**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-05T19:15:54Z
- **Completed:** 2026-02-05T19:23:36Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- getAbstractedBetSizes converts pot fractions (0.33, 0.50, 0.75, 1.0) to BB amounts
- getAbstractedRaiseSizes converts raise multiples (2.2x, 2.5x, 3.0x) to BB amounts
- Automatic all-in insertion when stack is shallow relative to pot/facing bet
- toEngineActionAbstraction bridges solver config to engine ActionAbstraction format
- Comprehensive edge case handling (tiny pot, tiny stack, huge facing bet)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add action abstraction types** - `d91a7bd` (feat) - Previously committed
2. **Task 2: Implement bet size abstraction** - `a24a3cd` (feat)
3. **Task 3: Export and integrate with existing ActionAbstraction** - Included in task 2 commit

## Files Created/Modified
- `src/lib/solver/abstraction/actions.ts` - Bet/raise size computation functions
- `src/lib/solver/abstraction/actions.test.ts` - 38 tests covering all edge cases
- `src/lib/solver/index.ts` - Public API exports for action abstraction

## Decisions Made
- **0.5 BB precision:** Standard for poker solvers, avoids floating point accumulation
- **All-in thresholds:** 2.0x pot for bets, 3.0x facing bet for raises
- **Default sizes:** 33/50/75/100% pot for bets; 2.2/2.5/3.0x for raises (covers common solver configurations)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Task 1 (types) was already committed from a previous session; Task 2-3 committed in this execution

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Bet size abstraction complete and exported from solver module
- Ready for game tree node building in subsequent plans
- Compatible with existing engine ActionAbstraction interface

---
*Phase: 01-solver-core*
*Completed: 2026-02-05*
