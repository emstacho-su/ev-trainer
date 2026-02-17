# Phase 9: Animations - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

GTO Nexus-style smooth animations that enhance the poker training experience. Covers card dealing, chip movement, EV feedback reveals, action button highlights, modal transitions, sound effects, and user animation controls. Does NOT add new UI components or training features — only adds motion and audio to existing elements.

</domain>

<decisions>
## Implementation Decisions

### Card dealing style
- Cards deal FROM center of table, fan out to player positions
- Cards deal face-down first, then individually flip to reveal (hero flips face-up, villains stay face-down)
- 3D Y-axis flip animation for card reveal (perspective rotation showing back then front)
- Flop cards dealt one at a time (not as a group); turn and river dealt individually
- Quick pace: ~150ms per card
- Stagger by seat: deal to each player in order (SB first, clockwise) with ~100ms gap between each
- Folded cards slide to muck (center of table) and fade out

### Chip & bet animations
- Chips slide from player's stack area to bet position when betting/raising
- At end of betting round, all bets slide to center pot simultaneously
- Pot total updates instantly (no count-up animation)
- Stack sizes update instantly (no count-down animation)
- No pot award animation at hand end — hand just resets (training mode focus)
- Dealer button slides smoothly from one seat to the next between hands

### EV feedback reveal
- EV value appears with slide-up + fade-in animation on action buttons
- All action buttons reveal EV simultaneously (no stagger between buttons)
- Selected action button gets a brief pulse/glow ring before color reveal (confirms selection)
- Button background smoothly transitions from neutral to green (correct) or red (incorrect) over ~300ms
- Frequency bar displays instantly (no grow animation)

### Audio
- Subtle card-snap sound effects on deal and flip
- Subtle chip-clink sounds on bets and pot collection
- Distinct sounds for correct (positive ding) vs incorrect (soft negative tone) decisions
- Audio mute toggle is SEPARATE from animations toggle (independent controls)
- All sounds optional, can be muted

### Overall motion feel
- Philosophy: fast by default, but key moments (card flip, EV reveal) get more attention
- Dominant easing: ease-out (decelerate) — fast start, gentle stop
- Brief table reset (~300ms) between hands: cards slide to center, chips dissolve, then fresh deal
- Animations on/off toggle (single toggle, no speed slider)
- prefers-reduced-motion: simplify to fade-only (not complete disable) — still provides visual feedback
- Modal transitions (range grid): fade + scale up from 95% to 100%

### Claude's Discretion
- Exact duration values for each animation beyond the ~150ms card guidance
- Spring/bounce parameters if needed for specific elements
- Sound effect sourcing and exact audio characteristics
- Animation library choice (CSS transitions, Framer Motion, etc.)
- Exact easing curve parameters
- How to handle animation state during rapid user input

</decisions>

<specifics>
## Specific Ideas

- Card flip should feel like flipping a real card — 3D perspective rotation on the Y-axis
- Chip movement should feel physical — sliding from stack to bet area, then collecting to pot
- Sound design should be subtle and non-intrusive — think poker app, not arcade game
- The training pace should never be bottlenecked by animations — 150ms cards, instant counters, quick resets
- Two independent toggles in settings: one for animations, one for audio

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-animations*
*Context gathered: 2026-02-16*
