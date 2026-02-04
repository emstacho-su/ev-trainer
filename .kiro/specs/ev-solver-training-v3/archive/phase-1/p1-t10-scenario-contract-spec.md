# P1.T10 - Preflop/Postflop Scenario Contract Spec

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## Intent
Define strict, versioned scenario payload contracts for `preflop` and `postflop` trainer modes.

## Design Inspiration (Non-Copy)
- Use practical spot dimensions commonly expected in modern solver trainers:
  - game type (`cash`/`mtt`)
  - table size (`heads-up`/`6-max`/`9-max`)
  - stack depths
  - preflop line families (`open-raise`, `vs-open`, `vs-3bet`, `vs-4bet`)
  - postflop entry pools with board context
- Keep wording, fields, and data structures original to this project.

## Contract Versioning
- Envelope field: `schemaVersion`
- Initial contract version: `scenario.v1`
- Any breaking field change MUST bump major version.

## Shared Config Snapshot (Required)
```ts
interface TrainerScenarioConfigV1 {
  schemaVersion: "scenario.v1";
  mode: "preflop" | "postflop";
  gameType: "cash" | "mtt";
  tableSize: "heads-up" | "6-max" | "9-max";
  stackDepthBb: 50 | 100 | 200;
  villainBehavior: "gto";
  dealOnlyDecisions: boolean;
}
```

## Scenario Union
```ts
type TrainerScenarioV1 = PreflopScenarioV1 | PostflopScenarioV1;
```

### Preflop Scenario
```ts
interface PreflopScenarioV1 {
  scenarioType: "preflop";
  scenarioId: string;
  lineFamily: "open-raise" | "vs-open" | "vs-3bet" | "vs-4bet";
  heroPosition: "SB" | "BB" | "UTG" | "HJ" | "CO" | "BTN";
  villainPosition: "SB" | "BB" | "UTG" | "HJ" | "CO" | "BTN";
  actionHistory: string[];
}
```

### Postflop Scenario
```ts
interface PostflopScenarioV1 {
  scenarioType: "postflop";
  scenarioId: string;
  pool: {
    poolId: string;
    poolVersion: string;
    entryStreet: "FLOP" | "TURN" | "RIVER";
    board: string[];
    boardTextureBucket?: string;
  };
  preflopContext: {
    lineFamily: "open-raise" | "vs-open" | "vs-3bet" | "vs-4bet";
    heroPosition: "SB" | "BB" | "UTG" | "HJ" | "CO" | "BTN";
    villainPosition: "SB" | "BB" | "UTG" | "HJ" | "CO" | "BTN";
    actionHistory: string[];
  };
}
```

## Deterministic Regeneration Contract
- Regeneration key input:
  - normalized config snapshot
  - normalized scenario payload
- Regeneration key output:
  - `sha256(stableStringify({config, scenario}))`
- Equivalent payload ordering MUST produce identical key.

## `dealOnlyDecisions` Filtering Contract
- `dealOnlyDecisions=false` => include all decision points.
- `dealOnlyDecisions=true` => include only when all are true:
  1. `legalActionCount >= 2`
  2. `hasForcedAction === false`
  3. `allActionsEquivalent === false`

## Fixture Requirements
- At least one valid preflop fixture.
- At least one valid postflop fixture.
- Invalid fixture cases:
  - wrong `scenarioType`
  - unsupported `lineFamily`
  - invalid `tableSize`
  - missing pool metadata for `postflop`
  - malformed board/action history
