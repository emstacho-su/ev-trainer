# Phase 7: Range Visualization - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Modal overlay displaying 13x13 range grids with action frequencies and equity breakdowns during training review. Users can view hero and villain ranges side-by-side, inspect individual hands, and filter by action or hand category. This is a read-only visualization — range editing and custom range creation are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Grid cell design
- Color + hand label display: each cell shows hand name (e.g., AKs) on colored background
- Mixed actions use vertical stacked bars (GTO Nexus style) where Y-axis height represents action frequency, bars stacked side-by-side within the cell
- Hover shows tooltip with full action frequency breakdown (e.g., Raise 65%, Call 25%, Fold 10%)
- Click on cell opens side panel with full detailed breakdown for that hand
- Current training hand highlighted with medium-thick bold border + subtle animated glow effect
- Cells for hands not in range use light gray fill

### Color scheme
- Custom palette (not stock GTO Nexus colors)
- Green family for check/call actions
- Red family for raise actions with distinct shades per raise size
- Jams (all-in) use pure `#ff0000`
- Fold color: Claude's discretion (needs to contrast with red/green on dark theme)
- Colorblind accessibility deferred to future enhancement

### Action legend interaction
- Clickable action legend at bottom of each grid
- Clicking an action filters the grid to highlight only that action
- Non-matching cells dim out (low opacity) rather than hiding — preserves grid shape
- Each grid (hero/villain) has its own action frequency summary below it

### Equity breakdown
- Both hero AND villain equity shown side-by-side (like GTO Nexus)
- Two view modes toggled via tab buttons: "Hand Strength" | "Action Groups"
- Hand Strength view categories: Premium pairs (AA-QQ), Medium pairs (JJ-77), Small pairs (66-22), Broadway, Suited connectors, Suited gappers, Offsuit
- Action Groups view: Pure raise, mixed raise/call, pure call, pure fold groupings
- Clicking a hand category highlights those hands in the grid (cross-reference filtering)

### Claude's Discretion
- Equity breakdown panel position (right side vs below grids — responsive considerations)
- Fold color in the custom palette
- Exact raise shade gradations within red family
- Side panel layout for clicked cell detail
- Modal sizing and responsive behavior
- Tooltip positioning and styling

</decisions>

<specifics>
## Specific Ideas

- GTO Nexus screenshot provided as primary visual reference — vertical stacked bars per cell, equity breakdown on right, action frequency boxes at bottom
- "I want it like GTO Nexus" for the grid layout and bar visualization style
- Custom color palette: green check/call, red raises, `#ff0000` jams — not stock GTO Nexus colors
- Two-layer interaction: hover for quick tooltip, click for full side panel detail

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-range-visualization*
*Context gathered: 2026-02-16*
