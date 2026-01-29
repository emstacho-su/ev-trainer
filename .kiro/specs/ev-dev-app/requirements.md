# Requirements — ev-dev-app (dev-grade)

## Purpose and scope
Build a dev-grade running app that lets a developer/operator run deterministic training sessions, review EV-graded results, and export/import records without any external persistence. This phase focuses on end-to-end flows, determinism, and correctness. State is in-process only and resets on server restart; export/import is the dev-grade persistence mechanism.

## Personas and user journeys
- **Developer**: runs the app locally, uses explicit seed/sessionId, exercises all training modes, inspects EV loss metrics and solver mix outputs, exports/imports session JSON, and verifies deterministic parity.
- **Operator**: uses the UI to run drills, monitors review items by EV loss, replays decisions deterministically, and validates API behavior (status codes + stable error codes).
- **Trainer (content author)**: selects fixture packs (non-proprietary), checks coverage via tags/filters, and confirms grading + review ordering stability across repeated runs.

## Functional requirements
### Session lifecycle
- Sessions are identified by {seed, sessionId} and are isolated from one another by that composite key.
- “Create session” ensures a runtime exists for {seed, sessionId} and returns a stable runtimeKey plus deterministic counters metadata; it must not introduce nondeterministic IDs or timestamps.
- “List sessions” is dev-only introspection of currently active in-process runtimes and must be deterministically ordered using explicit tie-breakers (e.g., creation sequence, then runtimeKey).
- “Close session” removes the runtime instance from the in-process registry for that {seed, sessionId}; it must not affect other sessions.

### Training modes
- Spot quiz: single decision prompt with EV grading (evUser, evMix, evBest, evLossVsMix, evLossVsBest).
- Targeted drill: repeated prompts selected deterministically from fixtures using {seed, sessionId} and an explicit step/sequence index; supports filters (tags/position/stack size) with deterministic ordering of candidates.
- Hand play: multi-street flow that advances deterministically given user action history; opponent actions sampled deterministically from solver policy (seeded; no ambient randomness).

### Review list and detail + replay
- Review list is sorted by EV loss vs mix (primary: evLossVsMix descending, worst-first) with stable deterministic secondary ordering (e.g., createdSeq ascending, then recordId).
- Review detail supports deterministic replay using stored request snapshots (inputs + action history + derived deterministic indices) and must reproduce original EV outputs exactly for the same {seed, sessionId} within the same fixture/version set.

### Export/import session records
- Export returns a versioned JSON bundle that includes: {version, seed, sessionId, deterministicCounters, records[]} and sufficient request snapshots to replay.
- Import validates the bundle and reconstructs in-memory session state. Import must be all-or-nothing (no partial state on failure).
- Import conflict behavior is explicit: importing into a different {seed, sessionId} without an explicit override yields a validation error (e.g., 409 conflict or 400 invalid argument, per API conventions).

### Validation and error model
- All endpoints validate required fields and return structured JSON errors with stable codes.
- Error response schema: { ok: false, code: string, message: string, details?: object, seed?: string, sessionId?: string }.
- Status code rules:
  - 400 for missing/invalid inputs (seed/sessionId/mode/ids)
  - 404 for unknown record/fixture IDs
  - 409 for import/session conflicts (when applicable)
- Error codes are stable and documented (e.g., INVALID_ARGUMENT, NOT_FOUND, CONFLICT) with details carrying specific field-level reasons (e.g., seed parse failure).

### Determinism contract
- Explicit seed and sessionId are required for all training calls and any dev-grade session/export/import operations.
- No time-based IDs; IDs and timestamps are deterministic counters or injected clocks owned by the runtime (no Date.now() / Math.random() usage in routes/handlers).
- Outputs must be stable for identical inputs, with all ordering defined via explicit tie-breakers (review ordering, session list ordering, candidate ordering for drills).
- Caching behavior is deterministic: cache keys derive from canonical node hash + versioned fixture/solver identifiers; repeated requests reuse cached solver outputs.

### Fixture strategy
- Use non-proprietary, minimal demo fixtures for hands/spots/tags. Fixtures live in-repo and are deterministic across runs.
- Fixtures are addressable via stable identifiers (e.g., fixturePackId, spotId) and have a deterministic ordering for browsing/filtering.
- Fixtures include tags/metadata sufficient to support targeted drill filters without any external dataset dependencies.

## Non-functional requirements
- **Determinism**: reproducible behavior across repeated calls, replays, and export/import parity (within the same fixture/version set).
- **Testability**: handlers and grading logic are unit-testable without a running Next.js server; determinism properties are covered by tests.
- **Maintainability**: clear separation of engine, runtime, and HTTP handlers; thin Next routes; localized diffs.
- **Performance**: acceptable local responsiveness; cached solver outputs reduce redundant computation.

## Edge cases
- Duplicate sessionId with different seed is treated as a distinct session key.
- Replays must match original EV outputs exactly; discrepancies are treated as determinism bugs.
- Ordering ties are resolved deterministically and explicitly (session list, review list, drill candidate selection).
- Invalid or missing inputs return structured errors with stable codes and field-level details.
- Importing malformed JSON yields validation errors and no partial state; importing mismatched session metadata triggers conflict handling.
- RNG-dependent opponent actions must be reproducible; drill selection must be reproducible for the same {seed, sessionId} and step index.
- Server restart resets in-process state; export/import is the supported way to persist dev sessions across restarts.

## Deferred scope
- Database or persistent storage (allowed later, not required now).
- User accounts, auth, and multi-tenant environments.
- Production analytics dashboards.

## Non-copy constraint
- Do not copy GTOWizard UI/text/assets/branding/datasets/solver outputs. Use original UX, copy, and fixture data structures.
