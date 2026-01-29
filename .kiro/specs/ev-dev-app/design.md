# Design — ev-dev-app (dev-grade)

## Layered architecture
- **Engine** (`src/lib/engine/*`): pure/deterministic logic only (canonicalization, hashing, RNG primitives, solver adapter contract). No clocks, no global randomness.
- **Runtime** (`src/lib/runtime/*`): deterministic composition layer built around the existing runtime-preview pieces (runtimeRegistry + createRuntime). Owns in-memory stores/caches, deterministic clock/IDs, export/import parity helpers.
- **Pure handlers** (`src/lib/runtime/http/*`): pure request validation + DTO shaping + error mapping (no Next.js dependencies). Delegates into runtime via {seed, sessionId} runtimeKey.
- **Next.js app/router** (`src/app/*`): thin route wrappers only (parse → call handler → JSON). No duplicated business logic.

## UI pages (original and minimal)
- **/train**: primary dev console (seed + sessionId always visible). Run modes (spot quiz / targeted drill / hand play), show request/response JSON, show EV metrics, show deterministic runtimeKey + monotonic counters.
- **/review**: EV-sorted review list + detail view. Detail includes replay controls (rerun deterministically), “copy request JSON”, and error visibility.
- **/fixtures**: browse non-proprietary demo fixture packs/tags. “Use fixture” populates /train inputs.
- **/sessions (optional/dev-only)**: introspection of active in-process runtimes (not durable; resets on restart). Clearly labeled as dev tooling (not product UI).

## API/DTO design
### Routes
Keep canonical training routes from runtime preview:

- POST /api/training/spot-quiz
- POST /api/training/hand-play
- POST /api/training/targeted-drill
- POST /api/training/review/list
- POST /api/training/review/detail

Dev-grade additions:

- POST /api/fixtures/list
- POST /api/fixtures/detail
- POST /api/session/export
- POST /api/session/import
- POST /api/session/list (dev-only introspection)
- POST /api/session/reset (optional; dev-only, explicit and safe)

Optional aliases (thin wrappers only; no logic forks):

- POST /api/review/list → delegates to the same pure handler as /api/training/review/list
- POST /api/review/detail → delegates to the same pure handler as /api/training/review/detail

### Request/response types
- Common request fields (required on every endpoint): seed, sessionId.
- Common response fields (success): seed, sessionId, runtimeKey, plus route-specific data.
- Error schema (400/404/409/500): { ok: false, code: string, message: string, details?: object, seed?: string, sessionId?: string }.

### Determinism requirements
- No Date.now() / Math.random() in handlers/routes; only injected deterministic now() and idFactory() owned by runtime.
- Review ordering must be stable: sort by EV loss vs mix (descending) then deterministic tie-breakers (creation index / record id).

## State model
- **SessionKey**: { seed, sessionId }.
- **Runtime registry**: in-memory map keyed by deterministic runtimeKey = f(seed, sessionId) returning the same runtime instance for state persistence in-process.
- **Decision record**: request snapshot + graded EV metrics + deterministic timestamps/sequence index + deterministic record id.
- **Caches**: canonical node hash → solver output (avoid redundant solver calls; stable keying).

## Replay/export format
- Export JSON includes: version, seed, sessionId, deterministic counters (createdSeq/nowCounter), decision records (with request snapshots), and optionally cached node outputs.
- Import reconstructs in-memory state so that:
  - review ordering matches exactly,
  - replaying stored requests reproduces the same outputs (within process determinism constraints).
- DB/persistence: allowed later, but not required here. Export/import is the dev-grade persistence mechanism for this phase and defines the future persistence contract.

## Testing strategy
- Unit tests for deterministic ordering, clock/id allocation, export→import parity, and cache keying stability.
- Handler tests run without Next.js server (pure functions). Validate required fields and error schema.
- Minimal UI render tests only for invariants (mode markers, EV labels, error panel visibility), not for layout fidelity.

## Migration plan from runtime preview
- Reuse as-is: createRuntime, runtimeRegistry, gradeDecision, pure HTTP handlers pattern, and /api/training/* thin routes.
- Add: fixtures module + endpoints + /fixtures page; /review page backed by existing review endpoints; export/import endpoints + minimal UI controls; optional /sessions dev-only introspection.
- Avoid: parallel route families that duplicate training logic (/api/train/*) unless a spec explicitly requires it; any UI/text/assets that create parity with proprietary tools.
