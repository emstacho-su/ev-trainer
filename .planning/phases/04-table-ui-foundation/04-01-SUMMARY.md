---
phase: 04-table-ui-foundation
plan: 01
subsystem: ui
tags: [next-themes, tailwind, theming, dark-mode, clsx, tailwind-merge]

# Dependency graph
requires:
  - phase: 02-backend-foundation
    provides: Next.js app structure
provides:
  - Theme infrastructure with dark/light mode switching
  - CSS custom properties for poker-specific colors
  - cn() utility helper for conditional class merging
  - ThemeProvider client component wrapper
affects: [04-02, 04-03, 04-04, 04-05, 04-06, all future UI components]

# Tech tracking
tech-stack:
  added: [next-themes, clsx, tailwind-merge]
  patterns: [Client component re-export wrappers, CSS custom properties with HSL values, cn() utility pattern]

key-files:
  created:
    - src/app/providers/ThemeProvider.tsx
    - src/lib/utils.ts
  modified:
    - src/app/layout.tsx
    - src/app/globals.css
    - tailwind.config.js

key-decisions:
  - "HSL color values space-separated (no commas) for Tailwind v4 compatibility"
  - "defaultTheme set to 'dark' for poker aesthetic"
  - "Poker-specific CSS tokens: --table-surface, --table-border, --chip-stack, --dealer-button, --action-positive/negative"
  - "suppressHydrationWarning on html tag prevents theme flash warning"

patterns-established:
  - "Client component wrappers use 'use client' directive and re-export library components"
  - "cn() utility combines clsx (conditional) and tailwind-merge (deduplication)"
  - "CSS custom properties follow pattern: hsl(var(--token))"

# Metrics
duration: 1min
completed: 2026-02-16
---

# Phase 04 Plan 01: Theming Infrastructure Summary

**Dark/light theme switching with next-themes, poker-specific CSS color tokens, and cn() utility helper for conditional styling**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-16T19:47:24Z
- **Completed:** 2026-02-16T19:48:43Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Installed and configured next-themes for seamless dark/light mode switching
- Created ThemeProvider wrapper and integrated into root layout
- Defined CSS custom properties for poker-specific theming (table surface, borders, chips, dealer button, action feedback)
- Created cn() utility helper for conditional class merging
- Updated Tailwind config to include components directory

## Task Commits

Each task was committed atomically:

1. **Task 1: Install theme and utility dependencies** - `669de36` (chore)
2. **Task 2: Create theme provider and utility helpers** - `157a841` (feat)
3. **Task 3: Configure root layout and CSS custom properties** - `0b2ce5b` (feat)

## Files Created/Modified
- `package.json` - Added next-themes, clsx, tailwind-merge dependencies
- `src/app/providers/ThemeProvider.tsx` - Client component wrapping next-themes
- `src/lib/utils.ts` - cn() helper for conditional class merging
- `src/app/layout.tsx` - Wrapped children with ThemeProvider, added suppressHydrationWarning
- `src/app/globals.css` - CSS custom properties for light/dark themes with poker-specific tokens
- `tailwind.config.js` - Added src/components to content paths

## Decisions Made

1. **HSL space-separated values:** Used HSL values without commas (e.g., `0 0% 100%`) for Tailwind v4 compatibility
2. **Dark theme default:** Set `defaultTheme="dark"` for poker aesthetic (green felt works better in dark mode)
3. **Poker-specific color tokens:** Created semantic tokens for table surface, borders, chip stacks, dealer button, and action feedback
4. **suppressHydrationWarning:** Added to html tag to prevent React hydration warnings during theme initialization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

Theme infrastructure complete and ready for component development:
- ThemeProvider available for all components
- CSS custom properties defined for poker-specific colors
- cn() utility ready for conditional styling
- Tailwind configured to process component files

All subsequent UI plans (04-02 through 04-06) can now use theme tokens and utility helpers.

---
*Phase: 04-table-ui-foundation*
*Completed: 2026-02-16*
