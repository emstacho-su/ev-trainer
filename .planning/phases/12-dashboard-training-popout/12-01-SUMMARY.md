---
phase: 12-dashboard-training-popout
plan: 01
subsystem: ui-dashboard
tags: [dashboard, dialog, native-dialog, training-config]
depends_on:
  requires: []
  provides: [dashboard-page, training-config-dialog]
  affects: [12-02, 12-03, 12-04]
tech_stack:
  added: []
  patterns: [native-dialog-popout, dashboard-landing-page]
key_files:
  created:
    - src/components/config/TrainingConfigDialog.tsx
  modified:
    - src/app/page.tsx
    - src/app/lobby/page.tsx
    - src/app/login/page.tsx
    - src/app/session/[id]/page.tsx
decisions:
  - Dashboard replaces redirect-to-lobby as app landing page
  - DrillSuggestions navigate to /training with URL params (heroPosition, potType)
  - TrainingConfigDialog uses native dialog matching RangeGridModal pattern exactly
  - Session-level fields locked via disabled fieldset with opacity-50 visual cue
metrics:
  duration: "8 min"
  completed: "2026-02-17"
---

# Phase 12 Plan 01: Dashboard & TrainingConfigDialog Summary

**Dashboard at / with training card + drill suggestions; native dialog popout for training configuration following RangeGridModal pattern**

## What Was Done

### Task 1: Dashboard home page at /
- Replaced `redirect("/lobby")` in `src/app/page.tsx` with a proper dashboard page
- Dashboard renders: "EV Trainer" heading, training card with Link to `/training`, DrillSuggestions wrapped in ConfigCard
- DrillSuggestions `onSelectDrill` navigates to `/training?heroPosition=X&potType=Y` for pre-applying drill filters
- Uses same layout pattern as TrainerLobby: `mx-auto max-w-4xl space-y-6 p-6`

### Task 2: TrainingConfigDialog component
- Created `src/components/config/TrainingConfigDialog.tsx` (202 lines)
- Native `<dialog>` element with `showModal()`/`close()` imperative API
- Props: `isOpen`, `onClose`, `onStartTraining`, `isStarting`, `canStart`, `error`, `config`, `onConfigChange`, `isSessionActive`
- Contains: ModeToggle, GameSetup, collapsible PositionFilters/PotTypeFilters via `<details>/<summary>`
- Session lock: `isSessionActive` disables mode/gameType/tableSize/stackDepth via `<fieldset disabled>`
- Backdrop click + ESC key close (WCAG 2.1 compliant via native dialog)
- Dialog CSS: `w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-gray-900 text-white p-0 backdrop:bg-black/60`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing Suspense boundary errors in lobby and login pages**
- **Found during:** Task 1 verification (next build)
- **Issue:** `useSearchParams()` in `/lobby` and `/login` pages not wrapped in Suspense boundary, causing static generation failures
- **Fix:** Wrapped TrainerLobby in Suspense in lobby/page.tsx; extracted LoginForm inner component wrapped in Suspense in login/page.tsx
- **Files modified:** src/app/lobby/page.tsx, src/app/login/page.tsx
- **Commit:** 8c3a707

**2. [Rule 3 - Blocking] Fixed pre-existing null check in session page**
- **Found during:** Task 1 verification (next build)
- **Issue:** `toSummaryHref(detail)` called with `SessionDetailResponse | null` but parameter expected non-null
- **Fix:** Added null check with fallback to manual URL construction
- **Files modified:** src/app/session/[id]/page.tsx
- **Commit:** 8c3a707

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Dashboard replaces redirect pattern | Better UX: proper landing page instead of immediate redirect to lobby |
| DrillSuggestions navigate to /training with URL params | Drill filters pass as search params so training page can pre-apply them |
| TrainingConfigDialog mirrors RangeGridModal exactly | Consistency: same native dialog pattern, same CSS approach, same event handling |
| Session lock via disabled fieldset | Simple, accessible approach: native disabled state prevents interaction, opacity signals visual lock |

## Commits

| Hash | Message |
|------|---------|
| 8c3a707 | feat(12-01): dashboard home page at / with training card and drill suggestions |
| 7380e4a | feat(12-01): TrainingConfigDialog native dialog popout for training config |

## Verification

- [x] `npx next build` completes without errors
- [x] `/` renders dashboard content (not redirect to /lobby)
- [x] TrainingConfigDialog TypeScript compiles with correct prop interface
- [x] Dialog follows native `<dialog>` pattern matching RangeGridModal
- [x] src/app/page.tsx min 40 lines (57 lines)
- [x] src/components/config/TrainingConfigDialog.tsx min 80 lines (202 lines)
- [x] TrainingConfigDialog exports named export
- [x] Dashboard has Link to /training
- [x] Dialog uses dialogRef.current.showModal pattern

## Next Phase Readiness

Plan 12-02 can proceed: it will create the `/training` page that imports TrainingConfigDialog and renders the poker table with config popout overlay.
