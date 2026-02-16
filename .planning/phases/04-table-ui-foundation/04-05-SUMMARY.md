---
phase: 04-table-ui-foundation
plan: 05
subsystem: ui
tags: [react, tailwind, atomic-design, poker-ui, organisms, table-layout]

# Dependency graph
requires:
  - phase: 04-03
    provides: PlayerSeat, CommunityCards, PotDisplay molecules
  - phase: 04-04
    provides: ActionButton molecule with state machine
provides:
  - PokerTable organism with oval layout (6-max and 9-max support)
  - ActionPanel organism with action buttons and raise sizing controls
  - SessionControls organism for session lifecycle management
  - InfoBar organism for contextual session information
  - Complete table UI foundation ready for page integration
affects: [04-06-page-integration, training-pages, poker-table-display]

# Tech tracking
tech-stack:
  added: []
  patterns: [organism-composition, table-layout-positioning, configurable-table-sizes]

key-files:
  created:
    - src/components/poker/organisms/PokerTable.tsx
    - src/components/poker/organisms/ActionPanel.tsx
    - src/components/poker/organisms/SessionControls.tsx
    - src/components/poker/organisms/InfoBar.tsx
  modified: []

key-decisions:
  - "PokerTable defaults to 6-max with optional 9-max via tableSize prop"
  - "Seat positions percentage-based for responsive scaling"
  - "Dealer button positioned with offset maps separate from seat positions"
  - "Z-index layering: table surface < seats (z-10) < dealer button (z-20) < center content (z-30)"
  - "ActionPanel conditionally shows raise sizing only when Raise action available"
  - "Aspect ratio locked at 16:10 with max-w-6xl for responsive sizing"

patterns-established:
  - "Organism composition pattern: importing and positioning molecules"
  - "Configurable layout system via position constant maps"
  - "Absolute positioning with percentage coordinates for responsive table layout"
  - "Conditional section rendering based on component state"

# Metrics
duration: 1min
completed: 2026-02-16
---

# Phase 04 Plan 05: Table UI Organisms Summary

**PokerTable, ActionPanel, SessionControls, and InfoBar organisms compose molecules into complete table UI with 6-max/9-max support and responsive oval layout**

## Performance

- **Duration:** 1 min (85 seconds)
- **Started:** 2026-02-16T22:51:47Z
- **Completed:** 2026-02-16T22:53:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created PokerTable with oval layout supporting both 6-max and 9-max table sizes
- Implemented absolute positioning system with percentage-based coordinates for responsive scaling
- Created ActionPanel with action buttons and conditional raise sizing controls
- Created SessionControls with Start/Next/Restart/Stop/View Ranges buttons
- Created InfoBar with pot type badge and optional session info display
- Established organism composition pattern for complete UI sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PokerTable organism with oval layout** - `9c977d5` (feat)
2. **Task 2: Create ActionPanel, SessionControls, and InfoBar organisms** - `bc7262f` (feat)

## Files Created/Modified
- `src/components/poker/organisms/PokerTable.tsx` - Oval table with positioned seats, dealer button, community cards, pot display (133 lines)
- `src/components/poker/organisms/ActionPanel.tsx` - Action buttons with conditional raise sizing section (66 lines)
- `src/components/poker/organisms/SessionControls.tsx` - Five session control buttons with disabled states (47 lines)
- `src/components/poker/organisms/InfoBar.tsx` - Pot type badge with optional session info (17 lines)

## Decisions Made

**1. Configurable table size with default 6-max**
- Rationale: Most training focuses on 6-max, but 9-max support needed for full-ring practice
- Implementation: tableSize prop defaults to '6max', accepts '9max'
- Position maps: SEAT_POSITIONS_6MAX and SEAT_POSITIONS_9MAX with separate coordinate sets
- Dealer button maps: DEALER_BUTTON_OFFSET_6MAX and DEALER_BUTTON_OFFSET_9MAX

**2. Percentage-based seat positioning**
- Rationale: Responsive scaling across viewport sizes without breakpoints
- Implementation: top/left as percentage strings (e.g., '75%', '8%')
- Benefit: Table maintains oval shape at all sizes

**3. Aspect ratio 16:10 locked**
- Rationale: Prevents table distortion on extreme viewport ratios
- Implementation: aspect-[16/10] Tailwind class with max-w-6xl cap
- Result: Consistent oval appearance across devices

**4. Z-index layering strategy**
- Rationale: Correct visual stacking for overlapping elements
- Layers: table surface (default) → seats (z-10) → dealer button (z-20) → center content (z-30)
- Prevents visual artifacts when elements overlap at table edges

**5. Conditional raise sizing display**
- Rationale: Raise controls irrelevant when Raise action disabled/unavailable
- Implementation: Show only when actions.some(a => a.action === 'raise' && a.state !== 'disabled')
- Cleaner UI that adapts to game state

**6. Dealer button offset separate from seat position**
- Rationale: Button needs to be near dealer seat but not overlapping player area
- Implementation: Separate DEALER_BUTTON_OFFSET maps with slight positional adjustments
- Visual clarity: Button visible but doesn't obscure player information

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Complete table UI foundation:**
- PokerTable handles both 6-max and 9-max layouts with responsive scaling
- ActionPanel provides decision input with raise sizing
- SessionControls manages session lifecycle (start, next, restart, stop)
- InfoBar displays contextual information (pot type, session progress)
- All organisms compose molecules correctly
- Theme-aware styling throughout
- Ready for page-level integration

**Next up:** 04-06 will integrate organisms into training page layout with state management

---
*Phase: 04-table-ui-foundation*
*Completed: 2026-02-16*
