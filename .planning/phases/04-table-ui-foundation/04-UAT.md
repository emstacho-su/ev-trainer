# Phase 04: Table UI Foundation — UAT

**Status:** passed
**Started:** 2026-02-16
**Completed:** 2026-02-16
**Phase Goal:** GTO Nexus-style oval table with realistic poker visuals

## Tests

| # | Test | Expected Behavior | Result | Notes |
|---|------|--------------------|--------|-------|
| 1 | Dark theme renders by default | Page loads with dark background, green felt table, dark player info boxes | PASS | |
| 2 | Light/dark theme toggle | Clicking Theme button switches between light and dark modes | PASS | |
| 3 | Oval table with 6 player seats (6-max) | 6 seats symmetrically around oval, BB at bottom, clockwise | PASS | |
| 4 | 9-max table toggle | Switches to 9 seats with proper spacing | PASS | |
| 5 | Hero seat visually distinct | Blue background with ring highlight | PASS | |
| 6 | Hero cards displayed face-up | Two hole cards show rank and suit | PASS | |
| 7 | Villain card backs shown | Villains in hand show face-down card backs | PASS | |
| 8 | Folded players dimmed | Folded players at reduced opacity | PASS | |
| 9 | Community cards on table center | Board cards centered on felt | PASS | |
| 10 | Pot type label above board | SRP/3BP/4BP badge above community cards | PASS | |
| 11 | Pot amount displayed | Pot size in BB below community cards | PASS | |
| 12 | Bet chips on inner ring | Chips between seat and table center | PASS | |
| 13 | Dealer button positioned | White "D" near BTN seat | PASS | |
| 14 | Start button loads first hand | Loads hero cards, community cards, enables actions | PASS | |
| 15 | Action buttons respond to click | Click highlights selection | PASS | |
| 16 | Correct action reveals green | Correct = green, others = red after delay | PASS | |
| 17 | EV values shown after reveal | EV in BB displayed on each button | PASS | |
| 18 | Frequency bars shown after reveal | Frequency bar with percentage shown | PASS | |
| 19 | Next button advances hand | Loads next mock hand scenario | PASS | |
| 20 | Restart resets session | Returns to hand 1 with fresh state | PASS | |
| 21 | Stop ends session | Disables actions, clears table | PASS | |
| 22 | Seed info in bottom-left | Seed/hand info in bottom-left corner | PASS | |
| 23 | Responsive scaling | Table maintains proportions on resize | PASS | |

## Summary

23/23 tests passed. Phase 04 UAT complete.
