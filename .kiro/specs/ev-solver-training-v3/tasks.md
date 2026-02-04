# Tasks - ev-solver-training-v3 (Phase 2 only)

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## Phase Context
- This file is now scoped to **Phase 2 (UI Foundation)** from `overarching-phases.md`.
- Phase 1 task history is archived at:
  - `.kiro/specs/ev-solver-training-v3/archive/phase-1/tasks-phase-1.md`
  - `.kiro/specs/ev-solver-training-v3/archive/phase-1/*-spec.md`
- Binding constraints from Phase 1 remain active:
  - EV-first grading remains primary.
  - Deterministic behavior remains required.
  - Non-copy policy remains required.

## Research Inputs (Phase 2 Tasking)
Date of review: 2026-02-04

Primary references:
- Next.js App Router architecture and route conventions:
  - https://nextjs.org/docs/app
- Next.js build/runtime behavior for production:
  - https://nextjs.org/docs/app/api-reference/cli/next
- WAI-ARIA Authoring Practices (grid, dialog, keyboard interaction patterns):
  - https://www.w3.org/WAI/ARIA/apg/
- WCAG 2.2 understanding docs (contrast/focus/interaction clarity):
  - https://www.w3.org/WAI/WCAG22/Understanding/
- Tailwind dark mode strategy:
  - https://tailwindcss.com/docs/dark-mode

Tasking implications:
1. Build UI foundations as reusable components with explicit contracts.
2. Keep keyboard-first interactions and accessibility acceptance criteria in scope for every UI task.
3. Preserve current runtime/API boundaries; UI work must not break deterministic engine behavior.
4. Keep animation and styling choices original and non-proprietary.

## Global Execution Rules (All P2 Tasks)
- Follow protocol from `overarching-phases.md`:
  1. Pre-task research
  2. Refine DoD before implementation
  3. Implement scoped task only
  4. Run gates and verify DoD
  5. Commit + push only after pass
- Required gate sequence:
  1. `npm test`
  2. `npx tsc --noEmit --pretty false`
  3. `npm run build`
- Keep diffs focused; one task per branch/commit when possible.

## Phase 2: UI Foundation (3-4 weeks)

### P2.T1 - Next.js setup alignment and UI architecture map
- Goal: baseline app structure for P2 UI work.
- Scope:
  - audit existing `src/app`, `src/components`, `src/lib/ui` boundaries
  - define component ownership and page composition map
  - lock naming and folder conventions for new UI primitives
- Deliverables:
  - architecture map doc for P2 UI component boundaries
  - agreed folder/filename convention section in spec docs
- DoD:
  - architecture map covers setup/session/summary/review/train surfaces
  - no runtime/engine contract changes required for P2 baseline
  - migration notes identify any existing component debt to resolve in later tasks

### P2.T2 - Design tokens and theme system (including dark theme)
- Goal: define a reusable visual system before UI expansion.
- Scope:
  - color tokens, spacing, radius, typography scale, elevation
  - dark-theme token mapping with contrast-safe defaults
  - state tokens for EV semantics (good/warn/bad) with non-proprietary naming
- Deliverables:
  - token spec and implementation plan
  - theme usage guide for components
- DoD:
  - token set is centralized and referenced by components
  - dark theme toggle strategy is documented and testable
  - contrast constraints are defined for key text/background pairs

### P2.T3 - Poker table foundation component
- Goal: introduce a reusable table surface component for training modes.
- Scope:
  - table canvas/frame primitives
  - seat anchor points and pot/community-card zones
  - responsive behavior rules for desktop-first and mobile fallback
- Deliverables:
  - `PokerTable` component contract and implementation
  - layout spec with zone coordinates/constraints
- DoD:
  - component renders stable layout across supported breakpoints
  - seat/zone API is deterministic and reusable by setup/session screens
  - no proprietary visual cloning or copied labels/assets

### P2.T4 - Position layout and seat-state model
- Goal: standardize table position rendering and occupancy states.
- Scope:
  - position model (`BTN`, `SB`, `BB`, etc.) with seat metadata
  - hero/villain highlighting states
  - empty/active/acted/folded visual states
- Deliverables:
  - position state contract + mapper utilities
  - integrated seat rendering in table component
- DoD:
  - position ordering is deterministic for a given table size
  - visual states are represented by explicit typed enums
  - seat-state transitions are unit-tested for key flows

### P2.T5 - Card primitives and dealing animation system
- Goal: establish card rendering and motion primitives for hand flow.
- Scope:
  - card face/back components and stack primitives
  - dealing animation choreography for flop/turn/river and hole cards
  - reduced-motion fallback behavior
- Deliverables:
  - card component set + animation utility layer
  - motion spec for timing/easing and reduced-motion behavior
- DoD:
  - animation behavior is deterministic by event order
  - reduced-motion path is available and documented
  - no animation blocks interaction or causes layout shift regressions

### P2.T6 - Configuration panel redesign
- Goal: improve setup UX while preserving existing config semantics.
- Scope:
  - mode/game/table/stack/villain/deal-only controls
  - validation and inline error messaging
  - persistence of last-used settings where appropriate
- Deliverables:
  - new config panel component(s)
  - validation and error-state contract
- DoD:
  - all required config fields remain supported and mapped to runtime contracts
  - invalid input paths show structured, actionable UI feedback
  - panel remains keyboard navigable and screen-reader compatible

### P2.T7 - Session action surface and EV display refinement
- Goal: unify action controls with EV visibility in session flow.
- Scope:
  - action button group with stateful affordances
  - EV display hierarchy (primary vs secondary metrics)
  - feedback panel alignment with EV-first policy
- Deliverables:
  - session action surface spec + implementation updates
  - EV display formatting guide for session components
- DoD:
  - EV loss vs mix remains primary visual metric in session UI
  - action states (idle/loading/disabled/submitted) are explicit and testable
  - formatting rules are consistent across session/preview/review components

### P2.T8 - Range matrix UX polish and export UX integration
- Goal: productize the P1 matrix contract for production-facing UX.
- Scope:
  - improve matrix readability and legend behavior
  - integrate text export UX into relevant screen(s)
  - define optional image export follow-up contract (not implementation)
- Deliverables:
  - matrix UX update spec + component refinements
  - export UX contract and copy guidelines
- DoD:
  - matrix remains contract-compatible with Phase 1 deterministic rules
  - hover/focus parity remains intact after UX changes
  - text export path is discoverable and deterministic in UI behavior

### P2.T9 - Accessibility hardening pass for core UI surfaces
- Goal: enforce accessibility quality baseline across P2 UI.
- Scope:
  - keyboard navigation paths for setup/session/review/table/matrix
  - focus visibility and semantics (labels, roles, aria where required)
  - contrast and readable state messaging checks
- Deliverables:
  - accessibility checklist + remediation changes
  - documented known gaps (if any) with follow-up tasks
- DoD:
  - critical user flows are fully keyboard operable
  - focus states are visible and consistent
  - documented a11y checks are reproducible and pass for core surfaces

### P2.T10 - Phase 2 gate automation and rollout checklist
- Goal: operationalize P2 quality gates and release-readiness checks.
- Scope:
  - CI workflow for `test -> tsc -> build`
  - artifact/log capture strategy for failed runs
  - PR checklist updates for task DoD evidence
- Deliverables:
  - CI workflow file(s)
  - rollout checklist and PR template update
- DoD:
  - CI runs required gates on push/PR with fail-fast behavior
  - failure output is inspectable for fast triage
  - task completion evidence is standardized across P2 PRs

## Execution Order
1. P2.T1
2. P2.T2
3. P2.T3
4. P2.T4
5. P2.T5
6. P2.T6
7. P2.T7
8. P2.T8
9. P2.T9
10. P2.T10

## Notes
- This Phase 2 task list supersedes the prior Phase 1 list in the active `tasks.md`.
- If a task requires contract changes to engine/runtime determinism, update requirements/design first before implementation.
