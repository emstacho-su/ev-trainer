# Phase 6: Trainer Configuration - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can customize their training experience: mode toggles (Preflop/Flop), game setup (type, table size, stack depth), position and pot type filters, and targeted drilling from weak spots. This phase delivers the lobby screen, sidebar configuration panel, drill suggestions, and session summary flow.

</domain>

<decisions>
## Implementation Decisions

### Settings Surface
- **Lobby screen** before training — dedicated screen with config options, explicit "Start Training" button to enter table
- **Card-based sections** on lobby — each config group (Mode, Game Setup, Filters) in its own card
- **Essentials + expandable** layout — mode and game type upfront, position/pot filters behind "Advanced" expand
- **Hamburger menu** (top-left) opens **left-side overlay drawer** during active session
- Sidebar is a **full mirror** of lobby config — user can change anything mid-session (except locked settings)
- Sidebar slides over table with backdrop dim, table stays in place underneath

### Filter Interaction
- **Toggle chips/buttons** for position selection (UTG, HJ, CO, BTN, SB, BB) — multi-select
- **Toggle chips** for pot type (SRP, 3-Bet Pot, 4-Bet Pot) — multi-select, consistent with position chips
- **Quick presets** above position toggles: "All Positions", "Blinds Only", "Late Position Only"
- **Dropdown selectors** for stack depth (50bb/100bb/200bb) and table size (6max/9max) — single-select, NOT changeable mid-session
- **Mode toggle** (Preflop/Flop) — lobby-only, not in sidebar
- **Game type** (Cash/HU) — lobby-only, not in sidebar
- At least one position and one pot type must always be selected (prevent empty filter state)
- No filter summary badge needed — toggle states are clear enough

### Lobby-only vs Mid-session Settings
- **Lobby-only (locked during session):** Mode, Game Type, Table Size, Stack Depth
- **Changeable mid-session (sidebar):** Position filters, Pot Type filters, Hand count target
- Sidebar hides/disables lobby-only settings to make the distinction clear

### Drill Entry Points
- **Lobby suggestions:** Top 3 weakest position/scenario combos shown on lobby screen with stats context (e.g., "BB vs CO: 42% accuracy, -2.3 EV/hand")
- **Stats page drill buttons:** "Drill This" button on stats page pre-fills lobby filters and navigates to lobby
- Both entry points **pre-fill filters + show lobby** for confirmation — user reviews and hits "Start Training"
- **Minimum data threshold** required before drill suggestions appear (placeholder shown otherwise)
- **Custom drill = enhanced filters** — adding a villain position picker to the filter system makes it equivalent to a drill builder. No separate drill concept needed
- Custom drill section lives on lobby screen as part of the filter/config system

### Session Behavior
- Filter changes mid-session take effect on **next hand** (current hand finishes normally)
- Filter changes do **NOT** start a new session — all hands tracked in one continuous session
- **Config persistence** server-side (database) — same settings sync across devices
- Lobby remembers **last used configuration** when user returns
- Sessions run **indefinitely** by default, with optional configurable hand count target in settings
- When hand count target reached: **notification toast** with "Continue" or "End Session" buttons (not auto-end)

### Session Summary
- **Summary screen** shown when session ends (Stop button or hand target end)
- Summary shows: hands played, accuracy, EV metrics
- Two buttons: **"Play Again"** (restart with same config) and **"Back to Lobby"** (change settings)

### Claude's Discretion
- Exact preset definitions (which positions in "Late Position Only", etc.)
- Minimum hand threshold number for drill suggestions
- Lobby card visual styling details
- Sidebar animation timing and backdrop opacity
- Session summary layout and stat presentation
- Hand count target options (25, 50, 100, or custom input)
- How to handle "Drill This" from stats when no stats page exists yet (Phase 8)

</decisions>

<specifics>
## Specific Ideas

- Drill suggestions should show the key metric that makes it a weak spot — not just the label
- The filter system with villain position picker IS the drill builder — no separate drill concept
- Sidebar is a drawer overlay, not a content push — keeps table layout stable
- "Play Again" on summary screen for quick re-queue with same settings

</specifics>

<deferred>
## Deferred Ideas

- Stats page "Drill This" integration requires Phase 8 (Statistics & Analytics) — this phase creates the drill suggestion infrastructure on the lobby; stats page buttons come in Phase 8
- Saved drill presets / favorites — could be added later if users want to bookmark custom drills

</deferred>

---

*Phase: 06-trainer-configuration*
*Context gathered: 2026-02-16*
