# Coding Conventions

**Analysis Date:** 2026-02-03

## Naming Patterns

**Files:**
- Kebab-case for file names: `session-handlers.ts`, `global-stats.ts`, `rng.ts`
- Test files suffix with `.test.ts`: `action.test.ts`, `grading.test.ts`
- API route files follow Next.js convention: `src/app/api/[path]/route.ts`
- Component files use PascalCase: `ActionInput.tsx`, `ModeEntryCard.tsx`, `TrainingFeedbackPanel.tsx`

**Functions:**
- camelCase for function names: `validateAction()`, `actionToId()`, `idToAction()`, `createSessionRecord()`, `getSessionRecord()`
- Leading underscore for private/internal functions: rare, most utilities are exported
- Helper/internal functions often prefixed with action word: `assertFinitePositive()`, `normalizeNumber()`, `computeSpotId()`
- Type-specific converters use pattern: `[sourceType]To[targetType]()` - e.g. `actionToId()`, `idToAction()`

**Variables:**
- camelCase for variables and constants: `spotId`, `actionId`, `sessionId`, `potBb`, `effectiveStackBb`
- Numeric suffix conventions: `Bb` for big blinds (e.g., `potBb`, `stacksBb`, `sizeBb`), `sz` avoided in favor of explicit `Bb`
- UPPER_SNAKE_CASE for exported constants: `SpotSchemaVersion`, `NUMBER_EPS`, `SIZE_EPS`
- Descriptive suffixes for related values: `VsBest`, `VsMix` (e.g., `evLossVsBest`, `evLossVsMix`)

**Types & Interfaces:**
- PascalCase for all types and interfaces: `Action`, `Spot`, `SessionRecord`, `DecisionGrade`, `ApiResult`, `HandlerResult`
- Prefixed with behavior: `Validated*`, `*Snapshot`, `*Response`, `*Input`, `*Output`
- Type aliases for discriminated unions: `ApiResult<T> = ApiSuccess<T> | ApiFailure`
- Generic types use `<T>` convention: `ApiResult<T>`, `HandlerResult<T>`

## Code Style

**Formatting:**
- TypeScript with strict mode enabled: `"strict": true` in tsconfig.json
- No visible formatter configured (no .prettierrc, no biome.json)
- Target: ES2020, module: esnext, jsx: react-jsx
- Consistent spacing in conditionals, function parameters

**Linting:**
- No ESLint or Biome configuration files detected
- Code follows implicit TypeScript-strict conventions
- Error messages are descriptive and include context: `"${name} must be a finite number > 0"`

## Import Organization

**Order:**
1. Node.js builtins: `import { createHash } from "node:crypto"`
2. External packages: `import { describe, expect, it } from "vitest"`
3. Type imports: `import type { Action } from "./action"`
4. Value imports: `import { validateAction } from "./action"`
5. Relative imports (same precedence): `import type { SessionRecord } from "../sessionStore"`

**Path Aliases:**
- No path aliases configured
- Relative imports use `../` notation: `../../engine/`, `../../runtime/`, `../filters/`
- Clear layering visible through import depth

**Example from `src/lib/v2/api/sessionHandlers.ts`:**
```typescript
import type { Spot } from "../../engine/spot";
import { validateSpot } from "../../engine/spot";
import type { ActionId } from "../../engine/types";
import { combineSeed, createSeededRng } from "../../engine/rng";
import type { SolverNodeOutput } from "../../engine/solverAdapter";
import type { DecisionGrade } from "../../engine/trainingOrchestrator";
import { gradeDecision } from "../../runtime/gradeDecision";
```

## Error Handling

**Patterns:**
- Validation at function entry using throw statements
- Input validation uses assertion functions or inline checks: `assertFiniteNumber()`, `assertNonEmptyString()`
- Type guards with assertion signature: `function assertFinitePositive(value: unknown, name: string): asserts value is number`
- Errors thrown with descriptive messages: `throw new Error("${name} must be a finite number > 0")`
- No try-catch blocks visible in core logic; errors propagate up
- API responses use discriminated union pattern for success/failure: `ApiResult<T> = ApiSuccess<T> | ApiFailure`

**Example from `src/lib/engine/action.ts`:**
```typescript
function assertFinitePositive(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number > 0`);
  }
}

export function validateAction(action: Action): Action {
  if (action === null || typeof action !== "object") {
    throw new Error("action must be an object");
  }
  // ... validation continues
  return action;
}
```

## Logging

**Framework:** console (no logging framework detected)

**Patterns:**
- Minimal logging in production code
- Error messages are the primary feedback mechanism
- Test files use `expect()` assertions instead of console output

## Comments

**When to Comment:**
- File headers document module purpose, interactions, and importance: `// src/lib/engine/grading.ts`
- Function headers describe intent briefly: `// Grades a decision using solver output and EV-based thresholds.`
- Comments clarify non-obvious logic or constants
- Inline comments explain "why" not "what"

**JSDoc/TSDoc:**
- Minimal JSDoc usage; type signatures are considered documentation
- No formal JSDoc blocks observed
- File-level comments use simple format: `// src/lib/v2/sessionStore.ts`
- Header comments before major functions describe: Overview, Interactions, Importance

**Example from `src/lib/v2/api/sessionHandlers.ts`:**
```typescript
/**
 * Overview: Core session lifecycle business logic for start/submit/next/get.
 * Interacts with: pack/filter selection, runtime registry, in-memory session store, grading.
 * Importance: Central deterministic contract used by all session API routes.
 */
```

## Function Design

**Size:** Functions are typically 10-50 lines; longer functions (100+ lines) are for data processing with multiple validations

**Parameters:**
- Single object parameter preferred for functions with multiple inputs: `function createSessionRecord(input: { sessionId: string; seed: string; ... })`
- Destructuring common: `const { sessionId, seed } = input`
- Optional config parameters as last argument: `function gradeDecision(..., config: ScoringConfig = {})`

**Return Values:**
- Explicit return types always specified: `: SessionRecord`, `: Action`
- Functions return validated values after validation: validators return the input if valid
- Void functions used for state mutation: `set()`, `clear()`
- Union types used for flexible returns: `SessionRecord | null`

**Example from `src/lib/v2/sessionStore.ts`:**
```typescript
export function getSessionRecord(sessionId: string, seed: string): SessionRecord | null {
  const key = runtimeKeyFrom(seed, sessionId);
  return backend.get(key) ?? null;
}

export function createSessionRecord(input: {
  sessionId: string;
  seed: string;
  mode: SessionMode;
  packId: string;
  filters: SpotFilterInput;
  decisionIndex: number;
  decisionsPerSession: number;
}): SessionRecord {
  const key = runtimeKeyFrom(input.seed, input.sessionId);
  const existing = backend.get(key);
  if (existing) return existing;
  // ... creation logic
  return record;
}
```

## Module Design

**Exports:**
- Named exports strongly preferred: `export function validateAction()`, `export interface Action`
- Default exports avoided
- Type exports use `export type { TypeName }`
- Constants exported as named exports: `export const SpotSchemaVersion = "1" as const`

**Barrel Files:**
- Not used; imports are direct from source files
- Each module exports its own public API

**File Organization Example:**
1. Imports (type, then value)
2. Type definitions/interfaces
3. Constants
4. Helper/internal functions
5. Public exported functions

See `src/lib/engine/spot.ts` for full example.

## Test-Related Patterns

**Test Setup:**
- Helper functions at top of test file: `function makeNode()`, `function expectOk()`, `function resetState()`
- Shared test data via factory functions: `function completeRecord(overrides?: Record<string, unknown>)`
- `beforeEach()` hooks for cleanup: `clearRuntimeRegistry()`, `clearSessionStore()`

**Assertion Patterns:**
- Vitest expect() with descriptive matchers: `expect(result.status).toBe(200)`, `toBeCloseTo()` for floats
- Type guards in assertions: `if ("error" in result.body)` to narrow discriminated unions
- Custom assertion helpers: `expectOk<T>(result: ApiResult<T>)` that throw on failure

---

*Convention analysis: 2026-02-03*
