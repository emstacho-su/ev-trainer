# Design — ev-dev-app-v2

## Goals and principles
- Preserve EV-first grading and deterministic behavior across all flows.
- Separate Training (immediate feedback) from Practice (deferred feedback).
- Keep runtime API Spot-first to enable a future server-side evaluator swap.
- Keep UX simple and dev-grade while establishing stable data contracts.

## UX architecture (screens + flow)

### Screens
- **Home**: Mode selection (Training/Practice) + recent sessions list.
- **Session Setup**: Mode (prefilled), filters, pack selection (stub), start.
- **In-Session**: Spot display, action input, feedback panel (Training only), persistent "Recorded" status (Practice).
- **End-of-Session Summary**: aggregate metrics + duration (start/end timestamps).
- **Review Session**: per-decision list + decision drilldown.
- **Global Stats**: top 3 metrics + basic breakdowns by filter buckets.
- **Session List/History**: optional; may be part of Home.

### Primary flow
1. Home -> user selects Training or Practice.
2. Session Setup -> configure filters + pack + seed (if exposed) -> start.
3. In-Session -> decision loop:
   - User submits action.
   - Training: show per-decision grading inline.
   - Practice: show "Recorded" only.
   - User clicks "Next decision" to advance.
4. End-of-Session Summary -> show aggregates and duration -> "Review session".
5. Review Session -> per-decision detail and list.

## Domain model

### Spot (minimal schema)
```
Spot {
  schemaVersion: string,
  spotId: string,               // stable hash or canonical ID
  gameType: "NLHE",
  blinds?: { sb: number, bb: number, ante?: number },
  effectiveStackBb?: number,
  effectiveStackChips?: number,
  heroPosition: "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB",
  villainPosition: "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB",
  potType: "SRP" | "3BP",
  street: "PREFLOP" | "FLOP" | "TURN" | "RIVER",
  board: string[],              // 0..5 cards
  actionHistory: ActionNode[],  // enough to derive decision state
  toAct: "HERO",
  legalActions: LegalAction[]   // compact UI-ready actions
}
```

### SpotPack (versioned)
```
SpotPack {
  schemaVersion: string,
  packId: string,
  name: string,
  description?: string,
  author?: string,
  version: string,              // semver
  createdAt: string,            // ISO date
  spots: Spot[],
  metadata?: {
    tags?: string[],
    filters?: PackFilterHints
  }
}
```

### Pack location
- Store packs as static JSON under `public/packs/` and fetch by URL (single bundled pack in v2).

### SessionRecord (persisted)
```
SessionRecord {
  sessionId: string,
  seed: string,
  mode: "TRAINING" | "PRACTICE",
  packId: string,
  filters: FilterState,
  startedAt: string,            // ISO date
  endedAt?: string,
  decisions: DecisionRecord[],
  aggregates?: SessionAggregates
}
```

### DecisionRecord
```
DecisionRecord {
  index: number,
  spotId: string,
  spot: Spot,
  actionId: string,
  result?: GradingResult,        // only filled for Training or after session end
  recordedAt: string            // ISO date
}
```

### GradingResult (EV-first)
```
GradingResult {
  evBest: number,                // in bb units
  evUser: number,
  evLoss: number,                // evBest - evUser
  isBest: boolean                // evLoss <= epsilon
}
```

### FilterState
```
FilterState {
  street: "PREFLOP" | "FLOP" | "TURN" | "RIVER",
  heroPosition: Position,
  villainPosition: Position,
  effectiveStackBbBucket: "20" | "40" | "60" | "100" | "150+",
  potType: "SRP" | "3BP" | "ANY"
}
```

## API/DTO design

### Route: POST /api/session/start
**Input**
```
{
  seed: string,
  mode: "TRAINING" | "PRACTICE",
  packId: string,
  filters: FilterState
}
```
**Output**
```
{
  ok: true,
  sessionId: string,
  spot: Spot,
  decisionIndex: number
}
```

### Route: POST /api/session/submit
**Input**
```
{
  sessionId: string,
  spot: Spot,        // Spot-first payload
  actionId: string
}
```
**Output (Training)**
```
{
  ok: true,
  result: GradingResult
}
```
**Output (Practice)**
```
{
  ok: true,
  recorded: true
}
```

### Route: POST /api/session/next
**Input**
```
{ sessionId: string }
```
**Output**
```
{
  ok: true,
  spot: Spot,
  decisionIndex: number
}
```

### Route: GET /api/session/:id
**Output**
```
{
  ok: true,
  session: SessionRecord
}
```

### Route: GET /api/stats
**Output**
```
{
  ok: true,
  aggregates: GlobalAggregates,
  breakdowns: GlobalBreakdowns
}
```

### Error model
- JSON error schema: `{ ok: false, code: string, message: string, details?: object }`
- Status codes: 400 invalid, 404 not found, 409 conflict.

## State management

### UI state (client)
- `mode`, `filters`, `packId` on Setup.
- `activeSessionId`, `currentSpot`, `decisionIndex`, `lastResult`, `status`.
- `sessionList` derived from localStorage index.
- `globalStats` loaded from API.

### Runtime state (server)
- In-memory registry keyed by `sessionId` (seed embedded in session record).
- Deterministic spot selection uses `{seed, sessionId, decisionIndex}`.

## Persistence design (localStorage)

### Storage keys
- `ev-trainer:sessions:index` -> array of `{ sessionId, mode, packId, startedAt, endedAt }`
- `ev-trainer:session:<sessionId>` -> full `SessionRecord`

### Behavior
- Save on every decision and on session end.
- On app load, rehydrate session list and allow resume/review.
- Provide "delete session" and "clear all sessions" actions.
- Handle quota errors with a non-blocking warning state.

## Evaluator + solver integration

### Evaluator boundary
- Default v2 shape: `Evaluator.evaluate(spot, actionId, context) -> GradingResult`
- Future-ready shapes (documented only for now):
  - `Evaluator.evaluate(spot) -> { evByAction }`
  - `Evaluator.evaluate(spot, candidateActions) -> { evByAction }`
- v2 assumes `Spot.legalActions` is present so the evaluator can infer best-action even with the default shape.
- Evaluator is an interface and can be backed by:
  - Stub/mock implementation (v2 default)
  - Server-side solver service (HTTP)
- Runtime never calls solver directly; it calls the Evaluator.

### Caching
- Cache at evaluator layer using a decorator.
- Cache key includes: `spotId + actionId + packId + evaluatorVersion`.

## Determinism and ordering

### Determinism rules
- All randomness derived from `{seed, sessionId, decisionIndex, nodeId}`.
- No `Date.now()` or `Math.random()` for decision selection or opponent sampling.
- Stable ordering for lists:
  - Session list: `startedAt` DESC (explicit).
  - Review list: decision index ASC (0..n-1).
  - Spot selection: deterministic order within filtered candidates.

### Practice vs Training equivalence
- Same seed + pack + filters must yield identical decision sequences.
- Only difference is grading visibility timing.

## Opponent policy
- Opponent actions sampled from solver frequencies.
- Sampling stream derived from `seed + nodeId + decisionIndex`.
- Future extension point: `reweight(freqs, params)` without changing EV grading.

## UI components (high level)
- `ModeSelect`, `SessionSetupForm`, `SpotViewer`, `ActionInput`, `FeedbackPanel`, `RecordedStatus`, `SummaryStats`, `ReviewList`, `DecisionDetail`, `GlobalStats`.

## Tests
- Unit tests for grading epsilon (best-action threshold).
- Unit tests for deterministic sampling (seeded).
- API contract tests for start/submit/next responses (Training vs Practice).
- localStorage round-trip tests for session index + records.
- Determinism replay test: same seed + pack + filters -> identical decision sequence for Training vs Practice.
- UI smoke test: start session and submit an action without direct engine access.

## Migration and future work
- Add board texture buckets and 4BP+ pot types.
- Add export/import and IndexedDB storage.
- Add multiple pack registry UI.
- Replace evaluator stub with real solver service.

## Non-goals
- Multiway pots.
- Playstyle transform implementation (design only).
- Real solver correctness guarantees in v2.
