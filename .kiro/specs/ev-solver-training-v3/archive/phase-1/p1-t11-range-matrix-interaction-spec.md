# P1.T11 - 13x13 Range Matrix Interaction Spec

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## 1) Objective
Define a strict, implementation-ready behavior contract for a non-proprietary 13x13 preflop range matrix that supports:
- hero action-frequency study
- villain range-occupancy study
- keyboard/pointer tooltip parity
- deterministic text export for external analysis

EV-first UX intent: matrix interactions must always make EV-relevant values visible without replacing EV-first grading semantics elsewhere in the trainer.

## 2) Research Summary and Design Implications
Date of review: 2026-02-04

Sources reviewed:
- WAI-ARIA APG Grid Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- WAI-ARIA APG Tooltip Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
- WCAG 2.2 Non-text Contrast understanding: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast
- RFC 8785 (JSON Canonicalization Scheme): https://www.rfc-editor.org/rfc/rfc8785
- Semantic Versioning: https://semver.org/
- GTO NEXUS public site/changelog for product-shape inspiration only:
  - https://gtonexus.com
  - https://gtonexus.com/changelog

Implications applied to this spec:
1. Keyboard and pointer must expose equivalent tooltip payloads.
2. Matrix traversal and focus behavior must be deterministic and testable.
3. Export contract must be versioned and deterministic for reproducible downstream tooling.
4. Product inspiration is functional (study workflow), not visual/text cloning.

## 3) Data Contract
### 3.1 Rank and cell mapping
- Rank axis order is fixed: `A,K,Q,J,T,9,8,7,6,5,4,3,2`.
- Cell labels:
  - pocket pairs on diagonal: `AA`, `KK`, ... `22`
  - suited above diagonal: `<high><low>s` (example `AKs`)
  - offsuit below diagonal: `<high><low>o` (example `AKo`)
- Cell group enum: `pair | suited | offsuit`.

### 3.2 View modes
- `hero-actions`
  - required numeric fields per hand: `fold`, `call`, `raise` in `[0,1]`.
  - optional: `evMix`, `evBest`.
- `villain-range`
  - required numeric field per hand: `occupancy` in `[0,1]`.
  - optional: `combos`, `avgEv`.

### 3.3 Tooltip payload ordering
Tooltip fields MUST render in this deterministic order:
1. `Hand`
2. `Class`
3. mode-specific frequency fields
4. mode-specific EV summary fields

## 4) Interaction Contract
### 4.1 Focus and hover parity
- The same cell details are available for:
  - pointer hover
  - keyboard focus
- Fallback panel displays focused/hovered cell details.

### 4.2 Deterministic action tie-break
For hero mode color/tone selection when frequencies tie:
1. `raise`
2. `call`
3. `fold`

### 4.3 Non-copy policy mapping
- Use original labels, legends, and wording.
- No proprietary assets, terminology bundles, or branded visual cloning.

## 5) Export Contract (MVP Text Export)
### 5.1 Format
Text export is line-oriented and deterministic:
- Header:
  - `format=ev-trainer.range-matrix.v1`
  - `mode=<hero-actions|villain-range>`
  - `columns=<comma-separated fixed schema>`
- Body:
  - one row per matrix cell in row-major matrix order
  - canonical numeric formatting to fixed precision

### 5.2 Determinism
- Identical input -> identical export bytes.
- Export schema is versioned (`v1`) and future changes require version increment.

### 5.3 Out of scope
- image export implementation remains follow-up work.

## 6) Implementation Scope for T11
1. Add a matrix utility module for:
   - deterministic matrix generation
   - tooltip payload generation
   - deterministic text export
2. Add an initial UI component that renders:
   - rank headers + 13x13 cells
   - mode-based cell tone
   - focus/hover details panel
3. Add unit tests that lock the contract.

## 6.1 Acceptance Test Mapping
- `src/lib/ui/rangeMatrix.test.ts`
  - `maps canonical hand classes to fixed matrix positions` -> validates matrix layout contract and deterministic hand keys.
  - `builds hero tooltip fields with deterministic order` -> validates hero-mode tooltip schema/order/value formatting.
  - `builds villain tooltip fields with deterministic order` -> validates villain-mode tooltip schema/order/value formatting.
  - `uses deterministic hero tie-break order raise > call > fold` -> validates deterministic tone tie-break rule.
  - `exports deterministic text format in row-major order` -> validates export version header, mode header, and deterministic row ordering.
  - `rejects invalid hand class keys` -> validates strict contract input rejection behavior.

## 7) Strict DoD (End Product Requirements)
- [ ] `tasks.md` includes expanded strict DoD for T11 (this task).
- [ ] `src/lib/ui/rangeMatrix.ts` exists with:
  - [ ] fixed rank ordering constants
  - [ ] deterministic hand-class mapping
  - [ ] hero/villain tooltip contract builder
  - [ ] deterministic text export builder (`v1`)
- [ ] `src/lib/ui/rangeMatrix.test.ts` exists and passes with coverage for:
  - [ ] matrix mapping correctness (`AA`, `AKs`, `AKo` placements)
  - [ ] hero tooltip field order + values
  - [ ] villain tooltip field order + values
  - [ ] deterministic tie-break for hero view tone
  - [ ] deterministic text export byte-for-byte stability
- [ ] `src/components/RangeMatrix.tsx` exists and compiles:
  - [ ] supports `hero-actions` and `villain-range`
  - [ ] supports hover/focus parity via shared detail payload
  - [ ] uses original labels/tokens (non-proprietary)
- [ ] Quality gates pass in order:
  1. `npm test`
  2. `npx tsc --noEmit --pretty false`
  3. `npm run build`
