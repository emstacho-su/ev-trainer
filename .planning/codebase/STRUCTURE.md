# Codebase Structure

**Analysis Date:** 2026-02-03

## Directory Layout

```
src/
├── app/                        # Next.js App Router pages and API routes
│   ├── layout.tsx              # Root layout wrapper
│   ├── page.tsx                # Home page (mode selection + recent sessions)
│   ├── api/
│   │   ├── session/
│   │   │   ├── start/route.ts  # POST session start/resume endpoint
│   │   │   ├── submit/route.ts # POST action submission endpoint
│   │   │   ├── next/route.ts   # POST next decision fetch endpoint
│   │   │   └── [id]/route.ts   # GET session detail endpoint
│   │   ├── stats/route.ts      # GET global statistics endpoint
│   │   └── training/           # Legacy training mode endpoints (hand-play, spot-quiz, review, targeted-drill)
│   ├── setup/[mode]/page.tsx   # Session setup form (filter selection)
│   ├── session/[id]/page.tsx   # Core training/practice loop page
│   ├── review/[id]/page.tsx    # Decision detail review view
│   ├── summary/[id]/page.tsx   # Session completion summary
│   ├── stats/page.tsx          # Global statistics dashboard
│   └── train/page.tsx          # Legacy training preview interface
├── components/                 # Reusable React components
│   ├── ActionInput.tsx         # Action selection input (fold/check/bet/raise)
│   ├── ModeEntryCard.tsx       # Training/Practice mode card
│   ├── SpotView.tsx            # Current game state display
│   ├── TrainingFeedbackPanel.tsx  # EV grading feedback display
│   ├── SessionSetupForm.tsx    # Filter selection form
│   ├── ReviewDecisionList.tsx  # Decision list for review
│   ├── ReviewDecisionDetail.tsx # Single decision detail view
│   ├── SummaryStatsCards.tsx   # Session aggregate statistics cards
│   ├── RecentSessionsList.tsx  # Home page session history list
│   ├── PracticeRecordedStatus.tsx  # Practice mode confirmation indicator
│   └── trainingPreview.tsx     # Legacy preview component
├── lib/
│   ├── engine/                 # Core game logic and decision grading
│   │   ├── index.ts            # Public API exports
│   │   ├── session.ts          # Engine session factory and interface
│   │   ├── api.ts              # applyAction and nextSpot functions
│   │   ├── action.ts           # Action ID validation and conversion
│   │   ├── spot.ts             # Spot validation and ID computation
│   │   ├── trainingOrchestrator.ts  # Decision grading orchestration
│   │   ├── grading.ts          # Numeric grading logic (EV loss, best action)
│   │   ├── evaluator.ts        # Evaluator interface and mock implementation
│   │   ├── trainingApi.ts      # Mode-specific training APIs (spot-quiz, hand-play, targeted-drill)
│   │   ├── spotSelection.ts    # Spot filtering and candidate selection
│   │   ├── spotSource.ts       # Spot source abstraction for packs
│   │   ├── filters.ts          # Spot filter validation
│   │   ├── nodeCache.ts        # LRU cache for node solver results
│   │   ├── nodeTypes.ts        # Poker node structure types
│   │   ├── decisionStore.ts    # Decision record storage
│   │   ├── rng.ts              # Deterministic seeded RNG
│   │   ├── opponentPolicy.ts   # Opponent action sampling
│   │   ├── solverAdapter.ts    # Solver integration layer
│   │   ├── canonicalHash.ts    # Node serialization and hashing
│   │   └── *.test.ts           # Unit tests for engine components
│   ├── runtime/                # Application layer bridging engine to HTTP
│   │   ├── v2SessionRegistry.ts     # In-memory session state progression registry
│   │   ├── gradeDecision.ts         # Wrapped grading with logging
│   │   ├── runtimeKey.ts            # Canonical key generation (seed::sessionId)
│   │   ├── createRuntime.ts         # Legacy runtime factory (deprecated)
│   │   ├── runtimeRegistry.ts       # Legacy registry (deprecated)
│   │   ├── http/
│   │   │   └── handlers.ts          # Legacy HTTP handler logic
│   │   └── *.test.ts                # Runtime integration tests
│   ├── v2/                     # V2 application layer (active)
│   │   ├── api/
│   │   │   ├── sessionHandlers.ts   # Core session lifecycle business logic
│   │   │   └── sessionHandlers.test.ts
│   │   ├── api-client/
│   │   │   ├── sessionClient.ts     # Typed fetch client for session API
│   │   │   └── sessionClient.test.ts
│   │   ├── filters/
│   │   │   ├── spotFilters.ts       # Filter validation, bucketing, enum restrictions
│   │   │   └── spotFilters.test.ts
│   │   ├── packs/
│   │   │   ├── spotPack.ts          # SpotPack schema and validation
│   │   │   ├── loadBundledPack.ts   # Pack loader from public/packs/
│   │   │   └── spotPack.test.ts
│   │   ├── storage/
│   │   │   ├── sessionStorage.ts    # Browser localStorage persistence
│   │   │   └── sessionStorage.test.ts
│   │   ├── sessionStore.ts          # In-memory v2 session state container
│   │   ├── spotSource.ts            # Spot selection with deterministic seeding
│   │   ├── reviewEntry.ts           # Review entry type and helpers
│   │   └── *.test.ts                # V2 integration tests
│   ├── aggregates/             # Statistics and analytics computation
│   │   ├── globalStats.ts       # Cross-session totals and breakdowns
│   │   ├── sessionAggregates.ts # Per-session metrics (volume, mean EV loss, best action rate)
│   │   └── *.test.ts            # Aggregation tests
│   ├── ui/                     # UI type helpers (unused/placeholder)
│   └── v2/                     # (Note: duplicated in structure; see above for actual location)
├── __tests__/                  # Placeholder for integration tests (mostly empty)
└── public/                     # Static assets
    └── packs/                  # Bundled spot pack JSON files

Configuration:
├── tsconfig.json               # TypeScript strict mode, ES2020 target
├── vitest.config.ts            # Test runner config (node environment, coverage)
├── next.config.js              # Next.js config
├── tailwind.config.js          # Tailwind CSS config
├── postcss.config.js           # PostCSS config
└── package.json                # Dependencies: Next, React, TypeScript, Vitest
```

## Directory Purposes

**`src/app`:**
- Purpose: Next.js App Router pages and server routes
- Contains: Page components (training loop, setup, review, stats), API route handlers
- Key files: `page.tsx` (home), `session/[id]/page.tsx` (main loop), `api/session/*` (API)

**`src/components`:**
- Purpose: Reusable React UI components
- Contains: Form inputs, display panels, lists, feedback views
- Key files: `ActionInput.tsx`, `SpotView.tsx`, `TrainingFeedbackPanel.tsx`

**`src/lib/engine`:**
- Purpose: Core poker decision grading engine
- Contains: Session creation, spot validation, action evaluation, node caching, decision recording
- Key files: `index.ts` (public API), `session.ts` (factory), `trainingOrchestrator.ts` (grading)

**`src/lib/runtime`:**
- Purpose: Bridge between engine and application layers
- Contains: Session registry, decision store, grading wrapper, key generation
- Key files: `v2SessionRegistry.ts` (state progression), `gradeDecision.ts` (wrapper)

**`src/lib/v2`:**
- Purpose: Active application orchestration layer for v2 architecture
- Contains: Session handlers, API client, filters, pack management, persistence
- Key files: `api/sessionHandlers.ts` (core logic), `api-client/sessionClient.ts` (client), `storage/sessionStorage.ts` (persistence)

**`src/lib/v2/api`:**
- Purpose: Session lifecycle business logic for all training modes
- Contains: `handleStart`, `handleNext`, `handleSubmit`, `handleGetSession` functions
- Key files: `sessionHandlers.ts`

**`src/lib/v2/filters`:**
- Purpose: Spot filter validation and bucketing
- Contains: Enum validation (street, potType), stack bucketing logic
- Key files: `spotFilters.ts`

**`src/lib/v2/packs`:**
- Purpose: Spot pack loading and validation
- Contains: SpotPack schema, pack loader from bundled JSON
- Key files: `spotPack.ts`, `loadBundledPack.ts`

**`src/lib/v2/storage`:**
- Purpose: Browser localStorage persistence for session history
- Contains: Session record persistence, index management, storage warning handling
- Key files: `sessionStorage.ts`

**`src/lib/aggregates`:**
- Purpose: Analytics computation across sessions
- Contains: Global stats aggregation, session-level metrics, bucketing helpers
- Key files: `globalStats.ts`, `sessionAggregates.ts`

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Home page with mode selection and session list
- `src/app/api/session/start/route.ts`: Session creation/resume API entry
- `src/app/session/[id]/page.tsx`: Main training/practice loop entry

**Configuration:**
- `tsconfig.json`: TypeScript strict mode, no path aliases (direct imports only)
- `vitest.config.ts`: Test runner configuration
- `package.json`: Dependencies (Next 16.1, React 19, Vitest 4)

**Core Logic:**
- `src/lib/engine/session.ts`: Engine session factory with dependency injection
- `src/lib/v2/api/sessionHandlers.ts`: All session lifecycle business logic
- `src/lib/runtime/v2SessionRegistry.ts`: In-memory session progression registry
- `src/lib/v2/storage/sessionStorage.ts`: localStorage persistence schema

**Testing:**
- `src/lib/engine/*.test.ts`: Engine unit tests (36 total test files)
- `vitest.config.ts`: Test environment set to node, coverage via v8

## Naming Conventions

**Files:**
- Component files: `PascalCase.tsx` (e.g., `SpotView.tsx`, `ActionInput.tsx`)
- Utility/logic files: `camelCase.ts` (e.g., `sessionHandlers.ts`, `spotFilters.ts`)
- Test files: `{name}.test.ts` (co-located with source, e.g., `sessionHandlers.test.ts` next to `sessionHandlers.ts`)
- Route handlers: `route.ts` (Next.js convention for `src/app/api/*/route.ts`)

**Directories:**
- Feature directories: lowercase (e.g., `engine`, `v2`, `aggregates`)
- API route directories: lowercase with dynamic segments in brackets (e.g., `api/session/[id]`)

**Functions/Exports:**
- Factory functions: `create{Entity}()` (e.g., `createSession`, `createSessionRecord`)
- Getter functions: `get{Entity}()` (e.g., `getSessionRecord`, `getSession`)
- Handler functions: `handle{Action}()` (e.g., `handleStart`, `handleSubmit`)
- Validators: `validate{Entity}()` (e.g., `validateSpot`, `validateSpotFilters`)

**Types:**
- Interfaces: `PascalCase` (e.g., `Session`, `SessionRecord`, `Spot`)
- Type aliases: `PascalCase` (e.g., `ActionId`, `SessionMode`)
- API request/response types: `{Action}Request`, `{Action}Response` (e.g., `StartResponse`, `SubmitTrainingResponse`)

## Where to Add New Code

**New Feature:**
- Primary code: `src/lib/v2/{feature}/` for application logic, `src/lib/engine/{feature}/` if touching grading
- Tests: `src/lib/v2/{feature}/{file}.test.ts` (co-located)
- API endpoint: `src/app/api/{path}/route.ts`
- Page/UI: `src/app/{path}/page.tsx` or new component in `src/components/`

**New Component/Module:**
- React components: `src/components/{ComponentName}.tsx` with props interface
- Engine utilities: `src/lib/engine/{utility}.ts` with public export from `src/lib/engine/index.ts`
- V2 application logic: `src/lib/v2/{category}/{utility}.ts`
- Runtime utilities: `src/lib/runtime/{utility}.ts`

**Utilities:**
- Shared helpers: `src/lib/v2/` or `src/lib/engine/` depending on scope
- Non-domain utilities: Create in closest domain layer (`v2` for application, `engine` for grading)
- Do NOT create top-level `src/utils/` directory

**Tests:**
- Always co-locate with source: `src/lib/{layer}/{file}.test.ts`
- Pattern: Import source module, describe suite by module name, test all public exports
- Run via: `npm test` (all), `npm test:watch` (watch), `npm test:cov` (coverage)

## Special Directories

**`src/lib/runtime`:**
- Purpose: Legacy abstraction layer (now mostly superseded by v2)
- Generated: No
- Committed: Yes
- Status: Contains v2SessionRegistry (active) and deprecated registry/factory (legacy)

**`src/__tests__`:**
- Purpose: Placeholder for integration test files
- Generated: No
- Committed: Yes
- Status: Mostly empty; most tests are co-located with source

**`public/packs`:**
- Purpose: Bundled spot pack JSON files loaded at runtime
- Generated: No
- Committed: Yes
- Status: Contains production spot data (e.g., `6max-200bb.json`)

**`.next`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No
- Status: Created by `npm run build`, contains compiled pages and API routes

## Implementation Guidance

**Adding a Session Lifecycle Handler:**
1. Add handler function in `src/lib/v2/api/sessionHandlers.ts`
2. Define request/response types in same file or import from co-located types file
3. Create route handler in `src/app/api/{path}/route.ts` that wraps handler and formats response
4. Use `sessionHandlers.ts` function via direct import (no dependency injection)
5. Add test case in `src/lib/v2/api/sessionHandlers.test.ts`

**Adding a Filter Type:**
1. Define enum/constant in `src/lib/v2/filters/spotFilters.ts`
2. Add validator function in same file
3. Update `SpotFilterInput` interface to include new field
4. Update spot bucketing logic if needed
5. Add test cases for validation

**Adding a Page/Route:**
1. Create `src/app/{path}/page.tsx` following the same pattern as `session/[id]/page.tsx`
2. Use client hooks (useState, useCallback) at top level with "use client" directive
3. Import session client from `src/lib/v2/api-client/sessionClient.ts`
4. Import storage functions from `src/lib/v2/storage/sessionStorage.ts` for persistence
5. Leverage localStorage for recovery across reloads

**Adding a Component:**
1. Create in `src/components/{ComponentName}.tsx`
2. Define props interface above component function
3. Use TypeScript strict mode throughout
4. Import types from `src/lib/` as needed
5. No co-located test (test via page integration)

---

*Structure analysis: 2026-02-03*
