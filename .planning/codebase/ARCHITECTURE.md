# Architecture

**Analysis Date:** 2026-02-03

## Pattern Overview

**Overall:** Multi-layered server-side deterministic session engine with client-side UI orchestration.

**Key Characteristics:**
- Deterministic seeding for reproducible game decision grading
- Strict separation between game logic (engine) and runtime/application layers
- API-driven session lifecycle with in-memory storage and persistent browser localStorage
- React Server Components with Next.js App Router for pages
- Discrete training modes (Spot Quiz, Hand Play, Targeted Drill, Review) with unified grading pipeline

## Layers

**Engine Layer:**
- Purpose: Pure game logic, decision grading, node caching, and spot validation
- Location: `src/lib/engine/`
- Contains: Core business logic for poker decision evaluation (session creation, action grading, evaluator)
- Depends on: Node solver (external), RNG (deterministic seeding)
- Used by: Runtime and v2 application layers

**Runtime Layer:**
- Purpose: Bridges engine to application by managing session state progression and registry
- Location: `src/lib/runtime/`
- Contains: Session registry (in-memory), decision store, grading wrapper, runtime key generation
- Depends on: Engine layer for grading and decision metrics
- Used by: v2 API handlers, HTTP handlers (legacy)

**V2 Application Layer:**
- Purpose: Session orchestration, spot filtering, packing, and API request/response handling
- Location: `src/lib/v2/`
- Contains: Session handlers, spot source selection, filters, pack management, session store, storage persistence
- Depends on: Runtime layer for registry access, engine for grading
- Used by: API routes and client-side session client

**API Routes Layer:**
- Purpose: HTTP entry points for session lifecycle and training interactions
- Location: `src/app/api/`
- Contains: Route handlers for start, next, submit, get, stats, and training modes
- Depends on: v2 application handlers and response types
- Used by: Browser fetch calls from pages

**UI/Components Layer:**
- Purpose: React components for display, form input, and state management
- Location: `src/components/` and page components in `src/app/`
- Contains: Session setup, spot display, action input, feedback panels, statistics views
- Depends on: Session API client, localStorage utilities, component state
- Used by: Page routes

**Storage/Persistence Layer:**
- Purpose: Browser localStorage for session history and recovery
- Location: `src/lib/v2/storage/`
- Contains: Session record persistence, index management, warning notifications
- Depends on: v2 types and structures
- Used by: Pages and session store

**Aggregation Layer:**
- Purpose: Analytics and statistics computation across sessions
- Location: `src/lib/aggregates/`
- Contains: Global stats, session aggregates, bucketing helpers
- Depends on: Review entries and session records
- Used by: Statistics pages

## Data Flow

**Session Start Flow:**

1. User selects mode (Training/Practice) and filters on setup page
2. Browser sends POST to `/api/session/start` with seed, packId, filters
3. `sessionHandlers.handleStart()` is called:
   - Loads spot pack from bundled data
   - Filters spots by user criteria (stack, position, pot type)
   - Creates deterministic session via `v2SessionRegistry.createSession()`
   - Creates in-memory session record via `sessionStore.createSessionRecord()`
   - Selects first spot via `getFilteredSpots()` and deterministic seeding
4. API returns session snapshot and first spot
5. Page component receives response and loads session into React state

**Decision Submission Flow:**

1. User selects action (FOLD/CHECK/BET/RAISE) in ActionInput component
2. Page calls `submitAction()` from session client with spot and actionId
3. Browser sends POST to `/api/session/submit` with payload
4. `sessionHandlers.handleSubmit()` is called:
   - Retrieves current session from registry by seed/sessionId
   - Validates spot integrity via checksum
   - Calls grading pipeline: `gradeDecision()` from runtime layer
   - In training mode: returns DecisionGrade immediately
   - In practice mode: records entry without revealing grade
5. Page receives result and updates UI state
6. User can view feedback (training) or advance to next decision

**Next Decision Flow:**

1. After submission or at start, page calls `nextDecision()` from session client
2. Browser sends POST to `/api/session/next`
3. `sessionHandlers.handleNext()` is called:
   - Increments decision index in registry
   - Selects next spot deterministically using seed + sequenceIndex
   - Returns new session snapshot and spot
4. Page updates current spot and decision counter

**State Management:**

- **Runtime Registry** (`v2SessionRegistry`): Tracks decision index and completion per seeded session (in-memory, non-durable)
- **Session Store** (`sessionStore`): Tracks entries and current spot per session (in-memory, test-injectable)
- **Browser localStorage**: Persists session snapshots, entries, aggregates for recovery across reloads
- **Page Component State**: React useState hooks for current spot, action selection, feedback display, loading states

## Key Abstractions

**Session (`engine/session.ts`):**
- Purpose: Immutable container for engine state (cache, evaluator, training API, config)
- Examples: `src/lib/engine/session.ts`
- Pattern: Factory function with validation, dependency injection for solver and evaluator

**DecisionGrade:**
- Purpose: Numeric output for a single decision decision grading (EV loss, best action flag, etc.)
- Examples: `src/lib/engine/trainingOrchestrator.ts`, `src/lib/runtime/gradeDecision.ts`
- Pattern: Struct returned by training API methods; immutable, serializable

**Spot:**
- Purpose: Game state snapshot with board, hero position, stack, etc.
- Examples: `src/lib/engine/spot.ts`, `src/lib/v2/packs/spotPack.ts`
- Pattern: Validated via checksum; bundled with metadata (street, position, stack bucket)

**SpotPack:**
- Purpose: Bundled set of spots with filtering metadata
- Examples: `src/lib/v2/packs/spotPack.ts`, `src/lib/v2/packs/loadBundledPack.ts`
- Pattern: JSON schema with version, packed spots array, computed stack/position bucketing

**SpotFilterInput:**
- Purpose: User-driven filters for spot selection (street, potType, stack range)
- Examples: `src/lib/v2/filters/spotFilters.ts`
- Pattern: Validated enum restrictions, bucketing logic, used in session handlers and aggregation

**SessionRecord (v2):**
- Purpose: In-memory session state tracking (entries, current spot, decision index)
- Examples: `src/lib/v2/sessionStore.ts`
- Pattern: Mutable object stored in injected backend, keyed by runtime key (seed::sessionId)

**V2SessionSnapshot:**
- Purpose: API-safe immutable view of session progress for client transport
- Examples: `src/lib/v2/api/sessionHandlers.ts`
- Pattern: Extracted from v2SessionRegistry, includes completion flag

**PersistedSessionRecord:**
- Purpose: Browser localStorage schema for session recovery
- Examples: `src/lib/v2/storage/sessionStorage.ts`
- Pattern: Includes session snapshot, entries, aggregates, timestamps

## Entry Points

**Web Entry Point:**
- Location: `src/app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Display mode selection, recent session list, session management (delete, clear)

**API Entry Points:**
- `POST /api/session/start` - `src/app/api/session/start/route.ts`: Start or resume session
- `POST /api/session/submit` - `src/app/api/session/submit/route.ts`: Submit action and get grade
- `POST /api/session/next` - `src/app/api/session/next/route.ts`: Fetch next spot
- `GET /api/session/[id]` - `src/app/api/session/[id]/route.ts`: Get session detail with entries
- `GET /api/stats` - `src/app/api/stats/route.ts`: Compute global stats from localStorage

**Session Page Entry:**
- Location: `src/app/session/[id]/page.tsx`
- Triggers: Navigation from setup after starting session
- Responsibilities: Main training/practice loop—load spot, collect action, submit, show feedback, advance

**Setup Page Entry:**
- Location: `src/app/setup/[mode]/page.tsx`
- Triggers: Click on Training or Practice mode card from home
- Responsibilities: Collect filter selections, initiate session start API call

**Review Pages:**
- Location: `src/app/review/[id]/page.tsx`, `src/app/summary/[id]/page.tsx`
- Triggers: Session completion or explicit review link click
- Responsibilities: Display session decisions, statistics, and EV analysis

## Error Handling

**Strategy:** Normalized error boundary with SessionApiError and handler-level validation.

**Patterns:**

- **API Handler Error Response**: `src/lib/v2/api/sessionHandlers.ts` returns `ApiFailure` with structured error code/message
  - Example: Missing sessionId returns `{ status: 400, body: { error: { code: "INVALID_ARGUMENT", message: "..." } } }`
- **Client Error Parsing**: `src/lib/v2/api-client/sessionClient.ts` normalizes fetch responses into SessionApiError
  - Extracts error code/message, preserves HTTP status
  - Thrown error caught in page component and displayed as UI message
- **Storage Errors**: `src/lib/v2/storage/sessionStorage.ts` gracefully degrades with warning flag
  - Swallows localStorage exceptions to avoid blocking UI
  - Sets warning notification for user awareness

## Cross-Cutting Concerns

**Logging:**
- Not centralized; console calls present in engine and runtime test files
- No production-level logging framework (Sentry, DataDog, etc.)

**Validation:**
- Strict type validation in engine (`validateSpot`, `validateSpotFilters`)
- Runtime assertions in session handlers for sessionId and seed presence
- Pack loader validates SpotEntry schema structure

**Authentication:**
- None present; no user identity or access control
- All sessions keyed by user-provided seed/sessionId

**Determinism:**
- Enforced via seeded RNG throughout
- Session creation replays identical solver outputs for same seed/sessionId
- Spot selection uses deterministic seeding with sequence index

**Type Safety:**
- Full TypeScript strict mode enabled
- Type exports from `engine/index.ts` and `v2/api/sessionHandlers.ts` for integration points

---

*Architecture analysis: 2026-02-03*
