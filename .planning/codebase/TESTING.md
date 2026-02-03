# Testing Patterns

**Analysis Date:** 2026-02-03

## Test Framework

**Runner:**
- Vitest v4.0.18
- Config: `vitest.config.ts`
- Environment: node

**Assertion Library:**
- Vitest built-in expect() API

**Run Commands:**
```bash
npm run test              # Run all tests once (passWithNoTests flag)
npm run test:watch       # Watch mode, re-runs on changes
npm run test:cov         # Run with coverage (text + HTML reporter)
```

## Test File Organization

**Location:**
- Co-located with source: test file at same level as implementation
- Pattern: `[module].test.ts` paired with `[module].ts`

**Naming:**
- `.test.ts` suffix (not `.spec.ts`)
- Example: `action.test.ts`, `grading.test.ts`, `sessionHandlers.test.ts`

**Structure:**
```
src/lib/engine/
├── action.ts
├── action.test.ts
├── grading.ts
├── grading.test.ts
├── spot.ts
├── spot.test.ts
└── ...

src/__tests__/
├── determinismReplay.test.ts
├── apiSessionContract.test.ts
├── storageRoundTrip.test.ts
└── uiSmokeCoreLoop.test.ts
```

Integration tests live in `src/__tests__/` directory (35 test files across codebase).

## Test Structure

**Suite Organization:**
```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { gradeDecision } from "./grading";
import type { SolverNodeOutput } from "./solverAdapter";

describe("gradeDecision", () => {
  it("computes EV mix, best, and losses for a golden output", () => {
    const output: SolverNodeOutput = {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CHECK", frequency: 0.6, ev: 1.2 },
        { actionId: "BET_75PCT", frequency: 0.4, ev: 0.4 },
      ],
    };

    const grade = gradeDecision(output, "BET_75PCT");

    expect(grade.evMix).toBeCloseTo(0.88, 6);
    expect(grade.evBest).toBeCloseTo(1.2, 6);
    expect(grade.evLossVsMix).toBeCloseTo(0.48, 6);
    expect(grade.isBestAction).toBe(false);
  });
});
```

**Patterns:**
- `describe()` creates test suites, typically one per module/function
- `it()` (alias for `test()`) names individual test cases
- `beforeEach()` for setup/teardown between tests
- Arrange-Act-Assert pattern implicit but clear in test structure

## Mocking

**Framework:** Vitest spies (no explicit mock library detected)

**Patterns:**
Test files create test-specific factories and helpers rather than using mocks:

```typescript
// From handlers.test.ts
function makeNode(potBb: number): CanonicalNode {
  return {
    gameVersion: "test-game",
    abstractionVersion: "test-abstraction",
    solverVersion: "test-solver",
    publicState: {
      street: "FLOP",
      potBb,
      effectiveStackBb: 100,
      board: ["Ah", "Kd", "2c"],
      toAct: "BTN",
    },
    // ... rest of node
  };
}

function expectOk<T>(result: HandlerResult<T>): T {
  if (result.status !== 200) {
    throw new Error(`expected status 200, got ${result.status}`);
  }
  return result.body as T;
}
```

**What to Mock:**
- In-memory stores are reset via explicit functions: `clearRuntimeRegistry()`, `clearSessionStore()`, `clearBundledPackCache()`
- External solver outputs mocked via test factories (makeNode, test data objects)
- State isolation via beforeEach teardown

**What NOT to Mock:**
- Core business logic tested directly (no mocking of deterministic functions)
- Real algorithm implementations tested end-to-end
- Storage/registry state tested through actual store interactions

**Example Pattern from `src/__tests__/determinismReplay.test.ts`:**
```typescript
function resetState(): void {
  clearSessionRegistry();
  clearSessionStore();
  clearBundledPackCache();
}

function expectOk<T extends object>(result: ApiResult<T>): T {
  expect(result.status).toBe(200);
  if ("error" in result.body) {
    throw new Error(`expected success response, got ${result.body.error.code}`);
  }
  return result.body;
}

describe("determinism replay (training vs practice)", () => {
  beforeEach(() => {
    resetState();
  });

  it("replays identical decision signatures for training and practice with matching seed/pack/filters", () => {
    const runInput = {
      seed: "replay-seed",
      filters: { street: "FLOP" } satisfies SpotFilterInput,
      limit: 10,
    };

    const training = collectDecisionSequence({
      ...runInput,
      mode: "TRAINING",
    });
    resetState();
    const practice = collectDecisionSequence({
      ...runInput,
      mode: "PRACTICE",
    });

    expect(training.length).toBeGreaterThan(1);
    expect(practice).toEqual(training);
  });
});
```

## Fixtures and Factories

**Test Data:**
Test data is created via factory functions with override support:

```typescript
// From globalStats.test.ts
function completeRecord(overrides: Record<string, unknown> = {}) {
  return {
    session: { isComplete: true, filters: { street: "FLOP", potType: "SRP", effectiveStackBbBucket: "40" } },
    completedAt: "2026-02-03T12:00:00.000Z",
    aggregates: {
      volume: 4,
      meanEvLoss: 0.5,
      bestActionRate: 0.25,
    },
    ...overrides,
  };
}

// Usage with partial overrides
const stats = computeGlobalStats([
  completeRecord(),
  completeRecord({
    session: {
      isComplete: true,
      filters: { street: "TURN", potType: "3BP", effectiveStackBbBucket: "100" },
    },
    aggregates: { volume: 6, meanEvLoss: 0.2, bestActionRate: 0.5 },
  }),
]);
```

**Location:**
- Defined at top of test file before test suite
- Helper functions (factories, asserters) before `describe()`
- Reused across multiple tests within same file

## Coverage

**Requirements:** No coverage enforcement configured

**View Coverage:**
```bash
npm run test:cov
```

Coverage reports generated to:
- Text output to console
- HTML output to coverage directory

## Test Types

**Unit Tests:**
- Scope: Single function or small module
- Approach: Test input validation, transformation logic, error cases
- Example: `action.test.ts` - tests `validateAction()`, `actionToId()`, `idToAction()` functions
- Location: `src/lib/*/[module].test.ts`

**Integration Tests:**
- Scope: Multiple modules working together (e.g., session handlers with storage)
- Approach: Full API request-response flow through handler
- Example: `handlers.test.ts` - tests `handleSpotQuiz()`, `handleReviewList()`, `handleReviewDetail()` with real state
- Location: `src/lib/runtime/http/handlers.test.ts`, `src/lib/v2/api/sessionHandlers.test.ts`

**E2E / System Tests:**
- Scope: Full session lifecycle with multiple decisions
- Approach: Test determinism, state consistency, round-trip correctness
- Example: `determinismReplay.test.ts` - verifies training/practice produce identical sequences
- Location: `src/__tests__/determinismReplay.test.ts`, `src/__tests__/storageRoundTrip.test.ts`, `src/__tests__/apiSessionContract.test.ts`
- Framework: Vitest (no separate E2E tool like Cypress/Playwright)

## Common Patterns

**Async Testing:**
Tests are synchronous; async/await not heavily used:
```typescript
// Synchronous handlers with no async logic
const start = expectOk<StartResponse>(
  handleStart({
    seed: "replay-seed",
    mode: "TRAINING",
    packId: "ev-dev-pack-v1",
    filters: { street: "FLOP" },
    decisionsPerSession: 10,
  })
);
```

**Error Testing:**
Errors tested via throw assertions and expected error codes:

```typescript
it("rejects invalid size for bet/raise", () => {
  expect(() => validateAction({ type: "BET", sizeBb: 0 })).toThrow();
  expect(() => validateAction({ type: "RAISE", sizeBb: -1 })).toThrow();
});

it("changes sequence when seed changes (negative control)", () => {
  const base = collectDecisionSequence({
    mode: "TRAINING",
    seed: "seed-one",
    filters: {},
    limit: 8,
  });

  resetState();

  const differentSeed = collectDecisionSequence({
    mode: "TRAINING",
    seed: "seed-two",
    filters: {},
    limit: 8,
  });

  expect(differentSeed).not.toEqual(base);
});
```

**Floating Point Assertions:**
Use `toBeCloseTo()` for numeric comparisons with tolerance:
```typescript
expect(grade.evMix).toBeCloseTo(0.88, 6);     // 6 decimal places
expect(stats.totals.meanEvLoss).toBeCloseTo(0.32);
```

**Type Safety in Tests:**
Generic helpers with type parameters for discriminated unions:
```typescript
function expectOk<T extends object>(result: ApiResult<T>): T {
  expect(result.status).toBe(200);
  if ("error" in result.body) {
    throw new Error(`expected success response, got ${result.body.error.code}`);
  }
  return result.body;
}

// Usage
const start = expectOk<StartResponse>(handleStart({ ... }));
```

**Determinism Testing:**
Tests verify seeded RNG produces identical sequences:
```typescript
// Same seed, same filters → identical decision sequence
const training = collectDecisionSequence({ seed: "test", filters: { street: "FLOP" }, mode: "TRAINING", limit: 10 });
resetState();
const practice = collectDecisionSequence({ seed: "test", filters: { street: "FLOP" }, mode: "PRACTICE", limit: 10 });
expect(practice).toEqual(training);

// Different seed → different sequence
const alt = collectDecisionSequence({ seed: "other", filters: { street: "FLOP" }, mode: "TRAINING", limit: 10 });
expect(alt).not.toEqual(training);
```

---

*Testing analysis: 2026-02-03*
