# Design — ev-runtime-preview

## Module boundaries
- `src/lib/engine/*` remains pure and deterministic.
- NEW: `src/lib/runtime/*` for runtime singletons and wiring:
  - `createRuntime()` builds in-memory cache/store, deterministic solver, and `trainingApi` facade.
  - `gradeDecision()` lives in runtime (EV-first calculations).
- Next.js route handlers only call runtime (no engine internals in route files).
- Route handlers delegate to pure functions under `src/lib/runtime/http/*` for testability.

## Determinism strategy
- seed is explicit (query param or request body); sessionId is explicit; no implicit randomness/time unless injected.
- Seed is explicit and required (query param or request body).
- Runtime supports a fixed clock option for preview mode (stable timestamps/IDs).
- Deterministic RNG is used for opponent sampling and demo solver outputs.
- Cache keyed by canonical node hash; identical inputs yield identical outputs.

## UI approach
- Minimal React UI (Tailwind OK) with original visuals and copy.
- Single page (e.g., `/train`) with tabs for Spot Quiz, Hand Play, Targeted Drill, Review.
- Optionally bridge existing HTML renderers for fastest path, but UI stays original.
- EV loss feedback is primary and prominent.

## Testing approach
- Vitest only; test runtime functions directly (no Next server).
- Export pure handler functions for API routes to test without the server.
- Small focused assertions (key markers, EV labels) and deterministic results.
- Avoid large snapshots; no flaky randomness.
