# EV Trainer (Runtime Preview)

## Manual preview
1. Install dependencies: `npm install`
2. Start the Next.js dev server: `npm run dev`
3. Open the local URL printed by Next.js and visit `/train`.
4. Enter a seed + sessionId, then use the Spot Quiz / Hand Play / Targeted Drill / Review tabs.

## Tests
- Run the full suite: `npm test`
- Sanity check: `npx vitest`

## Engine API (Task 1)
The engine is the source of truth for grading, records, and deterministic sampling.
Public entry points live in `src/lib/engine/index.ts`.

Example usage:
```ts
import { createSession, applyAction, InMemorySpotSource, nextSpot } from "./src/lib/engine";

const session = createSession({ seed: "seed-1", sessionId: "session-1" });
const source = new InMemorySpotSource([{ node: someNode }]);
const spot = nextSpot(source, { streets: ["FLOP"] }, "seed-1", 0);

const result = applyAction(session, {
  mode: "spot-quiz",
  node: spot!.node,
  userActionId: "CHECK",
});
```

## Session record schema
Session records are versioned and serializable via:
- `serializeSession(record)`
- `deserializeSession(raw)`

Each record includes:
- `schemaVersion`, `seed`, `sessionId`, `mode`, `startedAt`, `endedAt?`
- `entries[]` with per-decision `node` (or `spot`), `userActionId`, `metrics`, and `grade`

### Determinism note
Seed and sessionId inputs are required for every request. Reusing the same inputs
replays the same solver outputs and EV grading.
