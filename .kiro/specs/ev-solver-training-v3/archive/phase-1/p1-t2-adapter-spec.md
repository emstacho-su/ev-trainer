# P1.T2 Draft - Solver Adapter Interface Spec (OpenSpiel-first)

Date: 2026-02-03
Task: P1.T2
Status: Draft for review

## Decision context
- Selected provider for forward progress: **OpenSpiel** (provisional, pending full legal/compliance sign-off).
- Adapter remains provider-agnostic so fallback providers can be swapped without changing trainer-facing APIs.

## Adapter goals
1. Stable runtime contract for node policy/EV lookup.
2. Deterministic behavior suitable for seeded replay.
3. EV-first grading compatibility.
4. Explicit error model for API/runtime handling.

## Request contract
```ts
type SolverProvider = 'openspiel' | 'precomputed' | 'inhouse';

interface SolverNodeRequest {
  provider: SolverProvider;
  nodeHash: string;
  context: {
    gameVersion: string;
    abstractionVersion: string;
    solverVersion: string; // e.g., openspiel:<commit-or-release>
    evUnit: 'bb_per_hand';
  };
  state: {
    street: 'preflop' | 'flop' | 'turn' | 'river';
    board: string[]; // canonical card tokens, deterministic ordering
    potBb: number;
    effectiveStackBb: number;
    heroPosition: string;
    villainPosition: string;
    toAct: 'hero' | 'villain';
  };
  actionHistory: Array<{
    actor: 'hero' | 'villain';
    action: 'fold' | 'check' | 'call' | 'bet' | 'raise';
    sizeBb?: number;
  }>;
}
```

## Response contract
```ts
interface SolverActionPolicy {
  actionId: string; // canonical, e.g. "bet_33", "raise_250"
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  sizeBb?: number;
  frequency: number; // normalized [0,1]
  ev: number; // normalized to bb_per_hand
}

interface SolverNodeResponse {
  provider: SolverProvider;
  nodeHash: string;
  actions: SolverActionPolicy[];
  meta: {
    source: 'cache' | 'live' | 'precomputed' | 'fallback';
    solveMs?: number;
    solvedAt?: string;
  };
}
```

## Error model
```ts
type SolverErrorCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_NODE'
  | 'SOLVER_TIMEOUT'
  | 'SOLVER_UNAVAILABLE'
  | 'LICENSE_BLOCKED'
  | 'INTERNAL_ERROR';

interface SolverError {
  ok: false;
  code: SolverErrorCode;
  message: string;
  provider?: SolverProvider;
  nodeHash?: string;
  retriable: boolean;
}
```

## Normalization rules (binding for P1.T2)
- Frequencies MUST sum to 1.0 (+/- 1e-9); adapter renormalizes if needed.
- EV unit MUST be `bb_per_hand` at adapter boundary.
- Actions MUST be emitted in deterministic sort order by `actionId`.
- If OpenSpiel emits action forms outside MVP abstraction, map deterministically to nearest allowed abstraction action and annotate mapping in internal debug logs.

## OpenSpiel mapping notes
- OpenSpiel game state maps into `state + actionHistory` canonical tuple before solve lookup.
- OpenSpiel policy output maps to `actions[].frequency`.
- OpenSpiel value estimates map to `actions[].ev` after unit normalization.
- OpenSpiel integration identifier format: `solverVersion = openspiel:<release-or-commit>`.

## Acceptance checks (P1.T2)
- Contract includes hero/villain action sets.
- EV units are explicit and normalized.
- Version fields are explicit for cache safety.
- Error model is stable for runtime/API surfacing.
- OpenSpiel provider mapping is documented without hard-coding trainer UI to provider internals.
