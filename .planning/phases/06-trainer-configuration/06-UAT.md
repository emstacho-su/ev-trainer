---
status: complete
phase: 06-trainer-configuration
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md]
started: 2026-02-16T22:00:00Z
updated: 2026-02-16T22:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Lobby loads with config UI
expected: Navigate to /lobby. Page shows "Essentials" card with Mode toggle (Preflop/Flop), Game Setup (game type, table size, stack depth), and a "Start Training" button. Advanced filters section should be collapsible.
result: pass

### 2. Position filter chips work
expected: In the lobby, expand Advanced Filters. Position filter chips (UTG, HJ, CO, BTN, SB, BB) can be toggled on/off. At least one position must remain selected (can't deselect the last one). Preset buttons (All, Blinds Only, Late Position) select the correct groups.
result: pass

### 3. Pot type filter chips work
expected: Pot type filter chips (SRP, 3BP, 4BP) can be toggled on/off. At least one pot type must remain selected.
result: issue
reported: "Doesn't work. I selected UTG, SB, and BB and it placed me in the BTN for a scenario"
severity: major

### 4. Start training navigates to session
expected: Click "Start Training". You should navigate to a session page showing a poker table with hero cards face up, community cards (if postflop), and players in correct positions.
result: pass

### 5. Hero always at bottom of table
expected: On the session page, the hero's seat is always at the bottom center of the table regardless of which position (BTN, SB, BB, etc.) they are.
result: pass

### 6. Multiple bet/raise sizes shown
expected: The action panel shows multiple sizing options. When not facing a bet (postflop), you should see: Check, Bet 33%, Bet 50%, Bet 75%, Bet 100%. When facing a bet or preflop, you should see: Fold, Call, Raise 2.2x, Raise 2.5x, Raise 3.0x.
result: pass

### 7. EV and frequency feedback after decision
expected: After clicking an action, the buttons briefly show "selected" state, then reveal EV values (e.g., +1.50 BB) and frequency bars with percentages for all actions.
result: pass

### 8. Correct tracking logic
expected: The info bar shows Correct count and Accuracy %. Selecting the highest-frequency +EV action should count as 1.0 correct. Selecting a +EV but not highest-frequency action should count as 0.5 correct (shown as decimal like "1.5/3"). Selecting a -EV action counts as 0.
result: pass

### 9. Next hand and progression
expected: After decision feedback is revealed, a "Next Hand (Space/Enter)" button appears. Clicking it or pressing Space/Enter loads a new hand with fresh cards and actions reset to idle.
result: pass

### 10. Session sidebar opens from gear icon
expected: On the session page, clicking the gear icon in the top-right of the info bar opens a sidebar drawer from the left with position and pot type filters. Lobby-only settings (mode, game type) are shown disabled.
result: pass

### 11. Mid-session filter changes show toast
expected: In the sidebar, change a filter (e.g., deselect a position). A toast notification should appear saying "Filters will apply on next hand" and the sidebar should be dismissible by clicking outside.
result: pass

### 12. Keyboard shortcuts
expected: In idle state, pressing number keys 1-5 selects the corresponding action button (1=first button, 2=second, etc.). In revealed state, pressing Space or Enter advances to the next hand.
result: pass

### 13. Config persists on reload
expected: On the lobby page, change some filters (e.g., deselect a position, change stack depth). Reload the page. The changed settings should persist from localStorage.
result: pass

### 14. Drill suggestions display
expected: On the lobby page, if authenticated, a "Drill Suggestions" card appears beside Essentials showing your top 3 weakest spots (if you have sufficient history). For guests, it shows a message about logging in.
result: pass

## Summary

total: 14
passed: 13
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Position filters should restrict which hero positions appear in training spots"
  status: fixed
  reason: "User reported: Doesn't work. I selected UTG, SB, and BB and it placed me in the BTN for a scenario"
  severity: major
  test: 3
  root_cause: "Name mismatch: lobby sends 'positions' (array) but parseFilters reads 'heroPosition' (singular string). Same for potTypes vs potType. Filters silently discarded."
  artifacts:
    - path: "src/lib/v2/filters/spotFilters.ts"
      issue: "SpotFilterInput missing heroPositions/potTypes array fields"
    - path: "src/lib/v2/api/sessionHandlers.ts"
      issue: "parseFilters not reading positions/potTypes array keys"
  missing:
    - "Add heroPositions/potTypes array fields to SpotFilterInput"
    - "Parse positions/potTypes arrays in parseFilters"
    - "Check array inclusion in matchesSpotFilters"
  debug_session: ".planning/debug/position-filter-not-applied.md"
