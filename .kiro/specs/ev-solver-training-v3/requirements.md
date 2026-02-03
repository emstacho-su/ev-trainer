# Requirements - ev-solver-training-v3

Created: 2026-02-03T00:00:00Z
Updated: 2026-02-03T00:00:00Z

## Project Description
Define v3 requirements for a solver-backed EV-first poker trainer that extends the current v2 Next.js App Router implementation with preflop/postflop training, deterministic solver-policy sampling, canonical node hash caching, and review workflows ordered by EV loss.

## 0. Workflow + Scope Boundaries
- This spec follows cc-sdd order: `spec-init -> requirements -> design -> tasks -> implementation`.
- This phase includes requirements only; no design, tasks, or production code.
- Diffs for this run are limited to `.kiro/specs/ev-solver-training-v3/*`.

## 1. Product Scope (v3 MVP)
### 1.1 Modes and Session Flow
- The trainer SHALL support `preflop` and `postflop` modes.
- Session lifecycle SHALL remain compatible with current flow: Setup -> Session -> Summary -> Review.
- Practice-style review gating semantics from v2 SHALL be preserved unless explicitly changed in design.

### 1.2 Scenario Configuration
- Session config SHALL support at least:
  - `mode`: `preflop | postflop`
  - `gameType`: `cash | tournament`
  - `tableSize`: `heads-up | 6-max | 9-max`
  - `stackDepthBb`: discrete preset values (initially `50 | 100 | 200`)
  - `villainBehavior`: `gto` (MVP), extensible to transforms later
  - `dealOnlyDecisions`: boolean for non-trivial decision filtering
- Effective config snapshot SHALL be stored with each session for reproducibility.

## 2. EV-First Grading (Primary Metric)
- Every graded decision SHALL store:
  - `evUser`
  - `evBest`
  - `evMix`
  - `evLossVsMix` (PRIMARY)
  - `evLossVsBest` (SECONDARY)
- UI grading and review ordering SHALL be driven by `evLossVsMix`.
- Session aggregates SHALL include at minimum mean EV loss, best-action rate, decision count, and duration.
- Secondary metrics MAY be shown (policy divergence, pure-mistake flags) but SHALL NOT replace EV-primary ranking.

## 3. Solver Strategy and Commercialization Gate
### 3.1 Licensing Gate (binding)
- v3 SHALL evaluate candidate existing open-source solvers for commercial licensing compatibility before integration.
- A solver MAY be used in MVP only if its license and dependencies allow planned commercial distribution of this product.
- License evaluation results SHALL be documented in design.

### 3.2 Fallback Path
- If no commercially compatible existing solver is approved, v3 SHALL define a phased in-house solver build path.
- In-house solver work SHALL preserve the same adapter boundary and grading interfaces so trainer features remain stable.

### 3.3 Adapter Boundary
- Solver integration SHALL use a stable adapter interface that accepts canonicalized node input and returns legal actions with frequencies + EVs.
- Canonicalized node input SHALL include:
  - public state (street, board, pot/effective stack context)
  - action history
  - player to act
  - abstraction/version context

### 3.4 Canonical Node Hash Caching
- Each solver query SHALL derive a canonical node hash stable across identical inputs.
- Cache keys SHALL include version dimensions (solver version/config + abstraction/version) to prevent stale collisions.
- Repeated requests for identical canonical node hash + version context SHALL hit cache and avoid recompute.

## 4. Opponent Policy Requirements
- MVP opponent actions SHALL sample from solver frequencies.
- Sampling SHALL be deterministic under identical seed + config + action history.
- Architecture SHALL support future playstyle transforms (frequency reweighting) while keeping EV grading anchored to base solver outputs.

## 5. Preflop and Postflop Training Requirements
### 5.1 Preflop
- Preflop mode SHALL support opening and 3-bet/4-bet decision training for configured spots.
- Mode SHALL provide per-action frequencies and EV comparisons.

### 5.2 Postflop
- Postflop mode SHALL begin from configured flop-entry scenarios with prior preflop context visible.
- Initial spot generation SHALL use a fixed scenario pool, deterministic under seed.
- `dealOnlyDecisions=true` SHALL filter out trivial/forced actions.

## 6. Range Visualization Requirements
- Preflop training SHALL include a 13x13 hand matrix view.
- Hand-cell interactions SHALL expose exact action frequencies on hover/focus.
- UI SHALL support hero-action and villain-range views.
- Export capability SHALL be defined for range data (text and/or image) in a format decided during design.
- All labels/visuals/content SHALL be original and non-proprietary.

## 7. UI/UX Constraints
- UI SHALL remain original and MUST NOT copy GTOWizard proprietary UI/text/assets/branding/datasets/solver outputs.
- v3 visual and interaction requirements SHALL be implemented without requiring pixel-level parity with third-party products.
- Responsive behavior SHALL support desktop first; mobile can be phased with explicit design scope.

## 8. Data/API/Persistence Requirements
- Existing Next.js App Router API patterns SHALL remain supported during MVP evolution.
- Session + decision records SHALL persist enough data to reproduce summary/review consistently across reloads.
- Validation failures SHALL use structured, stable error responses.
- Full SaaS auth/payments/cloud rollout is out of MVP unless later approved.

## 9. Testing and Quality Gates
- Unit tests SHALL cover:
  - EV grading calculations
  - deterministic policy sampling by seed
  - canonical node hash stability
  - cache hit behavior for repeated node queries
- Standard gates remain:
  1. `npm test`
  2. `npx tsc --noEmit --pretty false`
  3. `npm run build`

## 10. Non-Goals for This Requirements Slice
- No production solver implementation commitment in this phase.
- No proprietary solver output ingestion.
- No immediate migration to standalone Express + PostgreSQL stack unless design explicitly justifies phased transition.

## Assumptions + Open Questions
- Assumption: v3 starts as an extension of current v2 architecture and routes, not a rewrite.
- Assumption: EV remains the single source of truth for grading/ranking.
- Open question: What is the approved license policy checklist for "commercially compatible" (e.g., GPL exclusion, attribution, copyleft constraints)?
- Open question: If fallback in-house solver is required, what MVP game scope (HU only, fixed stacks, street coverage) is mandatory for first release?
