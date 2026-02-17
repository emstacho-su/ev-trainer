---
status: diagnosed
phase: 07-range-visualization
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md]
started: 2026-02-17T05:00:00Z
updated: 2026-02-17T05:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. View Ranges button visible on PokerTable
expected: During a training session, a "View Ranges" button is visible on the poker table (bottom-right area). It should be disabled before any decision is made (no range data yet).
result: pass

### 2. View Ranges button opens modal after decision
expected: After making a decision and seeing EV feedback, click "View Ranges". A modal dialog should open with range grids displayed.
result: issue
reported: "it does not."
severity: blocker

### 3. Modal shows hero and villain range grids side by side
expected: Inside the modal, you see two 13x13 range grids labeled "Hero" and "Villain" displayed side by side (or stacked on smaller screens). Each grid shows hand labels (AA, AKs, AKo, etc.) with pairs on the diagonal, suited hands above, offsuit below.
result: skipped
reason: Blocked by Test 2 — modal doesn't open

### 4. Range cells show colored action bars
expected: Range grid cells show colored stacked bars representing action frequencies (green for call, blue for raise, red/gray for fold). Cells with higher frequency for an action show more of that color.
result: skipped
reason: Blocked by Test 2 — modal doesn't open

### 5. Board cards displayed in modal
expected: The current board cards (if any) are displayed between the hero and villain grids.
result: skipped
reason: Blocked by Test 2 — modal doesn't open

### 6. Action legend with frequencies
expected: Below or beside the grids, an action legend shows aggregate action frequencies (e.g., "Fold 30%", "Call 45%", "Raise 25%") with matching colored indicators.
result: skipped
reason: Blocked by Test 2 — modal doesn't open

### 7. Action legend filtering
expected: Clicking an action in the legend highlights only cells where that action appears. Clicking again deselects the filter.
result: skipped
reason: Blocked by Test 2 — modal doesn't open

### 8. Equity breakdown tabs
expected: An equity breakdown section with two tabs: "Hand Strength" and "Action Groups". Hand Strength shows categories (premium pairs, broadway, suited connectors, etc.) with counts and percentages.
result: skipped
reason: Blocked by Test 2 — modal doesn't open

### 9. Modal closes properly
expected: The modal can be closed by pressing ESC, clicking the backdrop (outside the modal), or clicking a close button. After closing, filter state resets (next open starts fresh).
result: skipped
reason: Blocked by Test 2 — modal doesn't open

## Summary

total: 9
passed: 1
issues: 1
pending: 0
skipped: 7

## Gaps

- truth: "View Ranges button opens modal dialog showing range grids after a decision is made"
  status: failed
  reason: "User reported: it does not."
  severity: blocker
  test: 2
  root_cause: "heroRange and villainRange props are never passed to PokerTable from the session page. Range data is not surfaced in the submit response (DecisionGrade has no range fields). Button is permanently disabled."
  artifacts:
    - path: "src/app/session/[id]/page.tsx"
      issue: "PokerTable called without heroRange/villainRange props (lines 623-631)"
    - path: "src/components/poker/organisms/PokerTable.tsx"
      issue: "Button disabled condition correct (line 213) but data never provided"
  missing:
    - "Surface range data in submit response or separate endpoint"
    - "Store range data in session page state after decision"
    - "Pass heroRange/villainRange props to PokerTable"
  debug_session: ".planning/debug/view-ranges-button-disabled.md"
