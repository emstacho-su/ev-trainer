---
phase: 04-table-ui-foundation
plan: 03
subsystem: ui
tags: [react, tailwind, atomic-design, poker-ui, molecules]

# Dependency graph
requires:
  - phase: 04-02
    provides: Atomic poker components (Card, CardBack, Chip)
provides:
  - PlayerSeat molecule with position, cards, stack, bet, and state management
  - CommunityCards molecule for board card display
  - PotDisplay molecule for pot visualization
  - Molecular components ready for organism composition
affects: [04-04-organisms, 04-05-table-layout, poker-table-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [molecular-composition, state-based-styling, hero-villain-differentiation]

key-files:
  created:
    - src/components/poker/molecules/PlayerSeat.tsx
    - src/components/poker/molecules/CommunityCards.tsx
    - src/components/poker/molecules/PotDisplay.tsx
  modified: []

key-decisions:
  - "PlayerSeat supports both 6-max and 9-max positions via union type"
  - "Hero seat gets pulsing blue border via isHero prop for visual distinction"
  - "Folded seats dim with opacity-40 for clear visual state"
  - "showCards prop controls face-up (hero) vs face-down (villain) card display"
  - "CommunityCards returns null when empty to handle preflop state cleanly"
  - "All BB amounts display with 1 decimal precision (toFixed(1))"

patterns-established:
  - "Molecular components compose multiple atoms into functional units"
  - "State-based styling via isActive, isFolded, isHero props"
  - "Hero/villain differentiation pattern for different player perspectives"
  - "Conditional rendering for optional elements (cards, bet chips)"

# Metrics
duration: 1min
completed: 2026-02-16
---

# Phase 04 Plan 03: Molecular Poker Components Summary

**PlayerSeat, CommunityCards, and PotDisplay molecules compose atomic components into functional table units with state-based styling**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-16T22:47:26Z
- **Completed:** 2026-02-16T22:48:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created PlayerSeat component with position label, card display (hero/villain), bet chips, and stack size
- Implemented hero highlighting with pulsing border and folded state dimming
- Created CommunityCards component that maps Card atoms for flop/turn/river display
- Created PotDisplay component with formatted BB amount and uppercase label
- Established molecular composition pattern for organism-level components

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PlayerSeat component** - `c32ac69` (feat)
2. **Task 2: Create CommunityCards and PotDisplay components** - `6a80824` (feat)

## Files Created/Modified
- `src/components/poker/molecules/PlayerSeat.tsx` - Player seat with position, cards (face-up/down), stack, bet, hero highlight, folded state (85 lines)
- `src/components/poker/molecules/CommunityCards.tsx` - Horizontal row of community cards, null when empty (19 lines)
- `src/components/poker/molecules/PotDisplay.tsx` - Pot amount with BB formatting and label (17 lines)

## Decisions Made

**1. Support both 6-max and 9-max positions**
- Rationale: Position union type ('BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'UTG+1' | 'MP' | 'UTG+2') handles different table formats
- Implementation: PlayerSeat accepts any valid position string

**2. Hero/villain card differentiation via showCards prop**
- Rationale: Hero sees face-up cards, villains see card backs
- Implementation: Conditional rendering - showCards ? Card atoms : CardBack atoms
- Composability: Parent component controls what's revealed

**3. State-based styling via boolean props**
- Rationale: Clear visual feedback for player states
- isActive: Green background vs gray (active in hand)
- isFolded: opacity-40 dims entire seat
- isHero: Pulsing blue border ring highlights hero seat

**4. CommunityCards returns null when empty**
- Rationale: Preflop state has no board cards - cleaner than empty div
- Prevents layout shift or unnecessary DOM elements

**5. 1 decimal precision for all BB amounts**
- Rationale: Standard poker display (100.5 BB not 100.482747)
- Consistency: toFixed(1) on stackBB, bet, and pot amount

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for organism composition:**
- PlayerSeat handles all player display states (active, folded, hero, villain)
- CommunityCards ready for board progression (flop → turn → river)
- PotDisplay ready for pot updates during betting rounds
- All molecules use atomic components consistently
- Size variants (sm for PlayerSeat cards) ensure proper layout scaling

**Next up:** 04-04 will create action controls and 04-05 will compose these molecules into the PokerTable organism with full table layout

---
*Phase: 04-table-ui-foundation*
*Completed: 2026-02-16*
