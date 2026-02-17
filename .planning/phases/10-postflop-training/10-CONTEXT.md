# Phase 10: Postflop Training - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can practice flop/turn/river decisions with multi-street progression and solver grading. Each hand walks through preflop action automatically, then the user makes decisions at each postflop street. Supports heads-up and multiway pots with real-time solver computation.

</domain>

<decisions>
## Implementation Decisions

### Street Progression Flow
- Multi-street playthrough: user makes decisions at flop, turn, and river (not single decision points)
- Preflop action plays out automatically to set up the postflop spot — user only decides postflop
- Hero position is fixed per hand (IP or OOP assigned at start)
- Always continue through streets even on "wrong" decisions — if hero deviates from solver line, later streets show "N/A" for EV/frequency with an "Off solver line" indicator
- Villain actions shown with brief animation delay (0.5–1s) to build tension
- Show check actions briefly for both players before dealing next street (not silent transitions)
- No mid-hand review of previous street decisions — focus on current street only
- Auto-advance with delay after hand completes (brief pause showing final feedback, then next hand loads)
- Hand summary screen shown after complete multi-street hand before advancing
- Hand summary includes replay option to step through each street's board state and decision again

### Bet Sizing Interaction
- Preset buttons only — show solver's discrete sizes as buttons (e.g., "Bet 33%", "Bet 75%")
- Raise size options presented the same way as bet sizes (e.g., "Raise 2.2x", "Raise 3x", "All-in")
- All-in appears inline in the same row as other sizes — no special treatment
- Buttons show both % of pot and BB amount (e.g., "Bet 75% (6.2 BB)")
- Check option appears inline with bet options in the same row
- EV feedback shown immediately per-street after each decision
- After selection, show EV for every available size so user can see the full picture
- Pot display updates live as bets go in across streets
- Stack sizes update live after each action (effective stacks shrink)
- SPR (stack-to-pot ratio) displayed as a toggleable setting

### Scenario Selection & Variety
- Random board generation for maximum variety — solver computes strategies per board
- Mixed pre-compute and real-time solver computation to minimize wait/buffer time
- Board texture filters available (monotone, paired, connected, etc.) for targeted practice
- Preflop history walks through automatically before flop action begins
- Supports both heads-up (2 players) and multiway (3+ players) postflop scenarios
- Hero hand is random from hero's preflop range by default
- Optional hand strength filter so users can practice specific hand categories (top pair, draws, air, etc.)
- Always start at the flop — no street-skipping filter

### Postflop Feedback & Display
- Expanded button EVs: each action button expands inline to show EV/frequency after selection
- Action history: compact text log for full history PLUS visual labels on seats for current street's last action
- Community cards revealed one at a time (even flop cards reveal sequentially for dramatic effect)
- "Off solver line" deviation indicator shown alongside N/A when hero deviates from solver
- Hand summary screen after each hand showing per-street decisions, EVs, and solver match
- Replay option in hand summary to step through each street again

### Claude's Discretion
- Street transition animation approach (leverage Phase 9 animation system)
- Exact timing for auto-advance delay
- Loading states during real-time solver computation
- Pre-compute batch size and strategy for minimizing buffer time
- Board texture filter categories and implementation
- Hand strength category definitions for optional filter
- Multiway solver approximation approach (when exact solution is infeasible)

</decisions>

<specifics>
## Specific Ideas

- Each hand should feel like playing a real poker hand — preflop action walks through, board cards deal one at a time, villain acts with brief delays
- "Off solver line" should be a subtle but clear indicator — user should understand why N/A appears without it being punishing
- Hand summary with replay gives users a way to study the hand without interrupting training flow
- SPR toggle is a teaching tool — some users find it helpful, others prefer to calculate themselves

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-postflop-training*
*Context gathered: 2026-02-16*
