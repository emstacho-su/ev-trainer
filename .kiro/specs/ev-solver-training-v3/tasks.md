# Tasks - ev-solver-training-v3 (Phase 1 only)

Created: 2026-02-03T00:00:00Z
Updated: 2026-02-03T00:00:00Z

## Tasking model
- Overarching roadmap phases remain the product framework (P1..P5).
- This file is intentionally scoped to **Phase 1 only**.
- Task IDs use `P1.T<n>` for batch-friendly execution.
- After Phase 1 completion, create a new tasks document for Phase 2.

## Global execution rules for each task
- Pre-task research is required before implementation:
  - gather background context
  - review best practices and primary docs
  - refine DoD/acceptance criteria where needed
- A task is done only when:
  - explicit task DoD is met
  - gates pass (`npm test`, `npx tsc --noEmit --pretty false`, `npm run build`)
- Push to GitHub only after DoD + gates pass.

## Consistent Git push syntax (per task)
```bash
git checkout -b <phase-task-id>-<short-slug>
# implement scoped task
npm test
npx tsc --noEmit --pretty false
npm run build
git add -A
git commit -m "<phase-task-id>: <deliverable> (DoD passed)"
git push -u origin <phase-task-id>-<short-slug>
```

## Phase 1: Solver Foundation + Licensing Gate

### P1.T1 - Commercial licensing decision memo
- Goal: finalize whether an existing solver can be used in a sellable product.
- Scope:
  - evaluate candidate solver licenses + key dependencies
  - produce pass/fail decision with rationale
  - define fallback trigger for in-house solver track
- Deliverables:
  - `docs/licensing/solver-license-memo.md` (or spec-linked memo path)
- DoD:
  - explicit recommendation: approved solver OR fallback required
  - legal/attribution obligations listed

### P1.T2 - Solver adapter interface spec
- Goal: lock stable runtime-facing contract independent of provider.
- Scope:
  - define request/response types for node solve lookup
  - define error model and source metadata fields
  - define EV/frequency normalization rules
- Deliverables:
  - interface spec section in design/docs
  - typed contract draft (spec artifact only in this phase)
  - .kiro/specs/ev-solver-training-v3/p1-t2-adapter-spec.md (OpenSpiel-first draft)
- DoD:
  - covers hero/villain action sets, EV units, and version fields

### P1.T3 - Canonical node hash spec
- Goal: deterministic hash strategy for cache keys.
- Scope:
  - canonical serialization rules
  - normalized numeric precision/units
  - hash algorithm + output format
  - cache key schema with version dimensions
- Deliverables:
  - canonical hash algorithm spec + examples
- DoD:
  - semantically equivalent inputs map to same hash
  - versioned cache key format frozen for MVP

### P1.T4 - Cache architecture + invalidation rules
- Goal: define memory + persistent cache behavior.
- Scope:
  - lookup order and write-through policy
  - TTL/eviction strategy
  - stale entry prevention using version context
- Deliverables:
  - cache flow diagram + policy table
- DoD:
  - clear miss/hit/recompute behavior documented

### P1.T5 - Deterministic sampling design
- Goal: reproducible opponent action sampling from mixed strategy.
- Scope:
  - seeded RNG policy
  - cumulative frequency traversal algorithm
  - tie-breaking rules
- Deliverables:
  - deterministic sampling pseudocode + invariants
- DoD:
  - same seed/config/history always yields same sampled sequence

### P1.T6 - EV grading math spec
- Goal: freeze EV-first grade calculations for MVP.
- Scope:
  - `evBest`, `evMix`, `evLossVsMix`, `evLossVsBest`
  - best-action epsilon rules
  - review ordering tie-breakers
- Deliverables:
  - grading formulas + worked examples
- DoD:
  - formulas and ordering are unambiguous and testable

### P1.T7 - Preflop/postflop scenario contract
- Goal: define minimal scenario payloads for both modes.
- Scope:
  - shared trainer config snapshot shape
  - postflop fixed pool metadata
  - `dealOnlyDecisions` filtering contract
- Deliverables:
  - scenario schema spec + fixture examples
- DoD:
  - payloads are sufficient for deterministic regeneration

### P1.T8 - 13x13 range matrix interaction spec
- Goal: define original range visualization behavior.
- Scope:
  - hero/villain view states
  - hover/focus tooltip fields
  - export format (text first; image optional)
- Deliverables:
  - component behavior spec (non-proprietary wording/labels)
- DoD:
  - UX constraints satisfy non-copy policy and EV visibility needs

### P1.T9 - Test plan and gate mapping for Phase 1 outputs
- Goal: ensure Phase 1 specs are implementation-ready.
- Scope:
  - unit-test matrix for hashing, caching, sampling, grading
  - gate checklist mapping (`npm test`, `tsc`, `build`)
- Deliverables:
  - phase test plan section with acceptance checks
- DoD:
  - each P1 task has at least one verifiable acceptance criterion

## Execution order
1. P1.T1
2. P1.T2
3. P1.T3
4. P1.T4
5. P1.T5
6. P1.T6
7. P1.T7
8. P1.T8
9. P1.T9

## Notes
- No production code is authorized by this tasks file alone.
- Move to Phase 2 task planning only after all P1 tasks are completed/accepted.

