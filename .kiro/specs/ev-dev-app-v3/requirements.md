# Requirements - ev-dev-app-v3

Created: 2026-02-03T00:00:00Z
Updated: 2026-02-03T00:00:00Z

## Project Description
Define v3 requirements for an EV-first poker training platform that extends the current v2 Next.js app with solver-backed preflop/postflop training, deterministic opponent policy sampling, canonical node hash caching, and review/progress workflows centered on EV loss.

## 0. Scope and Workflow Boundaries
- v3 follows cc-sdd order: `spec-init -> requirements -> design -> tasks -> implementation`.
- This document defines requirements only; no design artifacts or implementation changes are part of this phase.
- Requirements must stay compatible with the existing v2 architecture boundaries (engine/runtime/API/UI/persistence) unless explicitly re-decided in design.

## 1. Product Scope (v3)
### 1.1 Trainer Surface
- The app SHALL provide two training tabs/modes: `preflop` and `postflop`.
- The app SHALL preserve existing session lifecycle concepts (`start`, `submit`, `next`, `summary`, `review`) and extend them rather than replacing them.
- Preflop/postflop SHALL be selectable at session setup and persisted in session config snapshots.

### 1.2 Session Outcomes
- Every graded user decision SHALL record EV-based grading fields sufficient to compute:
  - EV loss vs solver mix (primary)
  - EV loss vs best action (secondary)
  - best-action hit/miss
- End-of-session summary SHALL include at minimum: mean EV loss, best-action rate, decision count, and duration.

## 2. EV-First Grading Requirements (Primary Metric)
- EV SHALL be the source of truth for:
  - per-decision grade output
  - review ordering
  - aggregate progress calculations
- Review lists SHALL default to descending EV loss (largest leak first), with deterministic tie-breakers.
- Secondary metrics (policy divergence, pure-mistake markers) MAY be shown but SHALL NOT override EV-based ordering or final grading.

## 3. Solver Integration Requirements
### 3.1 Solver Source and Boundary
- v3 SHALL integrate an existing open-source solver through a stable adapter boundary.
- The adapter SHALL accept canonicalized node input (public state + action history + player to act + abstraction/version context).
- The adapter SHALL return legal actions with frequencies and EVs for grading.

### 3.2 Integration Strategy Decision
- The design phase SHALL choose one integration strategy (`service`, `WASM`, or `hybrid`) and document license compliance.
- The chosen strategy SHALL preserve evaluator consistency so grading outputs do not change when integration plumbing changes.

### 3.3 Caching
- Solver results SHALL be cached by canonical node hash.
- Cache keys SHALL include version dimensions (at least abstraction/version + solver/version context) to prevent stale collisions.
- Repeated requests for the same canonical node hash within the same version context SHALL resolve from cache without re-solving.

## 4. Opponent Policy Requirements
- MVP opponent behavior SHALL sample from solver frequencies at each opponent decision.
- Sampling SHALL be deterministic under fixed seed + identical session/config/action history.
- Design SHALL keep an extension point for future playstyle transforms (frequency reweighting), while EV grading remains solver-anchored.

## 5. Training Content and Spot Selection
- v3 SHALL support a fixed initial scenario pool for postflop and configured preflop scenarios for MVP.
- A decision filter option (`dealOnlyDecisions`) SHALL restrict generated spots to non-trivial decisions when enabled.
- Spot selection SHALL be reproducible given fixed seed and equivalent filter/config snapshots.

## 6. Range Visualization Requirements
- Preflop training SHALL support a 13x13 hand matrix visualization with original styling and labels.
- Hover/detail interactions SHALL expose per-hand action frequencies.
- The UI SHALL support toggling between hero-action view and villain-range view.
- Any visualization content SHALL be original and SHALL NOT copy proprietary GTOWizard design/text/assets.

## 7. API and Persistence Requirements
- Existing Next.js App Router API patterns SHALL remain supported for session lifecycle flows in v3.
- Session records SHALL persist enough data to reproduce summary/review outputs across reloads.
- Validation errors SHALL remain structured and deterministic for invalid requests.

## 8. Testing and Quality Gates
- Unit tests SHALL cover EV grading math and policy sampling determinism with seeded RNG.
- Tests SHALL verify canonical node hash cache hit behavior.
- Standard gates for v3 task execution remain:
  1. `npm test`
  2. `npx tsc --noEmit --pretty false`
  3. `npm run build`

## 9. Non-Functional Requirements
- Determinism: identical inputs produce identical ordering, grading, and sampling outcomes.
- Maintainability: keep engine/runtime/UI/API boundaries explicit.
- Incrementality: v3 changes should be deliverable in small task-scoped diffs.
- Compliance: respect open-source solver licensing and non-copy restrictions.

## 10. Out of Scope for This v3 Start
- Production auth, subscriptions/payments, and full cloud deployment rollout.
- Immediate migration to a separate Express backend unless selected in design with migration plan.
- Building a proprietary solver from scratch as part of this initial v3 requirements slice.

## Assumptions + Open Questions
- Assumption: v3 should extend the existing Next.js codebase first, with backend topology changes evaluated in design.
- Assumption: EV units will remain consistent with current evaluator outputs (bb or chips), to be pinned in design.
- Open question: Context B proposes a from-scratch CFR+ core and PioSolver-level precision target; this conflicts with AGENTS.md direction to use an existing open-source solver. Which path is authoritative for v3?
- Open question: Should v3 MVP remain local/session-first like v2, or require PostgreSQL-backed user accounts in the first delivery slice?
- Open question: What explicit benchmark corpus and acceptance threshold define "convergence within 0.1% EV" if retained?
- Open question: Which open-source solver project/license is preferred for integration approval?
