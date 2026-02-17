# Phase 5: Preflop Training - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can practice preflop decisions (RFI, facing open, 3bet pots, blind defense) across all 6-max positions with solver-accurate EV grading. The Phase 4 table UI displays the hand, and the Phase 1 solver provides GTO strategies for grading. This phase wires them together into an interactive training loop.

Out of scope: Postflop streets (Phase 10), detailed stats/analytics (Phase 8), animations (Phase 9), advanced trainer configuration UI (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Scenario Generation
- Default is random scenario selection across all types (RFI, facing open, 3bet pots, blind defense)
- All four scenario types included at launch: RFI (open raise), facing open (call/3bet/fold), 3bet pots (4bet/call/fold), blind defense (BB/SB vs raises)
- Users can filter to specific scenario types and lock specific positions (e.g., "only train as BTN" or "RFI only")
- Hand dealing weighted to remove most non-decision hands (clear folds) and focus more on borderline/decision hands where solver has mixed strategies
- Hero position random by default with option to lock a specific position
- Filters can be changed mid-session — apply to next hand without ending session

### Training Flow
- Prior actions shown visually on table (chips in pot, action labels on seats) plus fold labels on folded seats
- Short text summary of action sequence shown below the pot size label on the table (toggleable in settings)
- All 6 seats always visible — folded positions dimmed (opacity-40) with "Fold" label
- All positions show stack sizes at all times
- Brief ~0.5s pause after user decides before revealing feedback
- Next hand via "Next" button or Space/Enter keyboard shortcut
- For Phase 5, Next always means next hand (preflop only — multi-street cycling applies in Phase 10)
- Both number keys (1/2/3) and letter keys (F/C/R) as default action shortcuts
- Undo window: brief ~1s window to undo a misclick before feedback reveal; after reveal, decision is locked
- Raise sizing is predetermined per scenario type (e.g., 2.5x open, 3x 3bet) — user does not choose raise size
- Quick-start button for immediate random training, plus a "Customize" option for position/scenario filters before starting
- Start screen shows big "Start Training" button and smaller customize option

### Grading & Feedback
- After reveal, ALL action buttons show: EV of that action (in BB), solver frequency (%), and frequency bar
- Color coding: green for highest-frequency solver action, yellow for lower-frequency solver actions, red for non-solver actions (frequency-weighted coloring)
- For stats tracking purposes, grading is purely EV-based (not frequency-based)
- Any EV loss is shown — no threshold for "acceptable" mistakes
- User's chosen action gets a highlighted border to distinguish from other revealed buttons
- Side panel shows additional feedback: hand equity vs villain's range, hand category label (e.g., "Suited connector", "Premium pair")
- Side panel visibility of mid-hand info (before decision) is a user setting — panel always present, pre-decision content toggleable
- All action frequency bars show for every action after reveal (not just the chosen one)

### Session Structure
- Sessions run unlimited until user clicks Stop — no hand count limit
- Pause and resume supported — session state persisted so user can resume even after page refresh
- Summary screen shown when session ends: hands played, accuracy %, avg EV loss, total EV lost, best/worst hand, breakdown by scenario type, breakdown by position
- Session data persists to backend via API (for logged-in users) — Phase 8 can query historical data
- Guest users can train up to 50 free hands per day; data stored in localStorage
- When guest hits 50-hand limit, prompt modal encouraging sign-up for unlimited training
- Running hand counter (#X) and accuracy % always visible during session
- Additional live stats (EV loss trend, streak, etc.) toggleable in pre-session config settings

### Claude's Discretion
- Exact text summary format below pot label
- Undo mechanism implementation (button vs re-click vs keyboard)
- Side panel layout and exact placement
- Pre-session config screen layout
- Pause state persistence mechanism
- Loading states and transitions between hands
- Guest hand counting implementation (localStorage counter)

</decisions>

<specifics>
## Specific Ideas

- Multi-street Next cycling (Next advances to next street unless fold/all-fold/river, then next hand) — this is the intended behavior for Phase 10 postflop, captured here as the vision for how Next should eventually work
- Keybind customization in settings — defaults are 1/2/3 and F/C/R, but users should be able to rebind (Phase 6)
- Summary screen should feel like a quick performance snapshot, not a deep analytics page (that's Phase 8)

</specifics>

<deferred>
## Deferred Ideas

- Customizable keybind settings UI — Phase 6 (Trainer Configuration)
- Detailed live stats toggles and advanced config — Phase 6 (Trainer Configuration)
- Deep analytics, historical trends, weakness detection — Phase 8 (Statistics & Analytics)
- Card dealing and chip movement animations — Phase 9 (Animations)
- Multi-street training (flop/turn/river progression) — Phase 10 (Postflop Training)

</deferred>

---

*Phase: 05-preflop-training*
*Context gathered: 2026-02-16*
