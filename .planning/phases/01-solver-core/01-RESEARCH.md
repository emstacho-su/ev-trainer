# Phase 1: Solver Core - Research

**Researched:** 2026-02-04
**Domain:** CFR+ poker solver implementation in TypeScript
**Confidence:** MEDIUM (WebSearch findings cross-referenced with project requirements and existing codebase patterns)

## Summary

CFR+ (Counterfactual Regret Minimization Plus) is an iterative algorithm that converges to Nash equilibrium strategies for imperfect information games like poker. It was instrumental in solving heads-up limit hold'em (Cepheus) and is used in modern solvers like PioSolver. The algorithm maintains regret values for each action at each information set, uses regret matching to update strategies, and accumulates average strategies over iterations.

For a TypeScript implementation targeting 0.1% EV accuracy against PioSolver, the recommended approach is:
1. Build abstraction layers first (169 canonical preflop hands, 3-5 bet sizes)
2. Implement core CFR+ with proper regret flooring (floor cumulative regrets after accumulation, not instantaneous)
3. Use precomputed hand equity tables for performance
4. Validate exploitability convergence (target: <1 mbb/game)

The existing v2 codebase provides excellent foundations: deterministic RNG (`rng.ts`), solver interface contract (`solverAdapter.ts`), node caching (`solverResolver.ts`), and canonical hashing for node identity. The new solver implementation will replace `mockSolver.ts` while preserving these interfaces.

**Primary recommendation:** Implement preflop-only solver first with 169 canonical hands and 3-5 bet sizes, validate against known GTO charts, then expand to postflop with card abstraction.

## Standard Stack

The established libraries/tools for poker solver implementation:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | Solver language | Already in project, enables browser/Node.js dual use, no WASM complexity |
| poker-evaluator-ts | ^2.0.1 | 7-card hand evaluation | TypeScript-native, supports 3-7 cards, 22MM hands/sec, Two Plus Two algorithm |
| seedrandom | ^3.0.5 | Deterministic RNG | Already in v2 (via custom Mulberry32), reproducible solver runs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pokersolver | ^2.1.4 | Hand comparison fallback | If poker-evaluator-ts insufficient, supports 13+ game variants |
| Float64Array | Native | Regret/strategy storage | Memory-efficient numeric arrays for millions of info sets |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TypeScript | Rust + WASM | Rust 10-100x faster but adds build complexity, harder to debug, v3 doesn't need speed |
| TypeScript | Python | Python simpler but 100-1000x slower, not viable for real-time solving |
| poker-evaluator-ts | Custom hand ranker | Custom code fragile, hard to optimize, existing library battle-tested |
| Client-side solving | Pre-computed DB | Pre-compute eliminates latency but requires storage/bandwidth, hybrid best |

**Installation:**
```bash
npm install poker-evaluator-ts
# seedrandom already in v2 pattern (custom Mulberry32 implementation)
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/solver/
├── index.ts              # Public API: solve(), getSolution()
├── cfr.ts                # CFR+ core iteration loop
├── gameTree.ts           # Tree node types, traversal
├── infoSet.ts            # InfoSet storage, regret/strategy updates
├── abstraction/
│   ├── cards.ts          # Preflop canonicalization, E[HS] bucketing
│   ├── actions.ts        # Bet size abstraction
│   └── isomorphism.ts    # Suit isomorphism mapping
├── evaluation/
│   ├── equity.ts         # Monte Carlo equity calculation
│   ├── handRanking.ts    # 7-card evaluation via poker-evaluator-ts
│   └── precompute.ts     # Preflop equity tables
└── validation/
    ├── exploitability.ts # Best response calculation
    └── benchmark.ts      # PioSolver comparison suite
```

### Pattern 1: CFR+ Core Algorithm
**What:** Iterate over game tree, accumulate regrets, update strategies via regret matching.
**When to use:** Primary solving loop for all game tree traversals.
**Example:**
```typescript
// Source: stevengong.co/notes/Counterfactual-Regret-Minimization
interface InfoSet {
  strategySum: Float64Array;    // Accumulated for average strategy
  regretSum: Float64Array;      // Cumulative regrets (CFR+ floors at 0)
  actions: ActionId[];
}

function cfrIteration(node: GameNode, reachProbs: ReachProbabilities): number {
  if (node.isTerminal) return node.utility;
  if (node.isChance) return sampleChanceOutcome(node, reachProbs);

  const infoSet = getInfoSet(node.infoSetId);
  const strategy = regretMatching(infoSet.regretSum, infoSet.actions);

  const actionValues: number[] = [];
  for (let i = 0; i < infoSet.actions.length; i++) {
    const childNode = node.children[infoSet.actions[i]];
    const newReach = updateReachProb(reachProbs, node.player, strategy[i]);
    actionValues[i] = cfrIteration(childNode, newReach);
  }

  const nodeValue = dotProduct(strategy, actionValues);

  // CFR+ regret update: accumulate THEN floor
  for (let i = 0; i < infoSet.actions.length; i++) {
    const instantRegret = actionValues[i] - nodeValue;
    const counterfactualRegret = instantRegret * reachProbs.opponent;
    infoSet.regretSum[i] += counterfactualRegret;
    infoSet.regretSum[i] = Math.max(0, infoSet.regretSum[i]); // CFR+ floor
    infoSet.strategySum[i] += reachProbs.current * strategy[i]; // Average
  }

  return nodeValue;
}

function regretMatching(regretSum: Float64Array, actions: ActionId[]): number[] {
  const positiveRegrets = Array.from(regretSum).map(r => Math.max(0, r));
  const sum = positiveRegrets.reduce((a, b) => a + b, 0);

  if (sum <= 1e-9) {
    // Uniform when no positive regrets
    return actions.map(() => 1 / actions.length);
  }

  return positiveRegrets.map(r => r / sum);
}
```

### Pattern 2: Preflop Card Abstraction
**What:** Map 1,326 possible hands to 169 canonical hands via suit isomorphism.
**When to use:** All preflop solving, hand range representations.
**Example:**
```typescript
// Source: cs.cmu.edu/~kwaugh/publications/isomorphism13.pdf
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function canonicalizePreflop(card1: string, card2: string): string {
  const r1 = rankOf(card1);
  const r2 = rankOf(card2);
  const suited = suitOf(card1) === suitOf(card2);

  // Sort by rank (higher first)
  const [high, low] = RANKS.indexOf(r1) < RANKS.indexOf(r2)
    ? [r1, r2]
    : [r2, r1];

  if (high === low) return `${high}${low}`; // Pairs: AA, KK, ...
  return `${high}${low}${suited ? 's' : 'o'}`; // AKs, AKo, ...
}

// 13 pairs + 78 suited + 78 offsuit = 169 canonical hands
function buildPreflopAbstraction(): Map<string, number> {
  const abstraction = new Map<string, number>();
  let bucketId = 0;

  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i; j < RANKS.length; j++) {
      if (i === j) {
        abstraction.set(`${RANKS[i]}${RANKS[j]}`, bucketId++); // Pairs
      } else {
        abstraction.set(`${RANKS[i]}${RANKS[j]}s`, bucketId++); // Suited
        abstraction.set(`${RANKS[i]}${RANKS[j]}o`, bucketId++); // Offsuit
      }
    }
  }

  return abstraction; // Returns 169 buckets
}
```

### Pattern 3: Bet Size Abstraction
**What:** Discrete set of bet sizes to reduce action space.
**When to use:** All bet/raise actions in game tree construction.
**Example:**
```typescript
// Source: blog.gtowizard.com/dynamic-sizing-benchmarks/
const STANDARD_BET_SIZES = [0.33, 0.50, 0.75, 1.0] as const; // % of pot
const STANDARD_RAISE_SIZES = [2.2, 2.5, 3.0] as const; // x of facing bet

interface BetSizeConfig {
  street: Street;
  position: 'IP' | 'OOP';
  potBb: number;
  stackBb: number;
}

function getAbstractedBetSizes(config: BetSizeConfig): number[] {
  const baseSizes = config.position === 'IP'
    ? [0.33, 0.67, 1.0]
    : [0.33, 0.50, 0.75]; // OOP uses smaller river bets

  const betsBb = baseSizes
    .map(size => size * config.potBb)
    .filter(bet => bet < config.stackBb);

  // Always include all-in when stack < 2x pot
  if (config.stackBb <= 2 * config.potBb) {
    betsBb.push(config.stackBb);
  }

  return betsBb;
}
```

### Pattern 4: Exploitability Measurement
**What:** Compute how much best response strategy can exploit current strategy.
**When to use:** Convergence criterion, benchmark validation.
**Example:**
```typescript
// Source: nature.com/articles/s41598-025-86899-8
function computeExploitability(strategy: Strategy, gameTree: GameTree): number {
  // 1. Compute best response for opponent against current strategy
  const bestResponse = computeBestResponse(strategy, gameTree);

  // 2. Compute EV of best response vs strategy
  const brEv = computeEV(bestResponse, strategy, gameTree);

  // 3. Compute EV of Nash equilibrium (both play optimally)
  const nashEv = 0; // Zero-sum game, Nash EV = 0

  // 4. Exploitability = how much BR gains
  return brEv - nashEv;
}

function hasConverged(exploitability: number, targetMbb: number): boolean {
  return exploitability <= targetMbb; // e.g., 0.1 mbb for high accuracy
}
```

### Anti-Patterns to Avoid
- **Floating point regret accumulation without floor:** CFR+ MUST floor cumulative regrets at 0 after accumulating. Flooring instantaneous regret breaks convergence.
- **Ignoring suit isomorphism:** AhKh and AsKs must map to same strategy preflop. Without isomorphism, memory explodes 4-24x and strategies diverge incorrectly.
- **All-in tree traversal:** Don't build full game tree upfront. Use lazy generation on-demand to avoid memory explosion (NLHE has 10^160 states).
- **Skipping frequency normalization checks:** Always assert `sum(frequencies) ≈ 1.0` after regret matching to catch NaN/division-by-zero bugs early.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 7-card hand ranking | Custom evaluator | poker-evaluator-ts | Two Plus Two algorithm, 22MM hands/sec, battle-tested, handles edge cases |
| Hand equity calculation | Naive simulation | Precomputed tables + Monte Carlo | Equity calc is O(n²), precompute 169x169 preflop table once, query O(1) |
| Suit canonicalization | Ad-hoc string parsing | Isomorphism algorithm (Waugh 2013) | 13! permutations, complex edge cases, proven algorithm handles all |
| Bet size rounding | Manual float rounding | Integer big blinds x100 | Floating point errors accumulate, use integer cents throughout |
| Game tree serialization | JSON.stringify | MessagePack or protobuf | JSON slow for large trees, binary formats 5-10x smaller/faster |

**Key insight:** Poker game theory optimal solving has 15+ years of academic research. Hand evaluation, equity calculation, and abstraction techniques are well-established with proven implementations. Focus effort on CFR+ correctness and validation, not reinventing primitives.

## Common Pitfalls

### Pitfall 1: CFR+ Regret Floor Timing Error
**What goes wrong:** Implementing regret floor incorrectly causes non-convergence. CFR+ floors cumulative regrets at 0, not instantaneous regrets.
**Why it happens:** Misreading Tammelin 2014 paper, or confusing "regret matching clips negatives" with "CFR+ floors cumulative".
**How to avoid:**
```typescript
// CORRECT: Floor AFTER accumulating instantaneous regret
regretSum[a] += instantaneousRegret[a];
regretSum[a] = Math.max(0, regretSum[a]);

// WRONG: Floor instantaneous regret before accumulation
// instantaneousRegret[a] = Math.max(0, instantaneousRegret[a]);
// regretSum[a] += instantaneousRegret[a];
```
**Warning signs:** Exploitability plateaus above target, strategies oscillate instead of stabilizing, results differ from reference solvers by >0.5% EV.

### Pitfall 2: NaN Propagation from Zero Regrets
**What goes wrong:** When all regrets are zero (common early iterations), `strategy[a] = regret[a] / sum(regret)` divides by zero, producing NaN. NaN propagates through tree, corrupting all strategies.
**Why it happens:** Edge case in regret matching when player has no preference yet.
**How to avoid:**
```typescript
function regretMatching(regretSum: Float64Array): number[] {
  const positiveRegrets = Array.from(regretSum).map(r => Math.max(0, r));
  const sum = positiveRegrets.reduce((a, b) => a + b, 0);

  if (sum <= 1e-9) { // CRITICAL: Handle zero-regret case
    return positiveRegrets.map(() => 1 / positiveRegrets.length);
  }

  return positiveRegrets.map(r => r / sum);
}
```
**Warning signs:** NaN in strategy arrays, frequency sums != 1.0, non-deterministic results with same seed.

### Pitfall 3: Memory Explosion Without Abstraction
**What goes wrong:** Full NLHE game tree has 10^17 states. Building tree without card/bet abstraction exhausts memory in seconds.
**Why it happens:** Underestimating tree size, implementing tree builder before abstraction layer.
**How to avoid:**
1. Build abstraction layer FIRST (169 hands, 3-5 bet sizes)
2. Implement lazy tree generation (build nodes on-demand during traversal)
3. Set explicit node budget with assertion
**Warning signs:** Memory usage grows linearly with iterations (should stabilize after first pass), GC pauses increasing, node count >10M for simple preflop scenario.

### Pitfall 4: Suit Isomorphism Breaking Strategy Consistency
**What goes wrong:** AhKh and AsKs treated as different hands preflop. Solver computes separate strategies, memory explodes 4x, validation fails.
**Why it happens:** Forgetting that suits have no absolute value until board is dealt.
**How to avoid:**
```typescript
function testIsomorphism() {
  const canonAhKh = canonicalizePreflop('Ah', 'Kh');
  const canonAsKs = canonicalizePreflop('As', 'Ks');
  assert(canonAhKh === canonAsKs, 'Suited hands must map to same canonical');
  assert(canonAhKh === 'AKs', 'Expected canonical format');
}
```
**Warning signs:** 1,326 preflop buckets instead of 169, memory usage 4-24x higher than expected, strategies differ for isomorphic hands.

### Pitfall 5: Determinism Breaking After Solver Integration
**What goes wrong:** Solver tree traversal order depends on Map iteration order or async execution. Same seed produces different results.
**Why it happens:** JavaScript Map iteration is insertion-order dependent. If nodes inserted in different order (timing, parallelization), traversal differs.
**How to avoid:**
```typescript
// CORRECT: Sort actions before traversing
const actions = Array.from(node.children.keys()).sort();
for (const action of actions) {
  traverse(node.children.get(action));
}

// WRONG: Direct Map iteration (order-dependent)
// for (const [action, child] of node.children) { ... }
```
**Warning signs:** Existing determinism tests fail, same seed/sessionId produces different grades, results change after unrelated code modifications.

## Code Examples

Verified patterns from official sources:

### Preflop Equity Calculation (Monte Carlo)
```typescript
// Source: github.com/zekyll/OMPEval
import { evaluateHand } from 'poker-evaluator-ts';

function calculatePreflopEquity(
  hand1: [string, string],
  hand2: [string, string],
  iterations: number = 10000
): number {
  let wins = 0;
  let ties = 0;

  for (let i = 0; i < iterations; i++) {
    const deck = shuffleDeck([...FULL_DECK]);
    const board = deck.slice(0, 5); // Deal 5 board cards

    const eval1 = evaluateHand([...hand1, ...board]);
    const eval2 = evaluateHand([...hand2, ...board]);

    if (eval1.rank > eval2.rank) wins++;
    else if (eval1.rank === eval2.rank) ties++;
  }

  return (wins + ties / 2) / iterations;
}
```

### Info Set Storage (Sparse Map)
```typescript
// Source: github.com/b-inary/poker-cfr
class InfoSetStore {
  private store = new Map<string, InfoSet>();

  getOrCreate(infoSetId: string, numActions: number): InfoSet {
    if (!this.store.has(infoSetId)) {
      this.store.set(infoSetId, {
        strategySum: new Float64Array(numActions),
        regretSum: new Float64Array(numActions),
        actions: [] // Populated on first access
      });
    }
    return this.store.get(infoSetId)!;
  }

  getAverageStrategy(infoSetId: string): number[] {
    const infoSet = this.store.get(infoSetId);
    if (!infoSet) return [];

    const sum = infoSet.strategySum.reduce((a, b) => a + b, 0);
    if (sum <= 1e-9) {
      return Array(infoSet.strategySum.length).fill(1 / infoSet.strategySum.length);
    }

    return Array.from(infoSet.strategySum).map(s => s / sum);
  }
}
```

### Exploitability Convergence Check
```typescript
// Source: arxiv.org/pdf/1809.04040
interface ConvergenceMetrics {
  iteration: number;
  exploitability: number; // in mbb/game
  elapsed: number;
}

function checkConvergence(
  metrics: ConvergenceMetrics,
  target: number = 0.1 // 0.1 mbb = 0.1% EV accuracy
): { converged: boolean; message: string } {
  if (metrics.exploitability <= target) {
    return {
      converged: true,
      message: `Converged at iteration ${metrics.iteration} (${metrics.exploitability.toFixed(3)} mbb)`
    };
  }

  // Theoretical convergence: O(1/sqrt(T))
  const estimatedIterations = Math.ceil(
    metrics.iteration * Math.pow(metrics.exploitability / target, 2)
  );

  return {
    converged: false,
    message: `Current: ${metrics.exploitability.toFixed(3)} mbb, estimated ${estimatedIterations} iterations needed`
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vanilla CFR | CFR+ with regret floor | 2014 (Tammelin) | 10x faster convergence for poker |
| Full game tree | Lazy generation + abstraction | 2000s (Billings et al) | Makes NLHE tractable (10^17 → 10^8 nodes) |
| Monte Carlo sampling | Precomputed equity tables | 2010s (Slumbot) | O(1) lookup vs O(n²) simulation |
| Uniform bet sizes | Dynamic abstraction | 2020s (PioSolver) | +2-5% EV accuracy vs fixed 33/66/100 |
| C++ solvers | WASM browser solvers | 2019 (b-inary) | Client-side solving, no server cost |

**Deprecated/outdated:**
- **Vanilla CFR without regret floor:** CFR+ dominates in practice, 10x faster convergence
- **E[HS] bucketing for postflop:** Modern solvers use neural network embeddings or k-means on equity distributions (more accurate)
- **Fixed 3-bet abstraction:** Adaptive abstractions (pot-size dependent) outperform fixed sizings by 2-5% EV

## Open Questions

Things that couldn't be fully resolved:

1. **Exact convergence iterations for 0.1% EV**
   - What we know: Theoretical bound is O(1/√T), practical poker needs millions of iterations
   - What's unclear: Exact number depends on abstraction quality, we need empirical testing
   - Recommendation: Start with 1M iterations, measure exploitability, extrapolate via O(1/√T) formula

2. **Postflop card abstraction bucket count**
   - What we know: Too few buckets (50) loses accuracy, too many (500) bloats memory
   - What's unclear: Optimal tradeoff for 0.1% EV target
   - Recommendation: Start with 169 (same as preflop), validate against PioSolver, tune if needed

3. **Memory requirements for full tree**
   - What we know: Preflop 169 hands × 3-5 bet sizes = ~10k nodes (tractable), postflop exponentially larger
   - What's unclear: At what postflop depth do we hit memory limits in browser/Node.js?
   - Recommendation: Implement preflop first, profile memory on postflop, switch to pre-computed strategies if needed

4. **Validation methodology against PioSolver**
   - What we know: PioSolver is industry standard, validation requires matching bet sizes and ranges
   - What's unclear: Do we need PioSolver license? Can we use public GTO charts instead?
   - Recommendation: Start with public preflop charts (free), use PioSolver for postflop validation if budget allows

## Sources

### Primary (HIGH confidence)
- [Counterfactual Regret Minimization (Zinkevich 2007)](https://poker.cs.ualberta.ca/publications/NIPS07-cfr.pdf) - Original CFR paper, algorithm foundation
- [Fast Hand Isomorphism Algorithm (Waugh 2013)](https://www.cs.cmu.edu/~kwaugh/publications/isomorphism13.pdf) - Suit canonicalization methodology
- [CFR+ Deep Counterfactual Regret Minimization](https://arxiv.org/pdf/1811.00164) - CFR+ variant used in Libratus
- [poker-evaluator-ts npm package](https://www.npmjs.com/package/poker-evaluator-ts) - TypeScript hand evaluator library
- Existing v2 codebase: `solverAdapter.ts`, `rng.ts`, `nodeTypes.ts`, `mockSolver.ts` - Interface contracts and patterns

### Secondary (MEDIUM confidence - WebSearch verified with multiple sources)
- [Counterfactual Regret Minimization Notes](https://stevengong.co/notes/Counterfactual-Regret-Minimization) - CFR algorithm explanation
- [GTO Wizard: How Solvers Work](https://blog.gtowizard.com/how-solvers-work/) - Solver architecture overview
- [GTO Wizard: Dynamic Sizing Benchmarks](https://blog.gtowizard.com/dynamic-sizing-benchmarks/) - Bet size abstraction recommendations
- [b-inary/poker-cfr GitHub](https://github.com/b-inary/poker-cfr) - Rust CFR implementation patterns
- [goldfire/pokersolver GitHub](https://github.com/goldfire/pokersolver) - JavaScript hand evaluation library
- [Nature: Comparative Analysis of CFR Algorithms](https://www.nature.com/articles/s41598-025-86899-8) - Recent 2025 benchmarks

### Tertiary (LOW confidence - WebSearch only, needs validation)
- [Phil Galfond: Exploiting GTO Bet Sizing](https://www.philgalfond.com/articles/exploiting-gto-bet-sizing) - Practical bet sizing discussion
- [AI Poker Tutorial: CFR Algorithm](https://aipokertutorial.com/the-cfr-algorithm/) - Tutorial on CFR basics
- Community discussions on bet abstraction (33/50/75/100) - Common practice, not academically verified

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - poker-evaluator-ts verified via npm, TypeScript chosen by project, hand evaluator performance from package docs
- Architecture: HIGH - CFR+ algorithm well-documented in academic papers, patterns from open-source implementations
- Pitfalls: HIGH - Regret floor error documented in prior research (PITFALLS.md), suit isomorphism from Waugh 2013, determinism from v2 codebase

**Research date:** 2026-02-04
**Valid until:** 30 days (CFR+ is stable algorithm, but solver implementation techniques evolve slowly)

**Limitations:**
- No access to PioSolver source code (proprietary), validation approach based on public benchmark data
- GTO Nexus source code not available (closed-source freeware), UI patterns observable but implementation unknown
- Exact convergence characteristics for 0.1% EV target will require empirical testing during implementation
- WebSearch results from 2025-2026, but most cited papers are from 2007-2019 (CFR algorithm research is mature)
