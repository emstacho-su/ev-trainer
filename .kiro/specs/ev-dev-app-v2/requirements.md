# Requirements — ev-dev-app-v2

## Purpose and scope
Deliver a dev-grade v2 app experience that cleanly separates Training and Practice interaction patterns, keeps EV as the primary metric, and supports minimal spot filtering, Spot-first runtime APIs, and local-only persistence. The goal is a clear UX and API boundary that preserves determinism and allows future solver integration without changing evaluator behavior.

## Personas and user journeys
- **Developer**: runs deterministic sessions with explicit `seed` + `sessionId`, verifies Training vs Practice behavior, inspects EV-first metrics, and validates Spot-first API requests/responses.
- **Operator**: uses the UI to run sessions, reviews results at the end of a session, and compares aggregate EV metrics across sessions.
- **Trainer (content author)**: publishes versioned spot packs, confirms filter coverage, and ensures packs can be consumed by the runtime without GTOWizard data.

## Functional requirements

### Session lifecycle + persistence
- Sessions are identified by `{seed, sessionId}` and are isolated by that composite key.
- Session records are persisted in `localStorage` as versioned JSON and are restored on reload.
- Persistence failures (quota exceeded or malformed data) are surfaced with a clear, non-blocking error state and do not crash the runtime.

### Training vs Practice modes (interaction patterns)
- **Training**:
  - Show per-decision grading immediately after each user action (EV loss vs mix, best-action indicator).
  - Show an end-of-session summary with aggregates (at least mean EV loss, best-action rate, volume).
- **Practice**:
  - Do not show any EV metrics or best-action indicators during the run.
  - Show a neutral “Submitted” / “Recorded” acknowledgement for each action.
  - Unlock review and aggregate metrics only after the session ends.
- Preflop/postflop are filters (street), not separate modes.

### EV-first grading + metrics
- EV is the primary grading metric for all decisions.
- Global stats view includes:
  - Avg EV loss (at least mean; median if easy to include).
  - Best-action rate (% within epsilon of best EV).
  - Volume (# decisions, # sessions).
- Review ordering uses EV loss as the primary sort key and deterministic tie-breakers.

### Spot filters (minimum viable set)
- Filters for spot selection include:
  - `street`: PREFLOP | FLOP | TURN | RIVER
  - `heroPosition`: UTG | HJ | CO | BTN | SB | BB
  - `villainPosition`: UTG | HJ | CO | BTN | SB | BB (assume HU-in-hand)
  - `effectiveStackBbBucket`: [20, 40, 60, 100, 150+]
  - `potType`: SRP | 3BP
- Board texture buckets are out of scope for v2.

### Spot packs (versioned format)
- Spot libraries are versioned packs with a minimal schema defined now (stub data acceptable).
- Runtime loads spot packs by version and uses their metadata for filtering.
- Spot pack format is non-proprietary and does not include GTOWizard assets or solver outputs.

### Runtime API boundary (Spot-first)
- Runtime API routes accept `Spot` objects directly as request payloads.
- Any adapter mapping from Spot to internal runtime format happens inside the runtime layer.
- Canonical node hash support remains only if required by existing routes/tests; direction is Spot-first.

### Solver integration path
- Server-side solver integration is acceptable for v2.
- Evaluator boundary must remain intact so solver integration can be swapped later without changing grading outputs.
- Solver output caching is keyed by canonical node hash (when applicable) and versioned pack identifiers.

### Opponent policy
- Opponent actions are sampled from solver policy frequencies (seeded and deterministic).
- Design supports future “playstyle transforms” (frequency reweighting) without altering EV grading.

## Non-functional requirements
- **Determinism**: stable outputs for identical inputs; all ordering must have explicit tie-breakers.
- **Testability**: grading and sampling are unit-testable with deterministic RNG seeds.
- **Maintainability**: clear separation between UI, runtime, and evaluator; minimal diffs.
- **Performance**: responsive local UI; cached solver outputs prevent redundant computation.

## Validation and error model
- All runtime endpoints validate required inputs and return structured JSON errors with stable codes.
- Error response schema: `{ ok: false, code: string, message: string, details?: object, seed?: string, sessionId?: string }`.
- Status code rules:
  - 400 for invalid/missing inputs
  - 404 for unknown IDs
  - 409 for conflicts (when applicable)

## Edge cases
- Practice mode must not leak EV metrics mid-session.
- LocalStorage quota errors do not corrupt existing session records.
- Review ordering and aggregates are deterministic across reloads for the same `{seed, sessionId}` and pack versions.
- Sampling opponent actions must be reproducible for the same seed and action history.

## Deferred scope
- Database/IndexedDB persistence.
- Export/import flows (beyond localStorage persistence).
- Advanced filters (board textures, 4BP+ pot types).
- Production analytics or auth.

## Non-copy constraint
- Do not copy GTOWizard UI/text/assets/branding/datasets/solver outputs. Use original UX and data structures.
