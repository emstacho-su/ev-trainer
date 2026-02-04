# P2.T4 Research - Position Layout and Seat-State Model

Date: 2026-02-04
Task: P2.T4
Spec: `ev-solver-training-v3`

## 1) Research Goal
Define robust, deterministic patterns for table position ordering and seat-state rendering that are reusable for setup/session surfaces and compatible with accessibility requirements.

## 2) Primary Sources
- TypeScript unions/discriminated unions (official):
  - https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html
- TypeScript enums (official):
  - https://www.typescriptlang.org/docs/handbook/enums
- React list key stability (official):
  - https://react.dev/learn/rendering-lists
- WAI-ARIA APG Grid pattern (official):
  - https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- WAI-ARIA APG Layout Grid examples (official):
  - https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/
- WCAG understanding (focus visibility and non-text contrast):
  - https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
  - https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html

## 3) Key Findings

### 3.1 State modeling
- Discriminated unions are preferred for seat-state variants because they support exhaustiveness checks and prevent invalid state combinations.
- Enums are acceptable, but unions with explicit payloads are more flexible for UI state evolution.

### 3.2 Deterministic ordering
- Position order must be canonical by table size and independent from render timing/data arrival order.
- Rendering should sort by canonical position index and use stable IDs as React keys (not array index).

### 3.3 Accessibility baseline
- If seats are read-only visual elements, avoid composite widget roles.
- If seats become interactive, use one tab stop entry + deterministic focus movement model (APG grid/layout-grid guidance).
- Visible focus and non-text contrast requirements must be preserved for seat outlines/highlights.

### 3.4 Reusability
- Separate pure mapping/math utilities from React rendering.
- `src/lib/ui` should own:
  1. position definitions/order maps
  2. seat state union + validation
  3. mapper from logical state -> render model

## 4) Pattern Options Considered

### Option A: enum-only state model
- Pros: simple and compact.
- Cons: hard to attach state-specific payloads; weaker compile-time guarantees.

### Option B: discriminated union state model (recommended)
- Pros: strong typing, exhaustiveness checks, supports state-specific metadata.
- Cons: slightly more verbose.

### Option C: ad-hoc object states without central typing
- Pros: fastest initial coding.
- Cons: high drift risk, poor determinism guarantees, testability issues.

Recommendation: Option B.

## 5) Proposed Implementation Direction for P2.T4
1. Add canonical position maps per table size in `src/lib/ui/seatPositions.ts`.
2. Add seat-state union + parser/validator in `src/lib/ui/seatState.ts`.
3. Add pure mapper utility (`src/lib/ui/seatModel.ts`) that returns deterministic render order.
4. Extend `PokerTable` consumption path to render seat visual states without changing runtime APIs.
5. Add tests for:
   - canonical ordering by table size
   - seat-state transition rules
   - deterministic mapping equality for same input.

## 6) Risks and Mitigations
- Risk: position naming drift across surfaces.
  - Mitigation: central exported position constants + single mapper.
- Risk: future interactivity conflicts with keyboard behavior.
  - Mitigation: keep non-interactive semantics now; define extension hook for roving focus later.
- Risk: unstable keys causing UI bugs.
  - Mitigation: enforce stable seat IDs and explicit key contract.
