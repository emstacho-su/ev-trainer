# Architecture Patterns

**Domain:** Poker solver training platform with real-time GTO feedback
**Researched:** 2026-02-03
**Confidence:** MEDIUM (based on training knowledge of CFR algorithms, poker solver systems, and existing V2 codebase patterns)

## Executive Summary

Poker solver training platforms require a carefully layered architecture that separates the computationally intensive CFR+ solver from the interactive training workflow. The V3 evolution must preserve V2's deterministic session patterns while introducing a solver service, persistent storage, and enhanced UI with animations.

The recommended architecture uses a **three-tier design**: a TypeScript CFR+ solver core (potentially compiled to WASM for client-side option), an Express backend handling auth/sessions/persistence, and a Next.js frontend with animation-capable poker UI components.

---

## Recommended Architecture

```
+------------------------------------------------------------------+
|                         CLIENT (Next.js)                          |
+------------------------------------------------------------------+
|  +------------+  +------------+  +------------+  +------------+  |
|  | Poker UI   |  | Range Grid |  | Stats/     |  | Session    |  |
|  | Table      |  | Visualizer |  | Review     |  | Controller |  |
|  | (animated) |  | (13x13)    |  | Dashboard  |  |            |  |
|  +-----+------+  +-----+------+  +-----+------+  +-----+------+  |
|        |               |               |               |          |
|        +---------------+-------+-------+---------------+          |
|                                |                                  |
|                    +---------------------+                        |
|                    | Session State (UI)  |                        |
|                    | + localStorage      |                        |
|                    +----------+----------+                        |
+--------------------------------|----------------------------------+
                                 | HTTPS/REST
+--------------------------------|----------------------------------+
|                        BACKEND (Express)                          |
+------------------------------------------------------------------+
|  +------------+  +------------+  +------------+  +------------+  |
|  | Auth       |  | Session    |  | Training   |  | Stats      |  |
|  | Handlers   |  | Handlers   |  | Handlers   |  | Handlers   |  |
|  +-----+------+  +-----+------+  +-----+------+  +-----+------+  |
|        |               |               |               |          |
|        +-------+-------+-------+-------+               |          |
|                |                                       |          |
|  +-------------+-------------+    +-------------------+----------+|
|  | Training Orchestrator     |    | Aggregate Service           ||
|  | (from V2 engine layer)    |    | (compute stats from DB)     ||
|  +-------------+-------------+    +-------------------+----------+|
|                |                                       |          |
|                +---------------+-----------------------+          |
|                                |                                  |
|                    +-----------+-----------+                      |
|                    |   Solver Adapter      |                      |
|                    | (cache + routing)     |                      |
|                    +-----------+-----------+                      |
+--------------------------------|----------------------------------+
                                 | Internal
+--------------------------------|----------------------------------+
|                      SOLVER LAYER                                 |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------------+    +---------------------------+      |
|  | Pre-computed Strategy  |    | Runtime Solver            |      |
|  | Database (PostgreSQL)  |    | (CFR+ TypeScript/WASM)    |      |
|  | - Common spots         |    | - On-demand solving       |      |
|  | - Preflop ranges       |    | - Subgame refinement      |      |
|  +------------------------+    +---------------------------+      |
|                                                                   |
+------------------------------------------------------------------+
                                 |
+--------------------------------|----------------------------------+
|                       DATA LAYER (PostgreSQL)                     |
+------------------------------------------------------------------+
|  +------------+  +------------+  +------------+  +------------+  |
|  | Users      |  | Sessions   |  | Decisions  |  | Stats      |  |
|  |            |  |            |  |            |  | Aggregates |  |
|  +------------+  +------------+  +------------+  +------------+  |
|                                                                   |
|  +---------------------------+                                    |
|  | Pre-computed Strategies   |                                    |
|  | (blob or normalized)      |                                    |
|  +---------------------------+                                    |
+------------------------------------------------------------------+
```

---

## Component Architecture

### 1. CFR+ Solver Core

The solver is the computational heart of the system. It implements Counterfactual Regret Minimization Plus (CFR+) to compute Nash equilibrium strategies.

#### Key Components

| Component | Responsibility | Interface |
|-----------|---------------|-----------|
| **GameTree** | Defines the poker game structure (nodes, actions, transitions) | `buildGameTree(config): GameTreeNode` |
| **InfoSetStore** | Maps information sets to strategy/regret vectors | `get(infoSetId): InfoSet`, `update(infoSetId, regrets)` |
| **AbstractionLayer** | Reduces game tree size via card/action bucketing | `abstractHand(cards): BucketId`, `abstractAction(size): ActionId` |
| **CFREngine** | Runs CFR+ iterations to convergence | `solve(tree, iterations): Strategy` |
| **StrategyExporter** | Serializes converged strategies for storage | `export(strategy): Buffer` |

#### CFR+ Algorithm Structure

```typescript
interface GameTreeNode {
  type: 'chance' | 'player' | 'terminal';
  player?: 0 | 1;  // Hero or Villain
  infoSetId?: string;  // Hash of visible information
  actions?: Action[];
  children?: Map<ActionId, GameTreeNode>;
  ev?: number;  // Terminal node payoff
}

interface InfoSet {
  strategySum: number[];    // Cumulative strategy contributions
  regretSum: number[];      // Cumulative regrets (CFR+ clips negatives)
  currentStrategy: number[]; // Normalized current iteration strategy
}

interface CFRSolverConfig {
  gameVersion: string;
  cardAbstraction: CardAbstractionConfig;
  actionAbstraction: ActionAbstractionConfig;
  maxIterations: number;
  convergenceThreshold: number;  // Target exploitability
}
```

#### Abstraction Layers

CFR+ requires abstraction to make NLHE tractable:

**Card Abstraction (HIGH confidence - well-established technique):**
- Preflop: 169 canonical hand combinations (suited/offsuit/pairs)
- Postflop: E[HS] (expected hand strength) or E[HS^2] bucketing
- Cluster hands into N buckets (typically 50-200) based on equity distribution

**Action Abstraction (HIGH confidence):**
- Discrete bet sizes: {0.33x pot, 0.5x pot, 0.75x pot, 1x pot, 1.5x pot, all-in}
- Map continuous bet amounts to nearest abstracted size
- Existing V2 has `ActionAbstraction` in `nodeTypes.ts` with `betSizesBb`/`raiseSizesBb`

**Tree Pruning:**
- Cap raises per street (V2 has `maxRaisesPerStreet`)
- Prune dominated actions (very small bets, very large overbets in some lines)

#### Build Order Implication

**Solver must be built early** because:
1. All training value depends on accurate solver output
2. Existing `mockSolver.ts` provides interface contract
3. Can iterate on abstraction quality before UI work

### 2. Hybrid Solving Architecture

Production poker training platforms use a hybrid approach combining pre-computation and runtime solving.

#### Pre-computed Strategy Database

| What | Storage | Access Pattern |
|------|---------|----------------|
| Preflop ranges | PostgreSQL (or blob) | O(1) lookup by position/action-history |
| Common postflop spots | PostgreSQL | O(1) lookup by canonical node hash |
| Flop turn river textures | Pre-bucketed | Texture -> common lines |

**Existing V2 Pattern:** `CanonicalNode` + `buildCanonicalNodeHash()` already provides stable node identification. This becomes the lookup key for pre-computed strategies.

#### Runtime Solving (Subgame Refinement)

For spots not in pre-computed database:

1. **Start from coarse solution** - Load nearest pre-computed strategy
2. **Refine subtree** - Run limited CFR+ iterations on the specific subgame
3. **Apply real-time abstraction** - Use current board/stack for refined buckets
4. **Cache result** - Store in node cache (V2's `MemoryNodeCache` pattern)

```typescript
interface SolverAdapter {
  // Pre-computed lookup (fast)
  lookupStrategy(nodeHash: string): SolverNodeOutput | null;

  // Runtime solve (slow, cached)
  solveSubgame(node: CanonicalNode, options: SolveOptions): SolverNodeOutput;

  // Hybrid: lookup first, solve if miss
  resolve(node: CanonicalNode): SolverNodeOutput;
}
```

#### Build Order Implication

1. Build pre-computed strategy pipeline first (preflop ranges)
2. Add runtime solver second (postflop subgames)
3. Hybrid router connects them via adapter pattern (V2's `solverAdapter.ts`)

### 3. Backend Architecture (Express)

The Express backend handles stateful operations that must not run client-side.

#### Service Layer Design

```
Express App
    |
    +-- Routes (thin HTTP handlers)
    |       /api/auth/*       -> AuthController
    |       /api/session/*    -> SessionController
    |       /api/training/*   -> TrainingController
    |       /api/stats/*      -> StatsController
    |
    +-- Controllers (request validation, response shaping)
    |       |
    |       +-- Services (business logic)
    |               |
    |               +-- Repositories (data access)
    |               +-- Solver Adapter (solver integration)
    |
    +-- Middleware
            Auth (JWT validation)
            RateLimit (prevent abuse)
            RequestId (tracing)
```

#### Key Backend Components

| Component | Responsibility | V2 Analog |
|-----------|---------------|-----------|
| **SessionService** | Lifecycle (start, submit, next, complete) | `v2SessionRegistry.ts` |
| **TrainingService** | Grading, decision records | `trainingOrchestrator.ts` |
| **ReviewService** | List/detail with pagination | `decisionStore.ts` |
| **StatsService** | Aggregates computation | `sessionAggregates.ts` |
| **SolverService** | Adapter to solver layer | `solverAdapter.ts` |

#### Migration Path from V2

V2's engine layer (`src/lib/engine/`) is largely reusable:

| V2 Module | V3 Use |
|-----------|--------|
| `grading.ts` | Direct reuse |
| `rng.ts` | Direct reuse (determinism) |
| `canonicalHash.ts` | Direct reuse (node identity) |
| `solverAdapter.ts` | Interface preserved, implementation swapped |
| `trainingOrchestrator.ts` | Adapt to call Prisma instead of in-memory store |
| `nodeCache.ts` | Convert to Redis or keep in-memory with TTL |

#### Data Models (PostgreSQL via Prisma)

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  sessions      Session[]
}

model Session {
  id                   String    @id @default(uuid())
  userId               String
  user                 User      @relation(fields: [userId], references: [id])
  seed                 String
  mode                 SessionMode
  packId               String
  filters              Json      // SpotFilterInput
  decisionIndex        Int       @default(0)
  decisionsPerSession  Int       @default(10)
  isComplete           Boolean   @default(false)
  createdAt            DateTime  @default(now())
  completedAt          DateTime?
  decisions            Decision[]
}

model Decision {
  id            String    @id @default(uuid())
  sessionId     String
  session       Session   @relation(fields: [sessionId], references: [id])
  index         Int
  spotId        String
  spotData      Json      // Serialized Spot
  nodeHash      String
  actionId      String
  grade         Json      // DecisionGrade
  createdAt     DateTime  @default(now())

  @@index([sessionId, index])
  @@index([nodeHash])  // For aggregating stats by spot
}

model DailyStats {
  id            String    @id @default(uuid())
  userId        String
  date          DateTime  @db.Date
  volume        Int
  meanEvLoss    Float
  bestActionRate Float
  durationMs    Int

  @@unique([userId, date])
}

enum SessionMode {
  TRAINING
  PRACTICE
}
```

#### Build Order Implication

1. Express scaffold + Prisma setup first
2. Auth (users, sessions, JWT) second
3. Migrate V2 session handlers to Express controllers
4. Add stats/aggregates service last

### 4. Frontend Architecture (Next.js + Animations)

The frontend must support rich poker visualization with smooth animations.

#### Component Hierarchy

```
App Layout
    |
    +-- AuthProvider (JWT context)
    |
    +-- Pages
            |
            +-- /setup/[mode]     -> SetupPage (filters, start session)
            |
            +-- /session/[id]     -> SessionPage (main training loop)
            |       |
            |       +-- PokerTable (animated)
            |       |       +-- BoardCards (deal animation)
            |       |       +-- PlayerPositions
            |       |       +-- PotDisplay (chip movement)
            |       |       +-- ActionIndicator
            |       |
            |       +-- ActionPanel
            |       |       +-- ActionButtons (bet/fold/call/raise)
            |       |       +-- BetSlider (for sizing)
            |       |
            |       +-- FeedbackPanel
            |               +-- EVDisplay (reveal animation)
            |               +-- FrequencyBars
            |               +-- GradeIndicator
            |
            +-- /summary/[id]     -> SummaryPage (session review)
            |
            +-- /review/[id]      -> ReviewPage (decision drilldown)
            |
            +-- /stats            -> StatsPage (graphs, trends)
            |       |
            |       +-- PerformanceGraph (D3 or Recharts)
            |       +-- SpotTypeBreakdown
            |       +-- SessionHistory
            |
            +-- /preflop          -> PreflopPage (range training)
                    |
                    +-- RangeGrid (13x13)
                    |       +-- HandCell (color-coded by action)
                    |       +-- FrequencyOverlay
                    |
                    +-- PositionSelector
                    +-- ScenarioSelector (RFI/3bet/4bet)
```

#### Animation Architecture

Poker UI animations require careful state management:

```typescript
// Animation state machine for card dealing
type DealState =
  | { phase: 'idle' }
  | { phase: 'dealing'; cardIndex: number; progress: number }
  | { phase: 'complete' };

// Chip movement for pot updates
interface ChipAnimation {
  from: Position;
  to: Position;
  amount: number;
  startTime: number;
  duration: number;
}

// Coordinated animation timeline
interface AnimationTimeline {
  events: AnimationEvent[];
  currentTime: number;
  play(): void;
  pause(): void;
  seek(time: number): void;
}
```

**Recommended Animation Libraries:**

| Library | Use Case | Rationale |
|---------|----------|-----------|
| Framer Motion | Component transitions, layout animations | React-native, declarative |
| React Spring | Physics-based animations (chips, cards) | Natural feel for game elements |
| CSS transitions | Simple state changes | Performance, no JS overhead |

**Animation Coordination Pattern:**

```typescript
// Example: EV reveal after submission
async function handleSubmitWithAnimation(actionId: ActionId) {
  // 1. Submit action (no animation)
  const result = await submitAction({ sessionId, spot, actionId });

  // 2. Animate action highlight
  await animateActionHighlight(actionId);

  // 3. Reveal EV with suspense animation
  await animateEVReveal(result.grade);

  // 4. Update frequency bars
  await animateFrequencyBars(result.output.actions);

  // 5. Show final grade
  animateGradeDisplay(result.grade.gradeLabel);
}
```

#### State Management

| Scope | Solution | Rationale |
|-------|----------|-----------|
| Server state | React Query (TanStack Query) | Cache, revalidation, optimistic updates |
| UI state | React useState/useReducer | Local component state |
| Global UI | Zustand (or Context) | Minimal global state (theme, toasts) |
| Persistence | localStorage (offline support) | V2 pattern preserved |

#### Build Order Implication

1. Core components without animation first (functional UI)
2. Add animation framework (Framer Motion setup)
3. Implement animation sequences incrementally
4. Polish timing and easing curves last

---

## Data Flow

### Training Session Flow

```
User Action                   Frontend                Backend                 Solver
     |                           |                       |                      |
     | Click "Start Session"     |                       |                      |
     +-------------------------->|                       |                      |
     |                           | POST /session/start   |                      |
     |                           +---------------------->|                      |
     |                           |                       | Create Session       |
     |                           |                       | Select Spot          |
     |                           |                       +--------------------->|
     |                           |                       |<---------------------+
     |                           |                       | (cached or computed) |
     |                           |<----------------------+                      |
     |                           | { session, spot }     |                      |
     |<--------------------------+                       |                      |
     | Display Spot              |                       |                      |
     |                           |                       |                      |
     | Select Action             |                       |                      |
     +-------------------------->|                       |                      |
     |                           | POST /session/submit  |                      |
     |                           +---------------------->|                      |
     |                           |                       | Lookup/Solve Node    |
     |                           |                       +--------------------->|
     |                           |                       |<---------------------+
     |                           |                       | Grade Decision       |
     |                           |                       | Store Decision       |
     |                           |<----------------------+                      |
     |                           | { result }            |                      |
     |<--------------------------+                       |                      |
     | Animate EV Reveal         |                       |                      |
```

### Solver Resolution Flow

```
SolverAdapter.resolve(node)
     |
     +---> Compute canonical hash (buildCanonicalNodeHash)
     |
     +---> Check memory cache (MemoryNodeCache)
     |         |
     |         +-- HIT --> return cached output
     |         |
     |         +-- MISS
     |                |
     +---> Check pre-computed DB (PostgreSQL)
     |         |
     |         +-- HIT --> cache in memory, return
     |         |
     |         +-- MISS
     |                |
     +---> Runtime solve (CFREngine.solveSubgame)
     |         |
     |         +-- Apply card/action abstraction
     |         +-- Run limited iterations
     |         +-- Store in DB for future
     |         +-- Cache in memory
     |         +-- return
```

---

## Patterns to Follow

### Pattern 1: Adapter Interface Stability

**What:** Keep `SolverNodeOutput` interface unchanged from V2. Swap implementation behind adapter.

**When:** Any time solver implementation changes (mock -> pre-computed -> runtime).

**Why:** V2's grading, orchestration, and UI code all depend on this interface. Changing it would cascade across layers.

**Example (preserved from V2):**
```typescript
export interface SolverNodeOutput {
  nodeId?: string;
  actions: SolverActionOutput[];
  status: "ok" | "unsolved" | "error";
  units: "bb" | "chips";
  exploitability?: number;
}
```

### Pattern 2: Deterministic Session Keys

**What:** Session identity derived from (seed, sessionId, filters). Same inputs = same spot sequence.

**When:** All session operations (start, submit, next).

**Why:** V2 established determinism for testing and replay. Carry forward.

**Example (V2 pattern):**
```typescript
const sessionKey = runtimeKeyFrom(seed, sessionId);
// Used for registry lookup, decision store scoping
```

### Pattern 3: Canonical Node Hashing

**What:** Hash node state deterministically for cache keys and DB lookups.

**When:** Any solver query or cache operation.

**Why:** Node hash is the universal lookup key across cache, pre-computed DB, and runtime solver.

**Example (V2's `canonicalHash.ts`):**
```typescript
const nodeHash = buildCanonicalNodeHash({
  gameVersion,
  abstractionVersion,
  solverVersion,
  publicState,
  history,
  toAct,
  abstraction,
});
```

### Pattern 4: EV-First Grading

**What:** Primary metric is EV loss vs mix (or vs best). All review/stats sorted by EV loss.

**When:** Grading decisions, sorting review lists, computing aggregates.

**Why:** Training value comes from identifying costly mistakes. EV loss is the measure.

**Example (V2's `grading.ts`):**
```typescript
const evLossVsMix = evMix - evUser;
const evLossVsBest = evBest - evUser;
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Coupled Solver and Training Logic

**What:** Embedding CFR iteration logic directly in training handlers.

**Why bad:** Makes solver untestable in isolation, prevents swapping implementations.

**Instead:** Use adapter interface. Training layer only calls `solve(node): SolverNodeOutput`.

### Anti-Pattern 2: Client-Side Solver State

**What:** Running full CFR iterations in the browser.

**Why bad:**
- Memory constraints (game tree can be gigabytes)
- CPU blocks UI thread
- Non-deterministic across browsers

**Instead:**
- Pre-compute and serve
- If runtime solving needed, do it server-side
- WASM is optional future optimization, not default

### Anti-Pattern 3: Deep Component Prop Drilling for Animations

**What:** Passing animation callbacks through 5+ component layers.

**Why bad:** Maintenance nightmare, breaks separation of concerns.

**Instead:**
- Use animation context or state machine at page level
- Components report events, page coordinates animations
- Or use Framer Motion's AnimatePresence at appropriate scope

### Anti-Pattern 4: Monolithic Session State

**What:** Single session object with all training state, spot data, solver output, UI flags.

**Why bad:** Re-renders on any change, makes testing difficult, hard to cache.

**Instead:**
- Separate concerns: `session` (lifecycle), `currentSpot` (display), `lastResult` (feedback)
- V2 already does this well in `SessionPage`

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Solver compute** | In-process, single instance | Redis cache + multiple solver workers | Distributed solver cluster + CDN for pre-computed |
| **Database** | Single RDS instance | Read replicas for stats | Sharded by user_id |
| **Sessions** | In-memory session cache | Redis session store | Session service with horizontal scaling |
| **Pre-computed storage** | PostgreSQL JSONB | Blob storage (S3) + PostgreSQL index | CDN-backed blob + regional caches |
| **Real-time features** | Not needed v3 | WebSocket for live coaching | Full pub/sub infrastructure |

---

## Build Order Recommendations

Based on component dependencies, recommended phase order:

### Phase 1: Solver Foundation
- CFR+ core algorithm (TypeScript)
- Card/action abstraction layers
- Preflop range generation (pre-compute)
- Validation against known solutions

**Rationale:** Everything depends on solver. Mock solver works for UI development, but real solver enables actual training value.

### Phase 2: Backend Infrastructure
- Express scaffold with middleware
- PostgreSQL + Prisma setup
- Auth (users, JWT, password/email)
- Migrate V2 session handlers

**Rationale:** Backend must exist before frontend can integrate. Auth enables multi-device.

### Phase 3: Data Layer
- Decision persistence (replace in-memory)
- Stats aggregation service
- Pre-computed strategy storage
- Hybrid solver routing

**Rationale:** Persistence unlocks stats/review features. Hybrid solving connects solver to backend.

### Phase 4: Frontend Enhancement
- Animation framework setup
- Poker table component (animated)
- EV reveal animations
- Range grid visualization

**Rationale:** Functional UI exists in V2. Animations add polish, not core functionality.

### Phase 5: Integration and Polish
- End-to-end training flows
- Performance optimization
- Desktop packaging (Electron/Tauri)
- Convergence validation

**Rationale:** Full integration requires all previous phases complete.

---

## Sources and Confidence Notes

**HIGH confidence (established patterns):**
- CFR+ algorithm fundamentals (well-documented in academic literature)
- Card/action abstraction techniques (standard in solver implementations)
- Express + Prisma + PostgreSQL patterns (widely used)
- V2 codebase patterns (directly observable)

**MEDIUM confidence (training knowledge, not verified live):**
- Specific solver performance characteristics
- Exact abstraction bucket counts for quality/speed tradeoff
- Animation library recommendations (Framer Motion vs alternatives)
- Pre-computed strategy storage format

**LOW confidence (needs phase-specific research):**
- Exact convergence iterations needed for 0.1% EV accuracy
- Memory requirements for full NLHE game tree
- WASM compilation feasibility for CFR engine
- Specific benchmark comparisons to PioSolver

**Sources referenced:**
- Existing V2 codebase (`src/lib/engine/`, `src/lib/runtime/`, `src/lib/v2/`)
- Previous research in `.kiro/specs/ev-drill-trainer/research.md`
- CFR+ algorithm from academic literature (Tammelin 2014)
- OpenSpiel, RLCard documentation (referenced in prior research)
