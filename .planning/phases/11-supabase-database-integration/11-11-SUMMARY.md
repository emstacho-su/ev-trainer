---
phase: 11-supabase-database-integration
plan: 11
subsystem: gap-closure
tags: [spots, folded-positions, poker-table]

requires:
  - phase: 11-09
    provides: "Verification report identifying G3 (folded positions) gap"
provides:
  - "Pack JSON with full 6-max positions per spot"
  - "spotToPlayers renders all 6 seats with correct fold status"
  - "API responses include villainPosition for fold determination"
affects:
  - public/packs/ev-demo-pack-v2.json
  - src/components/training/PreflopTrainingSession.tsx
  - src/app/training/page.tsx
  - src/app/session/[id]/page.tsx
  - src/lib/v2/api/sessionHandlers.ts

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - public/packs/ev-demo-pack-v2.json
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

duration: N/A (completed across sessions)
completed: 2026-02-17
---

# Phase 11 Plan 11: Gap Closure — Folded Positions (G3) Summary

**Spots now include all 6 positions; poker table shows folded seats as dimmed**

## Performance

- **Tasks:** 2/2
- **Files modified:** 5 + pack JSON

## Accomplishments

- Expanded pack JSON to include all 6 positions per spot with matching stacksBb entries
- Updated `spotToPlayers` in all three training views to accept `villainPosition` parameter
- Non-hero/non-villain positions without history actions are marked as implicitly folded
- Folded positions show as dimmed seats with no bet chips (matching GTO Wizard display)
- `sessionHandlers.ts` response types updated to include `villainPosition` field
- Both `handleStart` and `handleNext` return `selected.meta.villainPosition`

## G3 Resolution

Poker table now displays all 6 seats in a 6-max game. Hero and villain are active; the other 4 positions appear folded/dimmed, accurately representing the preflop decision point.

---
*Phase: 11-supabase-database-integration*
*Completed: 2026-02-17*
