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

## Phase 1 strategy update (OpenSpiel selected)
- OpenSpiel is the selected solver path for Phase 1 execution.
- Phase 1 now includes both:
  - foundation specs (adapter/hash/cache/determinism/EV contracts)
  - initial OpenSpiel integration implementation, if feasible within gate constraints.
- Keep provider-agnostic adapter boundaries so fallback/in-house path remains viable.

## Phase 1: Solver Foundation + OpenSpiel Implementation

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
  - `.kiro/specs/ev-solver-training-v3/p1-t2-adapter-spec.md` (OpenSpiel-first draft)
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
  - explicit canonical input schema with field order and normalization table
  - positive/negative equivalence examples (same hash vs different hash)
  - `.kiro/specs/ev-solver-training-v3/p1-t3-canonical-node-hash-spec.md`
- DoD:
  - Canonical input schema is frozen and documented with exact field order.
  - Numeric normalization is explicit (precision, rounding mode, units) for all numeric fields.
  - Action history canonicalization is explicit (token format, actor/action encoding, size encoding).
  - Hash algorithm and output are fixed to `SHA-256` lowercase hex.
  - Versioned cache key format is frozen as `<solverVersion>|<abstractionVersion>|<nodeHash>`.
  - At least 10 example vectors are documented, including equivalence and non-equivalence cases.
  - Semantically equivalent inputs are shown to map to identical hashes.
  - A change-impact rule is documented: which field changes MUST produce a new hash.

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
  - deterministic sampling pseudocode with explicit input/output contract
  - invariants list (seed/context determinism, probability normalization, zero-probability exclusion)
  - canonical action ordering rule for tie-breaking and provider-order independence
  - edge-case behavior table (invalid weights, all-zero weights, boundary roll handling)
- DoD:
  - same seed/config/history always yields same sampled sequence
  - same weighted policy yields identical sample regardless of incoming action array order
  - unit tests cover deterministic replay and tie-break behavior

### P1.T6 - EV grading math spec
- Goal: freeze EV-first grade calculations for MVP.
- Scope:
  - `evBest`, `evMix`, `evLossVsMix`, `evLossVsBest`
  - best-action epsilon rules
  - review ordering tie-breakers
- Deliverables:
  - grading formula sheet with variable definitions and normalization rules
  - worked examples for mixed-frequency node and near-tie best-action epsilon case
  - review ordering rule table (`evLossVsMix DESC`, `createdSeq ASC`, `recordId ASC`)
- DoD:
  - formulas and ordering are unambiguous and testable
  - grading implementation computes the documented formulas exactly
  - unit tests cover normalization, epsilon best-action, and deterministic tie-break ordering

### P1.T7 - OpenSpiel integration spike (runtime path)
- Goal: verify end-to-end OpenSpiel adapter connectivity in runtime.
- Scope:
  - choose integration mode for P1 (`service` preferred unless WASM is proven viable)
  - implement minimal adapter call path and response normalization
  - wire adapter through existing runtime boundary without UI coupling
- Deliverables:
  - integration note + implementation PR
  - runnable local setup instructions for adapter/service
- DoD:
  - runtime can resolve at least one supported node via OpenSpiel path
  - normalized response conforms to P1.T2 contract

### P1.T8 - OpenSpiel cache + hash implementation
- Goal: implement versioned cache keyed by canonical node hash for OpenSpiel responses.
- Scope:
  - compute canonical hash from normalized request input
  - implement memory cache + persistent cache layer
  - include version dimensions (`solverVersion`, `abstractionVersion`)
- Deliverables:
  - cache implementation + tests
- DoD:
  - first request miss then subsequent hit for identical versioned node key
  - cache invalidates on version change

### P1.T9 - OpenSpiel-backed deterministic sampling + EV grading hookup
- Goal: integrate solver outputs into deterministic opponent sampling and EV grading.
- Scope:
  - use solver frequencies for opponent policy sampling
  - apply EV-first grading fields from normalized solver output
  - preserve deterministic replay behavior
- Deliverables:
  - runtime integration changes + tests
- DoD:
  - same seed/config/action history yields reproducible outcomes
  - grading records include `evUser`, `evBest`, `evMix`, `evLossVsMix`, `evLossVsBest`

### P1.T10 - Preflop/postflop scenario contract
- Goal: define minimal scenario payloads for both modes.
- Scope:
  - shared trainer config snapshot shape
  - postflop fixed pool metadata
  - `dealOnlyDecisions` filtering contract
- Deliverables:
  - scenario schema spec + fixture examples
- DoD:
  - payloads are sufficient for deterministic regeneration

### P1.T11 - 13x13 range matrix interaction spec
- Goal: define original range visualization behavior.
- Scope:
  - hero/villain view states
  - hover/focus tooltip fields
  - export format (text first; image optional)
- Deliverables:
  - component behavior spec (non-proprietary wording/labels)
- DoD:
  - UX constraints satisfy non-copy policy and EV visibility needs

### P1.T12 - Test plan and gate mapping for Phase 1 outputs
- Goal: ensure Phase 1 specs and integrations are implementation-ready.
- Scope:
  - unit-test matrix for hashing, caching, sampling, grading, adapter normalization
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
10. P1.T10
11. P1.T11
12. P1.T12

## Notes
- Production code is allowed only for implementation tasks in this file after preceding design/spec dependencies are satisfied.
- Move to Phase 2 task planning only after all P1 tasks are completed/accepted.

