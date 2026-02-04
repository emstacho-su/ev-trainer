# Tasks - ev-solver-training-v3 (Phase 2 only)

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T03:00:00Z

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
- Deliverables (strict):
  - `.kiro/specs/ev-solver-training-v3/p2-t1-ui-architecture-map.md`
    - per-surface page composition for setup/session/summary/review/train
    - ownership matrix for `src/app`, `src/components`, `src/lib/ui`, `src/lib/runtime`, `src/lib/engine`, `src/lib/v2`
    - migration-debt register with priority labels and follow-up task mapping
  - updated convention contract in this tasks spec:
    - folder + filename conventions for UI primitives and feature components
    - dependency direction rules (UI -> API client/runtime boundary -> engine contracts only)
    - client/server component placement rules for App Router
  - setup-alignment code change(s) required to remove discovered baseline drift (if any)
- DoD (strict / testable):
  - coverage:
    - architecture map includes all five required surfaces: setup, session, summary, review, train
    - each surface includes route path, entry file path, major component list, and data/API boundary
  - conventions:
    - naming and folder rules are explicit, normative (MUST/SHOULD), and include at least 8 enforceable rules
    - conventions include at least one accessibility-focused rule and one deterministic-contract protection rule
  - code baseline:
    - at least one concrete setup-alignment drift is fixed in code and referenced in architecture notes
    - no runtime/engine behavior contract changes (no API shape drift for existing endpoints)
  - verification evidence:
    - `npm test`, `npx tsc --noEmit --pretty false`, and `npm run build` all pass
    - tasks.md updated timestamp reflects P2.T1 completion edit

### P2.T2 - Design tokens and theme system (including dark theme)
- Goal: define a reusable visual system before UI expansion.
- Scope:
  - color tokens, spacing, radius, typography scale, elevation
  - dark-theme token mapping with contrast-safe defaults
  - state tokens for EV semantics (good/warn/bad) with non-proprietary naming
- Deliverables (strict):
  - token specification doc at `.kiro/specs/ev-solver-training-v3/p2-t2-design-tokens-theme-spec.md` with:
    - token taxonomy (global/base -> semantic -> component) and naming grammar
    - explicit light + dark token tables for color/text/border/surface/focus states
    - EV semantic token set (`ev-positive`, `ev-neutral`, `ev-negative`, `ev-accent`) with usage intent
  - implementation artifacts in code:
    - centralized token source in CSS variables (single authoritative file)
    - Tailwind theme bridge mapping utilities to token variables where applicable
    - theme mode selector strategy (system + manual override contract)
  - theme usage guide section in spec docs with:
    - example mappings for setup/session/summary/review/train surfaces
    - do/don't rules to prevent hard-coded colors/spacing in new components
- DoD (strict / testable):
  - token completeness:
    - includes at least 45 tokens across color, spacing, radius, typography, elevation, and focus
    - each token has name, value, purpose, and at least one usage example
    - no proprietary or third-party branded naming
  - architecture + source-of-truth:
    - all new theme values originate from one canonical token file; no duplicate token definitions
    - at least 3 representative UI surfaces consume semantic tokens instead of raw color literals
    - lint/search evidence confirms no newly introduced raw hex values outside token definitions
  - dark theme behavior:
    - supports `prefers-color-scheme` baseline and a deterministic manual override (class or data-attribute)
    - manual toggle persists user preference and applies before first paint strategy is documented
    - light/dark mode produces readable state for all core text + interactive controls
  - accessibility constraints:
    - normal text token pairs meet WCAG AA 4.5:1 minimum contrast
    - non-text UI component and focus indicator token pairs meet 3:1 minimum contrast
    - focus style spec defines minimum visible focus treatment (>=2px perimeter-equivalent or stronger)
  - EV semantics:
    - EV-primary semantics are visually encoded with dedicated semantic tokens and documented hierarchy
    - EV token usage does not invert meaning between light and dark themes
  - verification evidence:
    - `npm test`, `npx tsc --noEmit --pretty false`, and `npm run build` pass
    - updated docs include a migration note for replacing existing hard-coded values incrementally

### P2.T3 - Poker table foundation component
- Goal: introduce a reusable table surface component for training modes.
- Scope:
  - table canvas/frame primitives
  - seat anchor points and pot/community-card zones
  - responsive behavior rules for desktop-first and mobile fallback
- Deliverables (strict):
  - `.kiro/specs/ev-solver-training-v3/p2-t3-poker-table-layout-spec.md` with:
    - canonical table coordinate system (0..1 normalized x/y for seats and zones)
    - seat anchor map for supported table sizes (`heads-up`, `6-max`, `9-max`)
    - pot/community/hole-card zone bounding rules and collision constraints
    - responsive rules for narrow and wide containers with content-driven breakpoints
  - `src/components/PokerTable.tsx` and supporting UI model files under `src/lib/ui/*` with:
    - typed `PokerTableProps` contract
    - deterministic rendering from pure input data
    - explicit extension points for seat-state overlays in P2.T4
  - usage examples integrated in at least one preview/test surface (without runtime contract changes)
- DoD (strict / testable):
  - contract strictness:
    - `PokerTableProps` includes typed inputs for `tableSize`, `seats`, `zones`, and optional overlays
    - invalid config paths fail fast via typed guards or runtime assertions with stable error messages
  - deterministic geometry:
    - same props always produce identical seat/zone coordinates and render order
    - seat ordering is deterministic for each table size and documented in the spec
    - geometry tests cover all supported table sizes and at least 2 responsive widths
  - responsive stability:
    - table container preserves declared aspect ratio across breakpoints (no layout jump)
    - no overlap between seat anchors and required central zones under documented min width
    - mobile fallback remains readable and operable without horizontal scroll traps
  - accessibility + interaction baseline:
    - non-interactive table markup remains semantic (no fake widget roles)
    - if any seat/zone element is interactive, keyboard focus order and visible focus ring are defined and tested
    - reduced-motion compatibility documented for future animated layers
  - architecture guardrails:
    - component stays in UI layer and does not import runtime/engine business logic
    - no API contract changes to existing session/training endpoints
    - no copied third-party proprietary table visuals, labels, or assets
  - verification evidence:
    - unit tests added for layout math/ordering and pass deterministically
    - `npm test`, `npx tsc --noEmit --pretty false`, and `npm run build` pass

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
