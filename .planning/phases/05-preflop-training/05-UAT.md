---
status: complete
phase: 05-preflop-training
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md
started: 2026-02-17T02:00:00Z
updated: 2026-02-17T02:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Start Training Session
expected: Navigate to /preflop-training. Start screen shows heading and Start button. Clicking it loads a preflop spot on the poker table.
result: pass

### 2. Hero Seat Display
expected: Hero seat is highlighted with blue background and blue ring. Hero's position label and stack size (in BB) are visible.
result: pass

### 3. Villain Seat Display
expected: Villain seats show player avatar icon, card backs (two face-down cards), position label, and stack size. Villains who haven't folded appear at normal opacity.
result: issue
reported: "Certain positions still have cards but don't show chips put into the middle, but also don't say fold/check"
severity: major

### 4. Per-Position Action Labels
expected: Villain seats that have acted show a text label below their info box: "Fold" (in red), "Check", "Call", or "Raise" (in gray). Folded players are dimmed (low opacity).
result: issue
reported: "No labels below the info box"
severity: major

### 5. Bet Chips at Positions
expected: Players with active bets (raises, calls, blinds) show chip icons on the inner ring between their seat and the table center.
result: issue
reported: "Some do, but it is always the same players with chips as well as the same players not greyed out"
severity: major

### 6. Pot and Pot Type Display
expected: Center of table shows pot amount in BB. Pot type label shows SRP/3BP/4BP.
result: pass

### 7. Submit Action via Click
expected: Click Fold/Call/Raise. Chosen button selected, others disabled. After ~500ms delay, reveal feedback.
result: pass

### 8. Revealed Feedback Display
expected: After reveal, each action shows EV value and frequency bar with percentage.
result: pass

### 9. Frequency Color Coding
expected: Green >= 60%, yellow > 0%, red 0%.
result: pass

### 10. User Choice Blue Ring
expected: Chosen action has blue ring after reveal.
result: pass

### 11. Keyboard Action Shortcuts
expected: Press 1/F fold, 2/C call, 3/R raise to submit actions.
result: issue
reported: "fail"
severity: major

### 12. Next Hand via Keyboard
expected: Press Space or Enter in revealed state to advance to next hand.
result: issue
reported: "pass by click fail via keyboard"
severity: major

### 13. Hand Counter and Accuracy
expected: Info bar at top shows Hand #N, accuracy %, and correct/total count. Updates after each hand.
result: issue
reported: "Hand counter shows in bottom left, no accuracy counter shows"
severity: minor

### 14. Dealer Button Position
expected: Dealer button near BTN without overlapping seat label.
result: pass

## Summary

total: 14
passed: 8
issues: 6
pending: 0
skipped: 0

## Gaps

- truth: "Villain seats that acted show action labels and correct visual state"
  status: failed
  reason: "User reported: Certain positions still have cards but don't show chips put into the middle, but also don't say fold/check. No labels below the info box. Always same players with/without chips."
  severity: major
  test: 3, 4, 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Keyboard shortcuts submit actions and advance hands"
  status: failed
  reason: "User reported: Keyboard action shortcuts fail. Space/Enter not advancing to next hand via keyboard."
  severity: major
  test: 11, 12
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Info bar shows hand counter and accuracy percentage"
  status: failed
  reason: "User reported: Hand counter shows in bottom left, no accuracy counter shows"
  severity: minor
  test: 13
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
