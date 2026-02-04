# Domain Pitfalls

**Domain:** Poker Solver Training Platform with CFR+ Implementation
**Researched:** 2026-02-03
**Confidence:** MEDIUM (based on training data and project analysis; no live web verification available)

## Critical Pitfalls

Mistakes that cause rewrites, major convergence failures, or system-breaking issues.

### Pitfall 1: CFR+ Regret Floor Implementation Error

**What goes wrong:** CFR+ differs from vanilla CFR by flooring cumulative regrets at zero. Implementing this incorrectly (flooring instantaneous regret instead of cumulative, or flooring at wrong stage) causes non-convergence or slow convergence to wrong equilibrium.

**Why it happens:** The algorithm paper (Tammelin 2014) describes flooring after adding instantaneous regret to cumulative. Implementers sometimes floor before accumulation, or forget that the floor applies to cumulative regret (not strategy or counterfactual values).

**Consequences:**
- Solver never converges to Nash equilibrium
- Exploitability remains high (>1% pot) even after millions of iterations
- Benchmark validation against PioSolver fails systematically
- Debugging is difficult because strategies look reasonable but are subtly wrong

**Prevention:**
```typescript
// CORRECT: Floor AFTER accumulation
cumulativeRegret[action] = Math.max(0, cumulativeRegret[action] + instantaneousRegret);

// WRONG: Floor BEFORE accumulation
// instantaneousRegret = Math.max(0, instantaneousRegret);  // Don't do this
// cumulativeRegret[action] += instantaneousRegret;
```

**Warning signs:**
- Exploitability decreases then plateaus above target threshold
- Strategies oscillate instead of stabilizing
- Results differ from reference solver by >0.5% EV consistently

**Detection:**
- Compare against known-good solver on small game tree (10-20 nodes)
- Track exploitability curve - should decrease monotonically with 1/sqrt(T)
- Unit test regret update logic with hand-computed examples

**Phase to address:** Solver Core (CFR+ implementation phase) - build exploitability tracking from day one

---

### Pitfall 2: Floating Point Precision in Strategy Normalization

**What goes wrong:** When all regrets are zero or near-zero, strategy normalization divides by zero or produces NaN/Infinity. Common in early iterations and terminal-adjacent nodes.

**Why it happens:** CFR computes strategy from positive regrets: `p(a) = max(0, R(a)) / sum(max(0, R(a)))`. When denominator is zero, naive implementation fails.

**Consequences:**
- NaN propagates through entire tree traversal
- Silent corruption of strategy tables
- Determinism breaks (NaN comparisons are inconsistent)
- Grading produces meaningless EV values

**Prevention:**
```typescript
function regretMatchingStrategy(regrets: number[]): number[] {
  const positiveRegrets = regrets.map(r => Math.max(0, r));
  const sum = positiveRegrets.reduce((a, b) => a + b, 0);

  if (sum <= EPSILON) {
    // Uniform distribution when no positive regrets
    return regrets.map(() => 1 / regrets.length);
  }

  return positiveRegrets.map(r => r / sum);
}
```

**Warning signs:**
- `NaN` appearing in strategy arrays
- Frequencies not summing to 1.0 (already validated in solverAdapter.ts)
- Inconsistent results between runs with same seed

**Detection:**
- Add assertions: `if (!Number.isFinite(frequency)) throw new Error(...)`
- Validate frequency sum === 1.0 after every normalization (existing validation)
- Log zero-regret nodes during development

**Phase to address:** Solver Core - must be handled in initial regret matching implementation

---

### Pitfall 3: Memory Explosion from Unabstracted Game Tree

**What goes wrong:** NLHE has ~10^160 possible game states. Without card/bet abstraction, memory grows unbounded and solver crashes or thrashes.

**Why it happens:** Building full game tree before understanding abstraction requirements. Each node stores regrets and strategy arrays. Without abstraction, even moderate stack depths create millions of nodes.

**Consequences:**
- Out of memory errors after few iterations
- TypeScript heap limits hit (~4GB default Node.js)
- Solving becomes impractical even for simple spots
- Project scope creep trying to optimize memory

**Prevention:**
1. **Card abstraction first:** Implement hand clustering (e.g., equity buckets, isomorphic suits) before tree building
2. **Bet abstraction:** Limit to 3-4 bet sizes per street, not continuous
3. **Lazy tree generation:** Build nodes on-demand during traversal, not upfront
4. **Memory budget:** Set explicit node limit, fail fast if exceeded

```typescript
interface TreeConfig {
  maxNodes: number;  // e.g., 1_000_000
  abstractionVersion: string;
}

function createNode(state: GameState, config: TreeConfig): TreeNode {
  if (nodeCount >= config.maxNodes) {
    throw new Error(`Tree exceeded ${config.maxNodes} node limit`);
  }
  nodeCount++;
  // ... create node
}
```

**Warning signs:**
- Memory usage grows linearly with iterations (should stabilize after first pass)
- GC pauses increasing over time
- Node count >> 10M for simple preflop scenario

**Detection:**
- Monitor `process.memoryUsage().heapUsed` during solving
- Profile node creation rate
- Set memory budget and alert on 80% threshold

**Phase to address:** Abstraction Layer (before CFR+ implementation) - design abstraction first, then implement CFR on abstracted tree

---

### Pitfall 4: Determinism Broken by Iteration Order

**What goes wrong:** Solver produces different results for same seed because tree traversal order varies (Map/Set iteration, async execution, or floating point accumulation order).

**Why it happens:** JavaScript's Map iteration is insertion-order dependent. If nodes are inserted in different orders (due to timing, parallelization, or data source ordering), traversal order changes, and accumulated floating-point errors differ.

**Consequences:**
- Existing determinism tests fail after solver integration
- Session replays produce different grades
- Core product value (reproducible training) breaks
- Very difficult to debug without awareness

**Prevention:**
1. **Sort children before traversal:** Always traverse in canonical order (e.g., by action ID)
2. **Avoid mutation during iteration:** Don't modify tree structure while traversing
3. **Use deterministic containers:** Arrays sorted by key, not Maps for iteration

```typescript
// CORRECT: Sort before iteration
const actions = [...node.children.keys()].sort();
for (const action of actions) {
  traverse(node.children.get(action));
}

// WRONG: Direct Map iteration (insertion-order dependent)
// for (const [action, child] of node.children) { ... }
```

**Warning signs:**
- Same seed/sessionId produces different spotId sequences
- Determinism tests pass locally, fail in CI
- Results change after code that doesn't touch RNG

**Detection:**
- Run determinism replay test (already exists in project) after solver integration
- Compare node visit order between runs
- Hash full tree state, compare across runs

**Phase to address:** Solver Core - enforce in initial tree traversal implementation

---

### Pitfall 5: Card Isomorphism Breaking Hand Clusters

**What goes wrong:** Card abstraction treats AhKh and AsKs as different hands, exploding memory by 4x for suited hands and causing incorrect strategy computation.

**Why it happens:** Poker hands are suit-isomorphic preflop (until board is dealt). Failing to canonicalize suits means each suit permutation is stored separately, and the solver computes strategies for each independently (which then diverge incorrectly).

**Consequences:**
- Memory usage 4-24x higher than necessary
- Same strategic situation has different strategies depending on suits
- Benchmark comparison to PioSolver fails (PioSolver uses isomorphism)
- 0.1% EV convergence target impossible to hit

**Prevention:**
1. **Canonical suit ordering:** Always represent hands with suits in canonical order (e.g., first suit = spades, second = hearts, etc.)
2. **Hash by isomorphism class:** Group hands by rank pattern and flush/non-flush status
3. **Test isomorphism:** `AhKh` and `AsKs` must map to same strategy lookup

```typescript
function canonicalizeHand(card1: string, card2: string): string {
  // Sort by rank, then apply canonical suit mapping
  const [high, low] = [card1, card2].sort(byRank);
  const suited = suitOf(high) === suitOf(low);
  return `${rankOf(high)}${rankOf(low)}${suited ? 's' : 'o'}`;
}
```

**Warning signs:**
- Strategy differs for AhKh vs AsKs preflop
- Node count is ~24x expected for preflop tree
- Memory usage unexpectedly high

**Detection:**
- Unit test that isomorphic hands return identical strategies
- Count unique preflop nodes (should be 169 for 13x13 grid, not 1326)
- Compare memory footprint to reference solver

**Phase to address:** Card Abstraction Layer - implement before tree building

---

### Pitfall 6: Bet Size Abstraction Causing Strategy Distortion

**What goes wrong:** Abstracting bet sizes to fixed percentages (e.g., 33%, 66%, 100% pot) creates "gaps" that distort optimal strategy and prevent accurate EV computation.

**Why it happens:** Real poker allows continuous bet sizes. Abstracting to discrete sizes means some optimal bets can't be represented. If abstraction is too coarse, solver computes strategy for wrong bet sizes, producing significantly off-equilibrium play.

**Consequences:**
- Computed EV differs from PioSolver by >0.1% target
- Strategies recommend 66% pot when 75% is optimal
- Users learn incorrect bet sizing patterns
- Benchmark validation systematically fails

**Prevention:**
1. **Match reference solver sizings:** Use same bet sizes as PioSolver for validation
2. **Include common sizings:** 25%, 33%, 50%, 66%, 75%, 100%, 150% pot minimum
3. **All-in always available:** Don't abstract away all-in when stack < 2x pot
4. **Test sensitivity:** Compare strategies with slightly different sizing sets

```typescript
const STANDARD_BET_SIZES = [0.33, 0.50, 0.66, 0.75, 1.0];
const STANDARD_RAISE_SIZES = [2.2, 2.5, 3.0]; // as multiplier of facing bet

// Always include all-in when relevant
function getAvailableSizes(potBb: number, stackBb: number): number[] {
  const sizes = STANDARD_BET_SIZES.filter(s => s * potBb < stackBb);
  if (stackBb <= 2 * potBb) {
    sizes.push(stackBb / potBb); // All-in
  }
  return sizes;
}
```

**Warning signs:**
- Strategies heavily favor edge sizings (smallest or largest)
- EV gap with PioSolver varies by street/situation
- Users report "this sizing feels wrong" feedback

**Detection:**
- Benchmark against PioSolver with identical sizing configuration
- A/B test: compare strategy accuracy with 3 vs 5 vs 7 bet sizes
- Plot EV error vs abstraction granularity

**Phase to address:** Bet Abstraction Layer - design sizings before tree building, validate against PioSolver early

---

### Pitfall 7: PostgreSQL Migration Losing localStorage Data

**What goes wrong:** Migration to PostgreSQL loses existing user sessions, history, and statistics stored in localStorage.

**Why it happens:** Migration focuses on new schema and API, forgetting that users have accumulated data. No import path is built, or import path is built but not tested with real data shapes.

**Consequences:**
- Users lose months of training history
- Trust and goodwill destroyed
- Support requests spike
- May need to rollback deployment

**Prevention:**
1. **Export before migration:** Build localStorage export feature BEFORE backend
2. **Import after migration:** Build import endpoint that ingests exported data
3. **Schema compatibility:** Ensure PostgreSQL schema can represent all localStorage fields
4. **Run migration on real data:** Test with actual user localStorage dumps

```typescript
// Export format (localStorage -> JSON file)
interface ExportData {
  version: string;
  exportedAt: string;
  sessions: PersistedSessionRecord[];
  stats: GlobalStats;
}

// Import endpoint (JSON -> PostgreSQL)
POST /api/user/import
{ data: ExportData }
```

**Warning signs:**
- Migration plan doesn't mention existing data
- Schema mismatches between localStorage and PostgreSQL types
- No "export my data" feature planned

**Detection:**
- Ask: "What happens to existing localStorage users?"
- Checklist: export feature, import endpoint, schema mapping, test with real data
- User acceptance testing with beta testers

**Phase to address:** Migration Planning - design export/import before building new backend

---

### Pitfall 8: Authentication Breaking Session Determinism

**What goes wrong:** Adding user authentication changes session key derivation, breaking replay determinism. Sessions created before auth can't be replayed after.

**Why it happens:** Current session key is `seed::sessionId`. Adding userId to key changes hashes, different spot sequences result.

**Consequences:**
- Existing determinism guarantees break
- Old sessions return different grades on replay
- Core product value (reproducible learning) undermined
- Regression in production if not caught

**Prevention:**
1. **Preserve key derivation:** Keep session key derivation independent of userId
2. **User scoping separate:** Use userId for access control, not key derivation
3. **Version the key algorithm:** Include keyVersion so old sessions use old algorithm

```typescript
// Current (keep this for determinism)
const sessionKey = `${seed}::${sessionId}`;

// With auth (separate concerns)
const sessionKey = `${seed}::${sessionId}`;  // Determinism
const accessKey = `${userId}::${sessionKey}`;  // Access control
```

**Warning signs:**
- Determinism tests fail after auth integration
- Session replay produces different sequences
- "Session not found" errors for legitimate sessions

**Detection:**
- Run full determinism test suite after auth changes
- Compare pre-auth and post-auth session replays
- Add regression test: old session format + new auth = same results

**Phase to address:** Authentication Phase - design with determinism preservation from start

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or significant rework.

### Pitfall 1: TypeScript Heap Limits for Large Solves

**What goes wrong:** Node.js default heap is ~4GB. Large CFR+ solves exceed this, causing crashes without useful error messages.

**Why it happens:** Accumulating regret/strategy arrays for millions of nodes. V8 GC struggles with many small objects.

**Prevention:**
- Set `--max-old-space-size=8192` or higher in dev/prod scripts
- Implement memory monitoring and early warning
- Use typed arrays (Float64Array) instead of regular arrays for numeric data
- Consider worker threads for parallel solving

**Phase to address:** Solver Core - configure memory early, monitor throughout

---

### Pitfall 2: Solver Output Format Incompatible with Grading

**What goes wrong:** CFR+ solver produces raw regrets/strategies, but grading expects `SolverNodeOutput` format with specific fields. Conversion loses precision or misformats.

**Why it happens:** Solver is built in isolation, then forced to match existing interface. Interface was designed for mock data, not real CFR output.

**Prevention:**
- Review `SolverNodeOutput` interface before building solver
- Design CFR output to produce this format natively
- Add exploitability field (already optional in interface)
- Ensure units (bb vs chips) are consistent

**Phase to address:** Solver Core - validate interface compatibility before implementation

---

### Pitfall 3: Range Context Ignored in Abstraction

**What goes wrong:** Same board/action sequence produces different solutions depending on preflop ranges (SB vs BTN has different strategy). Abstraction ignores this, merging incompatible nodes.

**Why it happens:** Card abstraction focuses on board cards, forgetting that range context affects strategy. Two "same" spots with different ranges are actually different.

**Prevention:**
- Include range identifier in node canonical key (already `rangeContext?: string` exists)
- Populate range context for all training spots
- Test: different ranges for same board = different strategies

**Phase to address:** Card Abstraction Layer - incorporate range context in hashing

---

### Pitfall 4: Practice Mode Breaks with Real Solver Latency

**What goes wrong:** Mock solver returns instantly. Real CFR+ takes seconds per node. UI becomes unresponsive, practice mode unusable.

**Why it happens:** UI assumes synchronous solver response. No loading states, timeouts, or caching for expensive operations.

**Prevention:**
- Implement solver cache (existing `nodeCache.ts`) before real solver
- Add loading states to UI
- Pre-solve common spots, cache results
- Consider background worker for on-demand solving

**Phase to address:** UI Integration - after Solver Core, before full integration

---

### Pitfall 5: Transaction Boundaries Wrong in PostgreSQL Layer

**What goes wrong:** Session mutations span multiple queries without transactions. Race conditions corrupt session state or lose entries.

**Why it happens:** In-memory store has no transaction concept. Porting to PostgreSQL without adding transactions creates race windows.

**Prevention:**
- Use Prisma transactions for multi-table operations
- Design operations as atomic units
- Test concurrent session operations

```typescript
// CORRECT: Atomic operation
await prisma.$transaction([
  prisma.session.update({ where: { id }, data: { currentSpotIndex: i + 1 } }),
  prisma.decision.create({ data: decisionEntry }),
]);

// WRONG: Separate queries (race window)
// await prisma.session.update(...);
// await prisma.decision.create(...);
```

**Phase to address:** Backend Migration - design transaction boundaries early

---

### Pitfall 6: Preflop Range Grid State Management

**What goes wrong:** 13x13 grid has 169 cells, each with up to 5 actions, each with frequency. Managing this state in React becomes complex, slow, or buggy.

**Why it happens:** Naive implementation stores full grid in useState, rerenders entire grid on any change. Large state objects cause performance issues.

**Prevention:**
- Use React context or state management library (Zustand)
- Memoize cell components
- Virtualize grid if performance issues arise
- Store strategy as sparse object, not dense array

**Phase to address:** Preflop Training - choose state management approach before implementation

---

## Minor Pitfalls

Mistakes that cause annoyance but are recoverable.

### Pitfall 1: Solver Version Drift

**What goes wrong:** Cached solver results become stale when algorithm improves. Old cache serves outdated strategies.

**Prevention:**
- Include `solverVersion` in cache key (already done)
- Clear cache on solver version bump
- Document version upgrade procedure

**Phase to address:** Solver Core - maintain version discipline from start

---

### Pitfall 2: Exploitability Units Confusion

**What goes wrong:** Exploitability reported in different units (bb vs mbb vs percentage of pot), causing confusion when comparing to benchmarks.

**Prevention:**
- Document units clearly in interface
- Use mbb (milli-big-blinds) for exploitability
- Match PioSolver's convention for comparison

**Phase to address:** Solver Core - document units in implementation

---

### Pitfall 3: Dark Theme Breaks Card Readability

**What goes wrong:** Dark theme (poker felt aesthetic) makes card suits hard to distinguish, especially red/black.

**Prevention:**
- Test card contrast on dark background
- Use distinct colors beyond red/black (blue spades, green clubs)
- User preference for color scheme

**Phase to address:** UI Overhaul - test with real card designs early

---

### Pitfall 4: Animation Performance on Decision Submit

**What goes wrong:** EV reveal animations block UI, making rapid practice feel sluggish.

**Prevention:**
- Decouple animation from data fetching
- Allow "skip animation" preference
- Use CSS animations (GPU-accelerated) not JS

**Phase to address:** UI Overhaul - performance test animations

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| CFR+ Core | Regret floor error, normalization NaN | Unit test regret update with hand-computed examples |
| Card Abstraction | Isomorphism missing, memory explosion | Test AhKh === AsKs before tree building |
| Bet Abstraction | Sizing distortion | Match PioSolver sizings for benchmark |
| Game Tree | Memory explosion | Lazy generation with node budget |
| Backend Migration | Data loss | Export/import feature before migration |
| Authentication | Determinism break | Keep session key derivation auth-independent |
| Preflop UI | State management complexity | Choose Zustand/Context early, memoize cells |
| Benchmark Validation | Multiple causes | Validate at each layer, not just final output |

## Sources

**Project analysis:**
- `.planning/codebase/ARCHITECTURE.md` - existing determinism patterns
- `.planning/codebase/CONCERNS.md` - identified fragile areas
- `.planning/PROJECT.md` - v3 requirements and constraints
- `src/lib/engine/solverAdapter.ts` - solver output interface
- `src/lib/engine/grading.ts` - EV computation requirements
- `src/lib/engine/rng.ts` - determinism implementation
- `.kiro/specs/ev-drill-trainer/research.md` - prior solver research

**Training data (MEDIUM confidence - not web-verified):**
- CFR+ algorithm (Tammelin 2014) - regret flooring, convergence properties
- Poker solver implementation patterns - card isomorphism, bet abstraction
- PostgreSQL migration patterns - transaction boundaries, data migration
- React state management patterns - large grid performance

**Note:** WebSearch and WebFetch were unavailable for this research. Findings are based on project analysis and training data. Critical implementation details (e.g., exact CFR+ algorithm behavior) should be verified against academic papers or reference implementations before coding.

---

*Pitfalls research: 2026-02-03*
