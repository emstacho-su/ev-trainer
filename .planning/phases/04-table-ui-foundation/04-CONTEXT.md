# Phase 4: Table UI Foundation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

GTO Nexus-style oval table with realistic poker visuals — cards, chips, positions, dark/light theme, responsive design. This phase builds the table UI foundation that all training phases (5, 6, 9, 10) will use. No training logic, no solver integration, no animations (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Table layout & positions
- Minimal abstract oval shape (clean geometric, no felt texture — but surface treatment at Claude's discretion)
- Hero always at bottom center of table
- 6 seat positions with abbreviation labels (BTN, SB, BB, UTG, HJ, CO) on each seat node
- Classic white "D" dealer button chip near BTN seat
- Pot displayed centered on table with text amount below
- Player bets shown as chips pushed in front of their seat with amount text below
- Inactive/folded seats dimmed/greyed out
- Stack sizes shown below each seat in BB
- Pot type label (SRP, 3BP, 4BP) in a top info bar, not on the table

### Card & chip visuals
- SVG components for cards (scalable, sharp at any size, easy to theme)
- Classic 2-color deck (red/black, not 4-color)
- Hero cards displayed at the hero seat node
- Villain cards: face-down card backs when in the hand, no cards when folded
- Card backs: minimalistic patterned design
- Cards large enough to read at a glance, adjustable for mobile
- Community cards (flop/turn/river) centered above the pot
- Folded players: cards disappear, seat dims
- Chip stacks: single chip color, stack height varies with bet size
- Hero seat gets subtle glow or border highlight to distinguish from villains

### Action panel & EV feedback
- Action buttons (Fold/Call/Raise) in a bottom-right panel (GTO Nexus style)
- Raise sizing: slider + preset buttons (33%, 50%, 75%, 100%, All-in)
- EV feedback: overlay on action buttons after decision — each button shows its EV and frequency
- Frequency bars: colored horizontal bars shown underneath each action (subject to change)
- EV color coding: green/red gradient — green for +EV, red for -EV, intensity by magnitude
- Correct (solver best) action highlighted with border/glow after feedback
- Session controls in top bar: Next, Restart, Stop, View Ranges

### Theme & responsiveness
- Dark and light theme from the start (build theming system with toggle)
- Theme toggle accessible in settings page only (not during play)
- 1920x1080 desktop-first design
- Responsive: rearrange layout on smaller screens (action panel below table, cards larger relative to table)

### Claude's Discretion
- Dark theme palette (deep navy/charcoal vs pure dark)
- Accent color for interactive elements
- Font choice (readable and thematic)
- Table surface treatment (subtle gradient vs felt texture)

</decisions>

<specifics>
## Specific Ideas

- GTO Nexus is the primary reference for layout and action panel placement
- Chips pushed in front of players when betting (not just numbers) — like a real poker table
- Cards must be readable even at 1280x720
- SVG-based card rendering for crisp scaling across all devices

</specifics>

<deferred>
## Deferred Ideas

- Card dealing animations — Phase 9
- Chip movement animations — Phase 9
- EV reveal animations — Phase 9
- Action highlight pulse animations — Phase 9
- Range grid modal — Phase 7
- Mobile-specific layout optimizations — evaluate after desktop is solid

</deferred>

---

*Phase: 04-table-ui-foundation*
*Context gathered: 2026-02-16*
