# Design - ev-solver-training-v3

Created: 2026-02-03T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## 1. Design Goals
- Extend v2 architecture (Next.js App Router + deterministic runtime) without a rewrite.
- Keep EV-first grading as the primary truth for feedback, review ordering, and aggregates.
- Introduce solver-backed policy/EV lookup with canonical node hash caching.
- Enforce commercialization gate: use existing solver only if license is commercially compatible; otherwise fallback to in-house solver track.

## 2. Research Summary (for solver licensing + feasibility)
Date of review: 2026-02-03

### 2.1 Candidate projects reviewed
- OpenSpiel (official repo) lists Apache-2.0 license and includes poker environments.
- OpenCFR (official repo) lists MIT license and is CFR-oriented.
- poker-cfr (official repo) lists MIT license and provides CFR implementation examples.

### 2.2 Design implication
- Preferred MVP path: integrate an existing solver with permissive commercial license (Apache-2.0/MIT) after dependency/license verification.
- If candidate license/dependency policy fails commercialization checks, keep trainer interfaces unchanged and activate in-house solver fallback.

### 2.3 Commercialization license checklist (binding)
Before selecting solver provider:
1. Confirm SPDX license for solver and all bundled runtime dependencies.
2. Confirm no copyleft obligation incompatible with planned distribution model.
3. Confirm attribution/NOTICE obligations can be satisfied.
4. Record decision in spec/task artifacts.

## 3. Architecture Decisions

### 3.1 System shape (MVP)
- Keep current app topology: Next.js App Router endpoints + deterministic runtime modules.
- Add solver integration boundary inside runtime (`solver adapter`) rather than coupling UI directly.
- Keep current summary/review/session flows; extend payloads with solver-backed grading fields.

### 3.2 Solver provider strategy
Use provider chain:
1. `PrecomputedProvider` (known spots/ranges)
2. `CacheProvider` (node-hash keyed memory + persistent cache)
3. `LiveSolverProvider` (existing approved open-source solver)
4. `FallbackInHouseProvider` (enabled only if no commercially compatible solver is approved)

All providers implement one adapter interface so trainer behavior is stable across provider swaps.

### 3.3 Canonical node hash design
Canonical hash input tuple:
- game version + abstraction version + solver config version
- public state (street, board, pot, effective stacks)
- positions + player to act
- canonical action history

Canonicalization rules:
- Normalize numeric precision and units before serialization.
- Serialize with deterministic key ordering.
- Hash using SHA-256 and store lowercase hex string.

Cache key:
`<solverVersion>|<abstractionVersion>|<nodeHash>`

## 4. Contracts and Data Models

### 4.1 Adapter contracts
```ts
interface SolverNodeRequest {
  nodeHash: string;
  context: {
    gameVersion: string;
    abstractionVersion: string;
    solverVersion: string;
  };
  state: CanonicalPublicState;
  actionHistory: CanonicalAction[];
  actor: 'hero' | 'villain';
}

interface SolverNodeResponse {
  nodeHash: string;
  actions: Array<{
    actionId: string;
    frequency: number; // 0..1
    ev: number;
  }>;
  meta?: {
    source: 'precomputed' | 'cache' | 'live' | 'inhouse';
    solvedAt?: string;
  };
}
```

### 4.2 Grading record model (EV-first)
```ts
interface DecisionGradeRecord {
  decisionId: string;
  nodeHash: string;
  chosenActionId: string;
  evUser: number;
  evBest: number;
  evMix: number;
  evLossVsMix: number;  // PRIMARY
  evLossVsBest: number; // SECONDARY
  isBestAction: boolean;
  seed: string;
  createdAt: string;
}
```

## 5. Runtime and API Flow
- Setup: capture config (`mode`, `tableSize`, `stackDepthBb`, `dealOnlyDecisions`, etc.) and seed.
- Session step:
  1. Build canonical node input.
  2. Resolve solver response via provider chain.
  3. Sample opponent action deterministically when actor is villain.
  4. Grade hero decision with EV-first formulas.
  5. Persist decision record and update aggregates.
- Summary/Review:
  - Compute and display EV-first aggregates.
  - Sort review by `evLossVsMix DESC`, deterministic tie-breakers.

## 6. Determinism Design
- Deterministic RNG seeded per session; sub-seeds derived per decision index.
- Sampling algorithm uses stable cumulative probability traversal.
- For equal-probability boundaries/ties, use deterministic lexical actionId ordering.
- Canonical node hashing + normalized serialization ensure stable cache behavior across runs.

## 7. Range Visualization Design
- 13x13 matrix component with original visual tokens and labels.
- Modes:
  - Hero action frequency view (fold/call/raise intensity)
  - Villain range occupancy view
- Interactions:
  - Hover/focus tooltip with exact frequencies + EV summary
  - Optional export: text first in MVP; image export can be follow-up task
- Explicit non-copy rule: no third-party proprietary labels/assets/branding.

## 8. Testing Strategy
Required unit test groups:
- Canonical hash stability (same input => same hash; semantic-equivalent inputs => same hash).
- Cache lookup behavior (miss -> store -> hit across versioned keys).
- EV grading math (`evLossVsMix`, `evLossVsBest`, best-action flags).
- Deterministic sampling reproducibility by seed.
- Review ordering deterministic tie-breaks.

Gate sequence remains:
1. `npm test`
2. `npx tsc --noEmit --pretty false`
3. `npm run build`

## 9. Risks and Mitigations
- License ambiguity risk -> block provider selection until checklist completes.
- Solver performance risk in browser -> allow service/hybrid design option.
- Strategy drift across solver providers -> enforce adapter + regression fixtures.
- Scope creep (auth/cloud/payments) -> explicitly out of MVP tasks unless re-approved.

## 10. Design Decisions for Open Questions
- Commercialization constraint is accepted as binding.
- MVP remains extension of current v2 architecture, not a platform rewrite.
- Open-source solver is preferred path only when commercialization checks pass.
- In-house solver fallback is planned but deferred unless triggered by licensing gate.

## 11. Sources
- OpenSpiel repository (license and project scope): https://github.com/google-deepmind/open_spiel
- OpenCFR repository (license): https://github.com/stockhamrexa/openCFR
- poker-cfr repository (license): https://github.com/b-inary/poker-cfr

## 12. Phase 2 Preparation (Transition Plan)
This design now includes Phase 2 preparation guidance following completion of Phase 1 task outputs.

### 12.1 Entry Criteria to Start Phase 2
- Phase 1 specs, contracts, and traceability artifacts are committed and archived under:
  - `.kiro/specs/ev-solver-training-v3/archive/phase-1/`
- Gate contract is fixed and remains required:
  1. `npm test`
  2. `npx tsc --noEmit --pretty false`
  3. `npm run build`
- EV-first grading, deterministic replay behavior, and non-copy policy remain binding constraints.

### 12.2 Phase 2 Design Priorities
- Productize runtime paths into stable user-facing flows for preflop/postflop study.
- Harden OpenSpiel service operation (timeouts, retries, startup health-check, diagnostics).
- Expand persistence robustness for cross-session reproducibility and review workflows.
- Move test/gate contract into CI automation with local/CI parity.
- Keep adapter boundary stable so solver provider changes do not break trainer UX behavior.

### 12.3 Phase 2 Guardrails
- Do not introduce proprietary third-party assets, datasets, or copied UX wording.
- Preserve canonical hash/cache key compatibility unless a version bump is explicitly documented.
- Preserve deterministic semantics for sampling, grading order, and review ordering.
- Any intentional behavioral drift from Phase 1 contracts must include migration notes and updated acceptance tests.

### 12.4 Deliverables Expected at Phase 2 Kickoff
- Phase 2 task plan with strict DoD per task.
- CI workflow that enforces the three required gates.
- Runtime operational checklist (service startup, health, failure-mode handling, logs/metadata).
