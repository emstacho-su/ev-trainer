# Tasks — ev-dev-app (dev-grade)

## Task A: Runtime consolidation (reuse-first) + deterministic record model
**Objective**: Extend the existing runtime-preview runtime/registry to support a dev-grade record model suitable for review + replay + export/import, without rebuilding parallel state.

**Scope (in)**
- Reuse existing deterministic runtime registry keyed by {seed, sessionId}; define/confirm stable runtimeKey.
- Define canonical DecisionRecordSnapshot (inputs needed for replay, EV metrics, deterministic counters: createdSeq, recordId).
- Explicit deterministic ordering rules (review list primary metric + tie-breakers).

**Scope (out)**
- No DB or external storage.
- No engine refactors unless required.

**Acceptance criteria**
- Records include sufficient request snapshots to deterministically replay.
- Review ordering is defined and tested: evLossVsMix desc, then createdSeq asc, then recordId asc.
- Runtime continues to avoid Date.now()/Math.random() unless injected.

**Files likely touched**
- src/lib/runtime/runtimeRegistry.ts (if needed for metadata/introspection only)
- src/lib/runtime/* (record model module, deterministic counters helpers)

**Determinism checklist**
- No ambient time/randomness.
- All ordering has explicit tie-breaks.
- Isolation by {seed, sessionId}.

**Tests/gates to run**
- Unit tests: ordering tie-breaks + record snapshot completeness.
- Spec gates (all three): requirements/design/tasks.

## Task B: Fixtures + deterministic selection (targeted drill foundation)
**Objective**: Define non-proprietary fixture packs and deterministic candidate ordering/selection so targeted drill and spot quiz have real dev content.

**Scope (in)**
- Fixture pack format and stable IDs (fixturePackId, spotId).
- Deterministic candidate ordering for filters (tags/position/stack).
- Deterministic selection rule (seed + sessionId + step index).

**Scope (out)**
- No proprietary datasets/solver outputs.
- No giant fixture library; start minimal.

**Acceptance criteria**
- Fixture browsing returns deterministically ordered results.
- Targeted drill selection is reproducible for same {seed, sessionId, stepIndex, filters}.
- Fixtures live in-repo and are deterministic.

**Files likely touched**
- src/lib/runtime/fixtures/*
- src/lib/runtime/* (selection logic utilities)

**Determinism checklist**
- Selection uses only seeded RNG / deterministic indexing.
- Filter ordering is deterministic.

**Tests/gates to run**
- Unit tests: fixture ordering + selection reproducibility.
- Spec gates (all three).

## Task C: Fixture schema validation + tooling (content pipeline without DB)
**Objective**: Prevent fixture drift by adding a deterministic schema validator and a minimal fixture tooling loop.

**Scope (in)**
- Define a strict fixture schema (types + runtime validation).
- Add a validator script that checks:
  - required fields present
  - stable IDs (fixturePackId, spotId) uniqueness
  - deterministic ordering expectations (e.g., stable sort keys)
  - tag normalization rules
- Add a small “fixture pack smoke set” that’s used in tests.

**Scope (out)**
- No external datasets or solver output dumps.
- No large fixture libraries.

**Acceptance criteria**
- CI fails if fixtures are malformed or non-deterministically ordered.
- Targeted drill candidate ordering is stable and validated.

**Files likely touched**
- src/lib/runtime/fixtures/schema.ts
- src/lib/runtime/fixtures/validateFixtures.ts
- src/lib/runtime/fixtures/packs/*
- package.json (add a fixtures:validate script)

**Determinism checklist**
- Validation must not depend on object iteration order; enforce explicit sorting where needed.

**Tests/gates to run**
- npm test
- npm run fixtures:validate (new)
- Spec gates (all three)

**Dependencies**
- Depends on Task B (fixtures).

## Task D: Export/import bundle (versioned) + parity tests
**Objective**: Implement versioned export/import that reconstructs session state and guarantees replay parity, with explicit conflict behavior.

**Scope (in)**
- Export bundle: {version, seed, sessionId, deterministicCounters, records[]}.
- Import validation (all-or-nothing; no partial state).
- Conflict semantics (mismatched session unless explicit override).

**Scope (out)**
- No DB persistence.

**Acceptance criteria**
- Export→Import reconstructs review list ordering exactly.
- Replay of imported records reproduces EV outputs exactly (within same fixtures/version set).
- Malformed import yields validation error and leaves runtime unchanged.

**Files likely touched**
- src/lib/runtime/export.ts
- src/lib/runtime/import.ts
- src/lib/runtime/* (bundle types + validators)

**Determinism checklist**
- Versioned bundle; stable ordering and counters preserved.
- No nondeterministic IDs/time introduced during import.

**Tests/gates to run**
- Parity tests: export→import→replay.
- Spec gates (all three).

## Task E: Pure HTTP handlers + DTO envelope standardization
**Objective**: Implement/extend pure handlers so all endpoints share a consistent response envelope and stable error codes, aligned with dev-grade requirements.

**Scope (in)**
- Validation for required seed + sessionId on every endpoint.
- Stable error codes (prefer INVALID_ARGUMENT, NOT_FOUND, CONFLICT) with field-level details.
- Standard response envelope (e.g., {ok, seed, sessionId, runtimeKey, data}).

**Scope (out)**
- No UI work.

**Acceptance criteria**
- All handlers are Next-independent.
- Error payloads are stable and deterministic (including deterministic ordering of details fields).

**Files likely touched**
- src/lib/runtime/http/validate.ts
- src/lib/runtime/http/errors.ts
- src/lib/runtime/http/handlers.ts

**Determinism checklist**
- Validation ordering deterministic.
- No ambient time/randomness in handlers.

**Tests/gates to run**
- Handler tests: missing seed/sessionId; unknown IDs; conflict behavior.
- Spec gates (all three).

## Task F: Next.js route wiring (thin wrappers) + route surface decision
**Objective**: Wire Next App Router routes as thin wrappers to pure handlers, and explicitly decide canonical vs alias routes to avoid fragmentation.

**Scope (in)**
- Keep canonical /api/training/* routes; add new /api/session/*, /api/fixtures/* routes as needed.
- If /api/review/* aliases are required, implement as thin wrappers only.

**Scope (out)**
- No duplicated logic in routes.

**Acceptance criteria**
- Routes are thin and only delegate to pure handlers.
- All routes enforce required seed + sessionId.

**Files likely touched**
- src/app/api/**

**Determinism checklist**
- No Date.now/Math.random in routes.
- Identical request payloads → identical responses for same runtime.

**Tests/gates to run**
- Build passes (npm run build).
- Spec gates (all three).

## Task G: Typed client helpers for UI ↔ handlers (contract hygiene)
**Objective**: Reduce UI/DTO drift by creating minimal typed request helpers used by UI pages (no new framework).

**Scope (in)**
- Create a small client utility layer that:
  - enforces seed + sessionId inclusion
  - standardizes response envelope handling (ok + error parsing)
  - provides typed functions for training/review/fixtures/export/import endpoints

**Scope (out)**
- No generated SDKs or OpenAPI toolchains.

**Acceptance criteria**
- UI calls go through typed helpers (not ad-hoc fetch calls).
- Error handling is consistent across pages.

**Files likely touched**
- src/lib/ui/apiClient.ts (or src/lib/runtime/http/client.ts)
- src/app/** pages updated to use the client

**Determinism checklist**
- Client always passes explicit seed + sessionId.
- Client does not add timestamps or random IDs.

**Tests/gates to run**
- npm test
- npm run build
- Spec gates (all three)

**Dependencies**
- Depends on Task E/Task F (handler envelope + routes).

## Task H: UI (original + minimal) for dev-grade flows
**Objective**: Implement the minimal pages needed for a real dev run: train, review, fixtures, and optional session introspection, with strong error visibility.

**Scope (in)**
- /train: request builder + response viewer + clear errors + show runtimeKey and monotonic counters.
- /review: list + detail + replay + copy request JSON.
- /fixtures: browse + apply fixture to /train.
- /sessions (dev-only): optional introspection of active runtimes.

**Scope (out)**
- No GTOWizard-like layout/copy parity.
- No heavy UI frameworks.

**Acceptance criteria**
- End-to-end: choose fixture → run training → record appears in review → replay matches original → export/import works.
- UI surfaces 400/404/409 payloads clearly.

**Files likely touched**
- src/app/train/*
- src/app/review/*
- src/app/fixtures/*
- src/app/sessions/*

**Determinism checklist**
- UI always includes explicit seed + sessionId in requests.
- Replay uses stored request snapshots.

**Tests/gates to run**
- Minimal UI tests for invariants (EV labels, error panel).
- npm test, npm run build.
- Spec gates (all three).

## Task I: End-to-end smoke test harness (without Playwright)
**Objective**: Add a deterministic “happy-path” smoke test that exercises the core flows end-to-end (without a browser framework).

**Scope (in)**
- Add a test that:
  - starts from a known {seed, sessionId}
  - runs at least one training call
  - verifies a review record appears
  - replays deterministically
  - exports → imports into a fresh runtime key (or resets then imports)
  - verifies parity (ordering + EV metrics)
- Implement as integration tests against pure handlers/runtime (no Next server required).

**Scope (out)**
- No Playwright, no full UI automation.

**Acceptance criteria**
- One command (npm test) validates the full core lifecycle deterministically.
- Test is stable (no flakiness).

**Files likely touched**
- src/lib/runtime/smoke.test.ts
- src/lib/runtime/http/smokeHandlers.test.ts (optional)

**Determinism checklist**
- Test uses explicit seed/session and fixed fixtures.
- Test fails if ambient nondeterminism is introduced.

**Tests/gates to run**
- npm test
- Spec gates (all three)

**Dependencies**
- Depends on Task B (fixtures) + Task D (export/import) + Task E (handlers).

## Task J: Determinism regression suite (must-not-break tests)
**Objective**: Add tests that prevent accidental nondeterminism regressions across runtime, handlers, and review ordering.

**Scope (in)**
- “Same input → same output” tests for each training mode.
- Review ordering tie-break tests (EV loss ties).
- Cache determinism tests (same node hash returns cached output).

**Scope (out)**
- No performance benchmarking.

**Acceptance criteria**
- Regression tests fail if ambient time/randomness is introduced.
- Replay parity is enforced as a hard invariant.

**Files likely touched**
- src/lib/runtime/**/*.test.ts
- src/lib/runtime/http/**/*.test.ts

**Determinism checklist**
- Explicit seeds, injected clocks/ids in tests.
- No test flakiness tolerated.

**Tests/gates to run**
- npm test.
- Spec gates (all three).

## Task K: “Developer release” checklist + golden bundles (regression artifacts)
**Objective**: Improve the development cycle by adding a lightweight release checklist and golden export bundles used for regression detection.

**Scope (in)**
- Define a “dev release checklist” (manual steps) that includes:
  - run full DoD commands
  - verify /train + /review basic flow
  - export/import a known bundle
- Add 1–3 “golden” export bundles committed to repo (small, non-proprietary) for regression tests:
  - ensure bundle versioning stability
  - ensure import/replay parity over time

**Scope (out)**
- No semantic versioning automation or release tooling frameworks.

**Acceptance criteria**
- Golden bundles are validated in tests (import + replay parity).
- Checklist is short and used before merges/releases.

**Files likely touched**
- docs/release-checklist.md
- src/lib/runtime/goldenBundles/* (or testdata/*)
- src/lib/runtime/goldenBundles.test.ts

**Determinism checklist**
- Golden bundles must be fixture-version pinned and deterministic across runs.

**Tests/gates to run**
- npm test
- Spec gates (all three)

**Dependencies**
- Depends on Task D (export/import) and Task I (smoke harness) for parity enforcement.

## Task L: Developer docs + runbooks (operational maturity)
**Objective**: Document how to run, debug, and extend the dev app without tribal knowledge, including determinism rules and replay/export workflows.

**Scope (in)**
- Add/extend docs for:
  - local dev setup + WSL pitfalls
  - determinism contract (seed/sessionId, monotonic time/IDs, ordering tie-breakers)
  - API usage examples (curl payloads)
  - “How to reproduce a bug” workflow (export bundle + replay)
  - fixture authoring guidelines (format, IDs, tags, ordering, validation)
  - Minimal diagrams are OK (text-first).

**Scope (out)**
- No doc generator frameworks.
- No long marketing copy.

**Acceptance criteria**
- A new dev can run /train and reproduce a deterministic scenario using only the docs.
- Docs clearly state what resets on restart and how export/import works.

**Files likely touched**
- README.md
- docs/determinism.md
- docs/api.md
- docs/fixtures.md
- docs/architecture.md (optional)

**Determinism checklist**
- Docs must specify deterministic ordering and replay invariants explicitly.

**Tests/gates to run**
- Spec gates (all three).
- npm run build (ensure docs don’t break anything).

**Dependencies**
- Depends on Task D (export/import) and Task B/Task C (fixtures + validation) so docs reflect real behavior.

## Task M: DB/persistence readiness plan (deferred but designed)
**Objective**: Define a clear persistence upgrade path without implementing DB now (DB allowed later).

**Scope (in)**
- Define persistence interfaces and boundaries:
  - DecisionStore interface (formalize if needed)
  - serialization contract compatibility with export/import bundles
- Add a short design note for “DB later”:
  - expected tables/entities
  - migration strategy
  - determinism considerations (ordering, IDs, timestamps)

**Scope (out)**
- No DB library, no migrations, no actual persistence implementation.

**Acceptance criteria**
- The codebase has a clearly documented persistence seam.
- Export/import remains the canonical dev persistence mechanism for this phase.

**Files likely touched**
- docs/persistence-plan.md
- src/lib/runtime/stores/* (interfaces only, if missing)

**Determinism checklist**
- Persistence plan preserves deterministic ordering and avoids wall-clock timestamps as ordering keys.

**Tests/gates to run**
- Spec gates (all three)

**Dependencies**
- Depends on Task D (export/import contract).

## Task N: CI workflow + gate enforcement (development-cycle hardening)
**Objective**: Add CI automation so every PR consistently runs the same test/build/spec gates and prevents regressions from landing.

**Scope (in)**
- Add a GitHub Actions workflow that runs:
  - npm ci
  - npm test
  - npm run build
  - npx promptfoo eval -c promptfoo/requirements-gate.yaml --no-write
  - PROMPTFOO_DISABLE_TEMPLATING=true npx promptfoo eval -c promptfoo/gates/ev-runtime-preview-*-gate.yaml --no-write
  - PROMPTFOO_DISABLE_TEMPLATING=true npx promptfoo eval -c promptfoo/gates/ev-dev-app-*-gate.yaml --no-write
- Ensure failure blocks merge (no “allow failing” for gates).

**Scope (out)**
- No new lint frameworks or heavy tooling.
- No telemetry/analytics.

**Acceptance criteria**
- CI runs on PRs and on pushes to main.
- CI fails if any test/build/promptfoo gate fails.
- CI output is readable (separate steps for each gate).

**Files likely touched**
- .github/workflows/ci.yml (or equivalent)

**Determinism checklist**
- CI must not depend on wall-clock randomness (no flaky tests; no nondeterministic snapshots).

**Tests/gates to run**
- CI run itself (trigger via PR).
- Local: npm test, npm run build, promptfoo gates.

**Dependencies**
- Depends on Task J (determinism regression suite) to reduce flakiness risk.

## Anti-scope
- No database or persistent storage implementation in this phase (DB is deferred, allowed later).
- No auth, payments, telemetry, or multi-user features.
- No Playwright/Storybook/lint framework expansions.
- No proprietary solver outputs or copied UI/wording.

## Deferred
- Actual DB/persistence implementation, migrations, and multi-process session persistence.
- Multi-user/session auth.
- Any production solver integration and licensing workflows.
