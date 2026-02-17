---
phase: "08"
plan: "04"
subsystem: "statistics-frontend"
tags: [heatmap, positions, weakness, drill, stats-dashboard]

dependency-graph:
  requires: ["08-01"]
  provides: ["position-heatmap", "weakness-breakdown", "stats-tabs"]
  affects: ["08-02", "08-05", "08-06"]

tech-stack:
  added: []
  patterns: ["tab-navigation", "color-coded-heatmap", "drill-navigation"]

key-files:
  created:
    - src/app/stats/components/PositionHeatmap.tsx
    - src/app/stats/components/WeaknessBreakdown.tsx
  modified:
    - src/app/stats/page.tsx

decisions:
  - id: "08-04-01"
    description: "6-level color scale for heatmap (green-600 to red-600 with opacity)"
  - id: "08-04-02"
    description: "Tab navigation added to stats page (Performance/Positions/Sessions)"
  - id: "08-04-03"
    description: "Dark theme applied to existing BreakdownTable for consistency"

metrics:
  duration: "3 min"
  completed: "2026-02-17"
---

# Phase 8 Plan 4: Position Heatmap & Weakness Breakdown Summary

Position heatmap (6x6 grid with color-coded cells by accuracy/EV loss) and weakness breakdown table (top 10 worst matchups with drill buttons) integrated into tabbed stats dashboard.

## What Was Built

### Task 1: Position Heatmap Component
- 6x6 grid for 6-max positions (UTG/HJ/CO/BTN/SB/BB)
- Hero positions on Y-axis, villain positions on X-axis
- Color-coded cells: green (strong) through yellow (average) to red (weak)
- Low-confidence cells (<20 hands) shown with opacity-50 and asterisk
- Metric toggle between accuracy % and avg EV loss
- Diagonal cells (same position) shown as inactive
- Tooltip on hover with full stats breakdown
- Legend with color key and confidence indicator explanation

### Task 2: Weakness Breakdown Table
- Filters to confident data only (>=20 hands)
- Sorts by worst accuracy ascending
- Shows top 10 weakest position matchups
- Each row: hero/villain positions, hand count, accuracy (color-coded), avg EV loss
- "Drill this" button navigates to /lobby with heroPosition and villainPosition params
- Empty state: "No weaknesses detected. Keep training!"

### Task 3: Stats Page Integration
- Added Performance/Positions/Sessions tab navigation
- Existing global stats content moved to Performance tab
- Positions tab renders PositionHeatmap and WeaknessBreakdown stacked vertically
- Sessions tab placeholder (populated by parallel plan 08-05)
- Updated BreakdownTable and stat cards from light to dark theme (slate-900/700)

## Commits

| Hash | Message |
|------|---------|
| b7d176b | feat(08-04): create position heatmap component |
| d470aaa | feat(08-04): create weakness breakdown table with drill buttons |
| e51e654 | feat(08-04): integrate position components into stats page with tabs |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Dark theme applied to existing BreakdownTable**
- **Found during:** Task 3
- **Issue:** Existing stats page used light theme (bg-white, stone colors) inconsistent with dark theme standard
- **Fix:** Restyled BreakdownTable and stat cards to dark theme (slate-900 bg, slate-700 borders, slate-400 text)
- **Files modified:** src/app/stats/page.tsx
- **Commit:** e51e654

## Next Phase Readiness

- Position components ready for date range picker integration (08-06)
- Tab system ready for SessionHistory integration (08-05 running in parallel)
- Drill button navigation to /lobby ready (depends on lobby accepting position filter params)
