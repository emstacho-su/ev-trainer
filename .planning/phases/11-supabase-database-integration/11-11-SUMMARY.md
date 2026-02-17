---
phase: 11-supabase-database-integration
plan: 11
subsystem: training-ui
tags: [poker-table, 6-max, folded-positions, pack-json, spotToPlayers]

requires:
  - phase: 11-09
    provides: "Verification report identifying G3 (folded positions) gap"
provides:
  - "Pack JSON with full 6-max positions per spot"
  - "spotToPlayers renders all 6 seats with correct fold status"
  - "API responses include villainPosition for fold determination"
affects:
  - public/packs/ev-demo-pack-v2.json
  - public/packs/ev-dev-pack-v1.json
  - src/components/training/PreflopTrainingSession.tsx
  - src/app/training/page.tsx
  - src/app/session/[id]/page.tsx
  - src/lib/v2/api/sessionHandlers.ts

tech-stack:
  added: []
  patterns: [villainPosition-threading, implicit-fold-detection]

key-files:
  created: []
  modified:
    - public/packs/ev-demo-pack-v2.json
    - public/packs/ev-dev-pack-v1.json
    - src/components/training/PreflopTrainingSession.tsx
    - src/app/training/page.tsx
    - src/app/session/[id]/page.tsx
    - src/lib/v2/api/sessionHandlers.ts

key-decisions:
  - "All 6 positions included in every spot (UTG, HJ, CO, BTN, SB, BB)"
  - "Folded positions get same stack as effective stack (they started with it before folding)"
  - "Non-hero, non-villain positions without history actions are implicitly folded"
  - "villainPosition passed from API response to spotToPlayers for correct fold determination"
  - "All three spotToPlayers copies updated (PreflopTrainingSession, training/page, session/[id]/page)"

duration: 8 min
completed: 2026-02-17
---

# Phase 11 Plan 11: Gap Closure -- Folded Positions (G3) Summary

Full 6-max table display with dimmed folded seats using villainPosition from API responses.

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~8 min |
| Tasks | 2/2 |
| Deviations | 1 (Rule 2 - Missing Critical) |

## Accomplishments

1. Expanded all pack JSON spots from 2-position to 6-position format (UTG, HJ, CO, BTN, SB, BB)
2. All stacksBb entries filled with effectiveStackBb for folded positions (passes validation)
3. Updated spotToPlayers in all 3 training views to accept villainPosition parameter
4. Added villainPosition to StartResponse and NextResponse API types
5. API handlers now return villainPosition from spot meta in start/next responses
6. Non-hero, non-villain positions correctly display as folded/dimmed on PokerTable

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Expand pack JSON to 6 positions | d6dfc32 | public/packs/ev-demo-pack-v2.json, public/packs/ev-dev-pack-v1.json |
| 2 | spotToPlayers with villainPosition | a799b06 | PreflopTrainingSession.tsx, training/page.tsx, session/[id]/page.tsx, sessionHandlers.ts |

## Files Modified

| File | Change |
|------|--------|
| `public/packs/ev-demo-pack-v2.json` | 200 spots expanded to 6 positions with full stacksBb |
| `public/packs/ev-dev-pack-v1.json` | 5 spots expanded to 6 positions with full stacksBb |
| `src/components/training/PreflopTrainingSession.tsx` | spotToPlayers accepts villainPosition, implicit fold logic, state threading |
| `src/app/training/page.tsx` | spotToPlayers accepts villainPosition, state threading from API response |
| `src/app/session/[id]/page.tsx` | spotToPlayers accepts villainPosition, state threading from API response |
| `src/lib/v2/api/sessionHandlers.ts` | StartResponse/NextResponse include villainPosition from selected.meta |

## Decisions Made

### All 6 positions in pack JSON with equal stacks
All newly added positions (the 4 folded seats) receive stacks equal to effectiveStackBb. This satisfies the validateSpot constraint (stacksBb keys must match positions) and the validateSpotMeta constraint (effectiveStackBb = Math.min of all stacks). Since all stacks are equal, the math holds.

### villainPosition in API response
Rather than inferring villain from spot history (which would misassign actions with 6 positions), villainPosition is returned directly from the spot meta in the API response. This is accurate and backward-compatible (optional field).

### Implicit fold detection
Positions that are neither hero nor villain and have no action in the parsed history are marked as "implicitly folded". This correctly represents positions that folded before the tracked action history began, which is the 6-max game state for heads-up spots.

## Deviations from Plan

### Auto-added (Rule 2 - Missing Critical)

**1. [Rule 2 - Missing Critical] villainPosition in API response**
- **Found during:** Task 2
- **Issue:** The plan assumed spotToPlayers could derive fold status from parseHistoryActions alone, but with 6 positions, the history actions would be misassigned to wrong positions (e.g., a RAISE meant for BB would be assigned to HJ based on PREFLOP_ORDER)
- **Fix:** Added villainPosition to StartResponse/NextResponse types and populated from selected.meta.villainPosition in sessionHandlers.ts. All training views thread villainPosition through state and pass to spotToPlayers.
- **Files modified:** sessionHandlers.ts, PreflopTrainingSession.tsx, training/page.tsx, session/[id]/page.tsx
- **Commits:** a799b06

## G3 Resolution

Poker table now displays all 6 seats in a 6-max game. Hero and villain are active; the other 4 positions appear folded/dimmed with opacity-40, accurately representing the preflop decision point. This matches how GTO Wizard displays spots.

## Next Phase Readiness

- G3 gap closure complete: PokerTable shows all 6 seats in 6-max format
- Folded positions display as dimmed seats (opacity-40 via existing PlayerSeat CSS)
- No blockers for remaining gap closure plans (11-10, 11-12)

---
*Phase: 11-supabase-database-integration*
*Completed: 2026-02-17*
