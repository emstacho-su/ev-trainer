# Phase 10: Postflop Training - Research

**Researched:** 2026-02-16
**Domain:** Postflop solver performance, multi-street state machines, board texture classification, hand strength categorization, multiway approximation
**Confidence:** MEDIUM-HIGH (Solver patterns from existing codebase; ecosystem patterns from official docs and verified sources; some multiway approximation guidance from research papers)

## Summary

This research covers the technical foundation for implementing multi-street postflop training (flop→turn→river) with real-time solver computation. The key insight: postflop solver performance is **tractable for real-time training**, but requires careful pre-computation strategy and state machine orchestration. Modern poker solvers (GTO Wizard, Desktop Postflop) use Discounted CFR algorithms optimized for speed; a two-player postflop solver can solve typical spots in seconds to minutes depending on board complexity and stack depth.

The major architectural challenge isn't solver speed, but **state management across streets**. Multi-street decision flows require explicit state machines (Flop→Turn→River) to handle interruptions (user deviates from solver line), animation sequencing, and EV feedback propagation. The standard pattern is to use event-driven state machines (XState recommended) rather than hand-rolling nested async logic.

For hand strength categorization, the ecosystem uses **Effective Hand Strength (EHS)** algorithm combined with categorical buckets (High Pair/Overpair, Two Pair+, Sets, Straight/Flush Draws, Weak Equity). Board texture filters (Monotone, Paired, Connected, Rainbow) are well-defined in poker literature and straightforward to implement. Multiway postflop (3+ players) is computationally difficult; practical solutions approximate Nash equilibrium via iterative methods or neural network acceleration.

**Primary recommendation:** Use XState v5+ for multi-street state orchestration; offload solver computation to Web Workers with Comlink; implement board texture and hand strength filters using existing poker-evaluator-ts library; support 2-player exact solutions and 3-player approximations; pre-compute common spots in background, fall back to real-time solving for custom boards.

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **XState** | 5.0+ | Multi-street state orchestration (Flop→Turn→River) | Handles complex game flow state machines natively; event-driven; formal state definition; React @xstate/react integration; replaces hand-rolled async logic |
| **Web Workers API + Comlink** | Native + 1.4.0+ | Background solver computation without blocking UI | Comlink simplifies postMessage RPC; 1.1kB library; TypeScript support; Google Chrome Labs maintained |
| **poker-evaluator-ts** | 2.0.3 (existing) | Hand evaluation and ranking | Already in codebase; supports 5-7 card evaluation; fast enough for real-time classification |
| **Motion** | 12.34.0+ (from Phase 9) | Street transition animations | Orchestrates flop reveal, turn card reveal, river card reveal; variant stagger for card sequences |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Discounted CFR (built-in solver)** | Current CFR+ impl | Two-player postflop solving | Existing postflopSolver.ts; 50 iterations × 5 hand samples standard (Phase 1 spec) |
| **Effective Hand Strength calculation** | Built-in (evaluation/equity.ts) | Hand strength bucketing for abstraction | Already in E[HS] implementation; 50 buckets default per Phase 1 spec |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| XState | Custom useReducer + useCallback chains | Custom cascading state updates harder to visualize, test, and maintain; XState provides formal state definitions and visual debugging |
| Web Workers + Comlink | Server-side solver endpoint | Network latency defeats real-time (100-300ms round trip vs 10-50ms Web Worker overhead); Web Workers keep computation local, responsive |
| XState | Redux Saga | Saga pattern more heavyweight (larger bundle); XState more lightweight, designed for explicit state transitions |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/poker/
│   ├── atoms/
│   │   ├── Card.tsx                    # Reuse from Phase 9
│   │   └── CardBack.tsx
│   ├── molecules/
│   │   ├── CommunityCards.tsx          # Reveal cards one at a time
│   │   ├── ActionButton.tsx            # Reuse from Phase 6
│   │   └── ActionPanel.tsx             # Extend with EV display
│   └── organisms/
│       ├── PostflopTable.tsx           # Multi-street orchestrator
│       └── StreetTransition.tsx        # Flop→Turn→River reveal
├── lib/postflop/
│   ├── solver/
│   │   ├── solverWorker.ts             # Web Worker entry point
│   │   ├── solverClient.ts             # Comlink wrapper (main thread)
│   │   └── solverCache.ts              # LRU cache for solver results
│   ├── stateMachine/
│   │   ├── postflopMachine.ts          # XState machine (Flop→Turn→River)
│   │   └── postflopInterpreter.ts      # Actor logic for actions
│   ├── boardTexture.ts                 # Classification logic
│   ├── handStrength.ts                 # Category and filter logic
│   └── multiway.ts                     # 3-player approximation (if needed)
├── workers/
│   └── solver.worker.ts                # Web Worker implementation
└── hooks/
    ├── usePostflopSolver.ts            # Solver client hook
    └── usePostflopMachine.ts           # XState machine hook
```

### Pattern 1: XState Multi-Street State Machine

**What:** XState machine defines discrete states (Flop, Turn, River, ShowDown) with typed events (UserDecision, RevealCard, AutoAdvance, Deviate). Transitions are explicit; guards prevent invalid state changes (e.g., can't advance from Flop to River, must go through Turn).

**When to use:** Main postflop training session flow. Replaces nested async callbacks with declarative state definitions.

**Example:**

```typescript
// Source: https://xstate.js.org/ (official XState documentation)
import { createMachine, assign } from 'xstate';
import type { Spot, Street } from '@/lib/engine/types';

interface PostflopContext {
  streets: Street[];
  currentStreetIndex: number;
  userDecisions: Map<Street, string>; // Street -> ActionId
  solverOutput?: SolverNodeOutput;
  deviation: boolean; // Off solver line flag
  handSummary?: HandSummaryData;
}

export const postflopMachine = createMachine(
  {
    id: 'postflop-training',
    initial: 'flopReveal',
    context: {
      streets: ['FLOP', 'TURN', 'RIVER'],
      currentStreetIndex: 0,
      userDecisions: new Map(),
      deviation: false,
    } as PostflopContext,
    states: {
      flopReveal: {
        description: 'Reveal flop cards one at a time',
        after: {
          3000: 'flopAwaitingDecision', // After 3s delay
        },
      },
      flopAwaitingDecision: {
        description: 'Hero makes decision on flop',
        on: {
          USER_DECIDED: {
            target: 'flopEvaluating',
            actions: assign({
              userDecisions: (context, event) =>
                new Map(context.userDecisions).set('FLOP', event.actionId),
            }),
          },
        },
      },
      flopEvaluating: {
        description: 'Compute solver output, check for deviation',
        type: 'parallel', // Parallel: reveal solver output AND animate villain action
        states: {
          solving: {
            initial: 'computing',
            states: {
              computing: {
                invoke: {
                  src: 'solveFlopNode',
                  onDone: { target: 'done', actions: assign({ solverOutput: (_, event) => event.data }) },
                  onError: { target: 'error' },
                },
              },
              done: { type: 'final' },
              error: { type: 'final' },
            },
          },
          villainAnimation: {
            initial: 'waiting',
            states: {
              waiting: {
                after: {
                  500: 'acting', // Villain acts with 500ms delay
                },
              },
              acting: {
                after: {
                  1000: { target: 'done', actions: 'animateVillainAction' },
                },
              },
              done: { type: 'final' },
            },
          },
        },
        onDone: {
          target: 'turnReveal',
          actions: assign({
            deviation: (context, event) => {
              const solverAction = context.solverOutput?.actions.find(
                a => a.actionId === Array.from(context.userDecisions.values()).pop()
              );
              return !solverAction || solverAction.frequency < 0.01;
            },
          }),
        },
      },
      turnReveal: {
        description: 'Reveal turn card',
        after: {
          2000: 'turnAwaitingDecision',
        },
      },
      turnAwaitingDecision: {
        description: 'Hero makes decision on turn (or N/A if deviated)',
        on: {
          USER_DECIDED: {
            target: 'turnEvaluating',
            actions: assign({
              userDecisions: (context, event) =>
                new Map(context.userDecisions).set('TURN', event.actionId),
            }),
            cond: (context) => !context.deviation,
          },
          AUTO_ADVANCE: {
            target: 'turnEvaluating',
            actions: assign({
              userDecisions: (context) =>
                new Map(context.userDecisions).set('TURN', 'N/A'),
            }),
            cond: (context) => context.deviation,
          },
        },
      },
      turnEvaluating: {
        type: 'parallel',
        states: {
          solving: {
            initial: 'computing',
            states: {
              computing: {
                invoke: {
                  src: 'solveTurnNode',
                  onDone: { target: 'done', actions: assign({ solverOutput: (_, event) => event.data }) },
                  onError: { target: 'error' },
                },
              },
              done: { type: 'final' },
              error: { type: 'final' },
            },
          },
          villainAnimation: {
            initial: 'waiting',
            states: {
              waiting: {
                after: { 500: 'acting' },
              },
              acting: {
                after: { 1000: { target: 'done', actions: 'animateVillainAction' } },
              },
              done: { type: 'final' },
            },
          },
        },
        onDone: 'riverReveal',
      },
      riverReveal: {
        description: 'Reveal river card',
        after: { 2000: 'riverAwaitingDecision' },
      },
      riverAwaitingDecision: {
        description: 'Hero final decision or showdown',
        on: {
          USER_DECIDED: {
            target: 'riverEvaluating',
            actions: assign({
              userDecisions: (context, event) =>
                new Map(context.userDecisions).set('RIVER', event.actionId),
            }),
            cond: (context) => !context.deviation,
          },
          AUTO_ADVANCE: {
            target: 'riverEvaluating',
            actions: assign({
              userDecisions: (context) =>
                new Map(context.userDecisions).set('RIVER', 'N/A'),
            }),
            cond: (context) => context.deviation,
          },
        },
      },
      riverEvaluating: {
        invoke: {
          src: 'solveRiverNode',
          onDone: { target: 'handSummary', actions: assign({ solverOutput: (_, event) => event.data }) },
          onError: 'handSummary',
        },
      },
      handSummary: {
        description: 'Show summary with replay option, then auto-advance',
        on: {
          REPLAY_REQUESTED: 'flopReveal',
          AUTO_ADVANCE_SUMMARY: {
            target: 'complete',
            actions: 'recordHandAndAdvance',
          },
        },
        after: { 5000: 'complete' }, // Auto-advance if user idle
      },
      complete: {
        type: 'final',
      },
    },
  },
  {
    actions: {
      animateVillainAction: () => console.log('Villain acts with animation'),
      recordHandAndAdvance: () => console.log('Advance to next hand'),
    },
    services: {
      solveFlopNode: (context) =>
        // Invoke solver via Web Worker
        window.solverClient.solve({ streets: context.streets.slice(0, 1) }),
      solveTurnNode: (context) =>
        window.solverClient.solve({ streets: context.streets.slice(0, 2) }),
      solveRiverNode: (context) =>
        window.solverClient.solve({ streets: context.streets }),
    },
  }
);
```

### Pattern 2: Web Worker Solver with Comlink

**What:** Postflop solver computation runs in a background Web Worker thread. Main thread communicates via Comlink's RPC wrapper, making the worker appear as a local async function.

**When to use:** Any solver computation that might block UI (CFR+ iterations, board texture pre-computation, hand strength bucketing).

**Example:**

```typescript
// Source: https://github.com/GoogleChromeLabs/comlink (official Comlink docs)

// worker thread: src/workers/solver.worker.ts
import { expose } from 'comlink';
import { solvePostflop } from '@/lib/solver/postflopSolver';
import type { PostflopConfig } from '@/lib/solver/postflopSolver';

const solverExports = {
  async solveNode(config: PostflopConfig) {
    // This runs in background thread, not blocking UI
    const solution = await solvePostflop(config);
    return {
      actions: solution.strategies.map(s => ({
        actionId: s.actionId,
        frequency: s.frequency,
        ev: s.ev,
      })),
      status: 'ok',
    };
  },
};

expose(solverExports);

// main thread: src/lib/postflop/solver/solverClient.ts
import { wrap } from 'comlink';
import type { Remote } from 'comlink';

type SolverWorkerType = typeof import('@/workers/solver.worker').solverExports;

let workerInstance: Worker | null = null;
let solverRemote: Remote<SolverWorkerType> | null = null;

export async function initializeSolverWorker(): Promise<Remote<SolverWorkerType>> {
  if (solverRemote) return solverRemote;

  workerInstance = new Worker(
    new URL('@/workers/solver.worker.ts', import.meta.url),
    { type: 'module' }
  );

  solverRemote = wrap<SolverWorkerType>(workerInstance);
  return solverRemote;
}

export async function solveFlopNode(config: PostflopConfig) {
  const solver = await initializeSolverWorker();
  return solver.solveNode(config);
}

// Usage in component:
const solverOutput = await solveFlopNode({
  street: 'FLOP',
  board: ['As', 'Ks', 'Qd'],
  heroRange: allHeroHands,
  villainRange: allVillainHands,
  // ... rest of config
});
```

### Pattern 3: Board Texture Classification

**What:** Classify flop/board into discrete texture categories (Monotone, Paired, Connected, etc.). Used for spot filtering and strategy selection hints.

**When to use:** Spot selection filters, pre-compute batch prioritization, strategy display context.

**Example:**

```typescript
// Source: Poker theory (888poker, GTO Wizard) + existing codebase patterns
import type { Card } from '@/lib/engine/types';

export type BoardTexture =
  | 'MONOTONE'      // AAA, AK, AQ same suit (3 cards same suit)
  | 'TWO_TONE'      // AA same suit, unrelated third (2 cards same suit)
  | 'RAINBOW'       // All different suits
  | 'PAIRED'        // Two cards same rank (17% of flops)
  | 'CONNECTED'     // Cards within 4 ranks, possible straights
  | 'DRY'           // Minimal draws, disconnected (weak equity spread)
  | 'WET';          // Many draws, lots of equity chop

function classifyBoardTexture(board: Card[]): BoardTexture {
  if (board.length < 3) throw new Error('Board must have 3+ cards');

  const ranks = board.map(c => parseRank(c));
  const suits = board.map(c => parseSuit(c));

  // Check monotone (all 3 same suit)
  if (suits.every(s => s === suits[0])) return 'MONOTONE';

  // Count suit frequency
  const suitCounts = new Map<string, number>();
  suits.forEach(s => suitCounts.set(s, (suitCounts.get(s) || 0) + 1));
  const maxSuitCount = Math.max(...Array.from(suitCounts.values()));

  // Check two-tone (2 cards same suit)
  if (maxSuitCount === 2) {
    // If paired + two-tone → prioritize paired classification
    const rankCounts = new Map<number, number>();
    ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));
    if (Math.max(...Array.from(rankCounts.values())) === 2) return 'PAIRED';
    return 'TWO_TONE';
  }

  // Check paired (two cards same rank)
  const rankCounts = new Map<number, number>();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));
  if (Math.max(...Array.from(rankCounts.values())) === 2) return 'PAIRED';

  // Check connected (gaps ≤ 3 in rank, possible straights)
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  const maxGap = Math.max(
    sortedRanks[1] - sortedRanks[0],
    sortedRanks[2] - sortedRanks[1]
  );
  if (maxGap <= 3) return 'CONNECTED';

  // Default to rainbow if none above
  return 'RAINBOW';
}

// Texture-based play hints (optional UI display)
export function textureDifficulty(texture: BoardTexture): 'easy' | 'medium' | 'hard' {
  switch (texture) {
    case 'MONOTONE': return 'hard';   // High flush equity, tricky ranges
    case 'PAIRED': return 'medium';   // Set values play, trips strong
    case 'CONNECTED': return 'hard';  // Many straights, wide equity spread
    case 'DRY': return 'easy';        // Clear value, weak drawdowns
    case 'WET': return 'hard';        // Equity swings, draw interplay
    case 'TWO_TONE': return 'medium';
    case 'RAINBOW': return 'easy';
  }
}
```

### Pattern 4: Hand Strength Categorization for Filters

**What:** Categorize hero hands into buckets (High Pair, Overpair, Two Pair, Sets, Straight/Flush Draws, Air) for filtering practice hands.

**When to use:** Optional user filter "Practice only two-pair hands" or "Only drawing hands".

**Example:**

```typescript
// Source: poker-evaluator-ts + Effective Hand Strength algorithm
import { evaluateHand } from '@/lib/solver/evaluation/handRanking';
import type { Hand, Card } from '@/lib/engine/types';

export type HandStrengthCategory =
  | 'OVERPAIR'        // Pocket pair higher than board
  | 'TOP_PAIR'        // Pair with highest board card
  | 'SECOND_PAIR'     // Pair with second-highest board card
  | 'THIRD_PAIR'      // Pair with lowest board card
  | 'TWO_PAIR'        // Two distinct pairs
  | 'THREE_OF_A_KIND' // Set or trips
  | 'STRAIGHT'        // Made straight (not flush draw)
  | 'FLUSH'           // Made flush
  | 'STRAIGHT_FLUSH'  // Straight flush
  | 'OPEN_DRAW'       // 8+ out straight/flush draw
  | 'GUTSHOT_FLUSH'   // Gutshot + flush draw
  | 'PAIR_DRAW'       // Pair + draw
  | 'AIR';            // Weak hand, <20% equity

export function categorizeHandStrength(
  heroHand: Hand,
  board: Card[]
): HandStrengthCategory {
  const allCards = [...heroHand.cards, ...board];
  const heroRank = evaluateHand(allCards);

  // If made hand category, classify made hand
  if (['TWO_PAIR', 'THREE_OF_A_KIND', 'STRAIGHT', 'FLUSH', 'FULL_HOUSE', 'FOUR_OF_A_KIND', 'STRAIGHT_FLUSH', 'ROYAL_FLUSH'].includes(heroRank.category)) {
    if (heroRank.category === 'TWO_PAIR') return 'TWO_PAIR';
    if (heroRank.category === 'THREE_OF_A_KIND') return 'THREE_OF_A_KIND';
    if (heroRank.category === 'STRAIGHT') return 'STRAIGHT';
    if (heroRank.category === 'FLUSH') return 'FLUSH';
    if (heroRank.category === 'STRAIGHT_FLUSH') return 'STRAIGHT_FLUSH';
    return 'AIR'; // Fallback (shouldn't reach)
  }

  // Single pair cases
  if (heroRank.category === 'PAIR') {
    const pairRank = extractPairRank(heroRank.description);
    const boardRanks = board.map(c => parseRank(c)).sort((a, b) => b - a);

    if (pairRank > boardRanks[0]) return 'OVERPAIR';
    if (pairRank === boardRanks[0]) return 'TOP_PAIR';
    if (pairRank === boardRanks[1]) return 'SECOND_PAIR';
    if (pairRank === boardRanks[2]) return 'THIRD_PAIR';
  }

  // Draw hands (estimate by remaining outs)
  const straightOuts = countStraightOuts(heroHand, board);
  const flushOuts = countFlushOuts(heroHand, board);
  const totalOuts = straightOuts + flushOuts;

  if (totalOuts >= 8) {
    if (heroRank.category === 'PAIR') return 'PAIR_DRAW';
    return 'OPEN_DRAW';
  }

  if (straightOuts >= 4 && flushOuts >= 4) return 'GUTSHOT_FLUSH';
  if (straightOuts >= 4 && flushOuts === 0) return 'OPEN_DRAW'; // Gutshot only
  if (flushOuts >= 4) return 'OPEN_DRAW'; // Flush draw

  return 'AIR'; // Less than 4 outs
}

function countStraightOuts(hand: Hand, board: Card[]): number {
  // Simplified: count cards that complete Broadway straights, wheels, etc.
  // In practice, use poker evaluator to check every card
  // This is a simplified heuristic
  const allRanks = [
    ...hand.cards.map(c => parseRank(c)),
    ...board.map(c => parseRank(c))
  ];

  let straightOuts = 0;
  for (let r = 2; r <= 14; r++) {
    if (allRanks.includes(r)) continue; // Card already dealt
    // Count as out if it completes a 5-card straight
    const testHand = [...hand.cards, ...board, createCard(r, 'h')]; // Dummy suit
    if (evaluateHand(testHand).category === 'STRAIGHT') straightOuts++;
  }
  return straightOuts;
}

function countFlushOuts(hand: Hand, board: Card[]): number {
  const handSuits = hand.cards.map(c => parseSuit(c));
  const boardSuits = board.map(c => parseSuit(c));
  const allSuits = [...handSuits, ...boardSuits];

  const suitCounts = new Map<string, number>();
  allSuits.forEach(s => suitCounts.set(s, (suitCounts.get(s) || 0) + 1));

  for (const [suit, count] of suitCounts.entries()) {
    if (count >= 4) {
      // This suit has 4+ cards, remaining cards of this suit are outs
      // 13 total cards per suit - 4 dealt = 9 outs
      return Math.min(9, 13 - count);
    }
  }
  return 0;
}
```

### Anti-Patterns to Avoid

- **Blocking UI with solver computation:** Don't call `solvePostflop()` directly on main thread. Always use Web Worker via Comlink.
- **Hand-rolling multi-street state logic:** Don't cascade `async/await` for Flop→Turn→River. Use XState machine for declarative state definitions.
- **Caching solver results without board/stack context:** Don't store just "results for board AKQ". Cache by {board, stacks, ranges, iterations} to ensure correctness.
- **Not handling "Off Solver Line" gracefully:** If user deviates, don't show EV values for later streets. Show "N/A" and mark deviation clearly.
- **Precomputing all possible boards upfront:** Don't pre-solve every board in existence. Instead, pre-compute top 100 most common boards + solve real-time for custom boards.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Managing multi-street game flow state (Flop→Turn→River with interruptions) | Custom useState + useCallback chains cascading into nested promises | XState machine with explicit state definitions and guards | State cascades become unmaintainable; XState provides visual debugging, formal definitions, easy to test |
| Computing solver strategies in real-time without blocking UI | Direct solver calls on main thread | Web Worker + Comlink | Main thread blocking causes animation jank, unresponsive buttons; Web Workers are designed for offloading CPU tasks |
| Caching solver results across multiple boards | Manual Map<string, SolverOutput> | LRU cache (npm: lru-cache) or memoization library | Manual caching misses invalidation logic; LRU caches evict least-used entries automatically |
| Classifying board texture (Monotone, Paired, Connected) | Custom rank/suit parsing | Poker theory + built-in card utilities | Texture classification is well-defined in poker literature; hand-rolled logic is error-prone and unmaintainable |
| Categorizing hand strength (Top Pair, Overpair, Draw) | Manual pair/draw detection | poker-evaluator-ts (existing) + combinatorial outs counting | Hand strength has edge cases (gutshot + flush draw vs open draw); existing library handles poker standard |
| Propagating EV across streets when user deviates | Custom EV recalculation per street | Show "N/A" + "Off Solver Line" indicator + full solver output in hand summary | Trying to compute counterfactual EV off-line is complex; simpler to flag deviation and show full solver analysis post-hand |

**Key insight:** Postflop training looks like it needs custom logic (multi-street handling, solver caching, board texture), but each problem has domain-specific solutions. XState and Web Workers are battle-tested patterns in game development. Reusing existing poker evaluation libraries reduces bugs.

## Common Pitfalls

### Pitfall 1: Solver Computation Blocks UI During Real-Time Play

**What goes wrong:** User clicks "Bet 75%" on flop → solver starts computing turn response → main thread is busy → buttons unresponsive for 1-3 seconds → feels broken, animations stutter.

**Why it happens:** CFR+ solver runs complex iterations (regret matching, strategy averaging) that take 100-500ms per iteration. If on main thread, React can't re-render or handle input.

**How to avoid:**
- **Always** run solver computation in Web Worker via Comlink
- Pre-compute common boards (top 100 most played flops) in background before user starts training
- For real-time boards, show loading state while solver computes (spinning indicator, "Computing solver line...")
- Set timeout: if solver takes >2 seconds, show "Solver timeout, showing approximation" + heuristic play

**Warning signs:**
- Buttons feel sluggish during training
- Animations drop frames when solver computes
- Console shows "Long tasks" (tasks exceeding 50ms)

### Pitfall 2: EV Values Propagate Incorrectly Across Multi-Street Decisions

**What goes wrong:** User deviates on flop (checks instead of bet) → Turn EV shows huge value → user confused ("I'm supposed to have +5 EV here but I deviated?").

**Why it happens:** EV is **contingent on action history**. If user deviated, the turn node is a different game state than solver expected. You can't just pull EV from a different street's solution.

**How to avoid:**
- **Never** show EV values after user deviates. Show "N/A" with "Off solver line" indicator
- In hand summary, show **all three streets' full solver output** so user can understand what went wrong
- Include counterfactual: "If you had bet flop, EV would be +2.3 BB. After checking, villain is in EV zone X."
- Track deviation at the street it occurred; subsequent streets are "what-if" territory

**Warning signs:**
- User sees EV values for streets after deviating
- EV numbers don't make sense (positive even though decision was terrible)
- No explanation for why EV is unavailable

### Pitfall 3: Multiway Solver Approximation Has Large Exploitability

**What goes wrong:** User trains on 3-player spots using approximation → strategy has 0.5-1% exploitability gap → user learns suboptimal plays → bad real-game decisions.

**Why it happens:** 3-player GTO is computationally much harder (exponent changes from 6 to 9). Exact solutions are infeasible; approximations (neural networks, iterative methods) have inherent error.

**How to avoid:**
- **For heads-up (2-player), use exact CFR+ solutions** — this is the standard and fast enough
- **For multiway (3+ players), clearly label as "Approximation"** not "GTO Solution"
- Use GTO Wizard's published 3-player benchmarks; their error is ~0.2-0.3% for river, 0.5-0.7% for earlier streets
- Consider: limit training to 2-player scenarios unless multiway is explicitly requested
- Pre-compute 3-player spots with extended iteration count (200+ iterations) to reduce error

**Warning signs:**
- 3-player spots feel "off" compared to actual GTO
- Strategy isn't converging with more iterations (indicates algorithmic approximation, not just convergence issue)
- Benchmark tests show >0.5% gap between solver's play and known-good strategies

### Pitfall 4: Board Texture Filter Mislassifies Boards

**What goes wrong:** "Monotone" filter is supposed to return 3-card-flushes only, but returns paired boards too → user trains on irrelevant spots.

**Why it happens:** Overlapping logic: a board can be both Paired AND Two-tone. If else-if chain is wrong order, paired gets caught before two-tone.

**How to avoid:**
- **Define texture as priority hierarchy:**
  1. If 3 cards same rank → ERROR (not a flop, illegal)
  2. If 2 cards same rank → PAIRED (regardless of suits)
  3. If 3 cards same suit → MONOTONE
  4. If 2 cards same suit → TWO_TONE
  5. If all different suits, check connectivity → CONNECTED or RAINBOW
- **Test edge cases:**
  - AsKs Qs → Should be MONOTONE (not TWO_TONE)
  - As Ah Kd → Should be PAIRED (not TWO_TONE)
  - As Ad 2h → Should be PAIRED (not TWO_TONE)
- Add unit tests for each texture with 5+ examples

**Warning signs:**
- Users report "Wrong boards in my texture filter"
- Texture distribution looks unbalanced (too many packed into one category)
- Filter tests failing edge cases

### Pitfall 5: Off-Solver-Line Indicator Not Clear to User

**What goes wrong:** User deviates on flop, sees "N/A" for EV → assumes something is broken → confusion about what "off line" means.

**Why it happens:** UI doesn't explain clearly: "You deviated from solver. Later streets show N/A because we can't compute EV in a state the solver didn't expect."

**How to avoid:**
- **Display banner:** "Off solver line" with icon and tooltip explaining why EV is unavailable
- **In hand summary, show:**
  - "You checked flop. Solver recommended Bet 75%."
  - "Because you deviated, turn/river EVs are not calculated. See hand summary for what-if analysis."
- **Replay feature:** Let user step through and see "What GTO would do at each step"
- Provide learning context: "This is a learning opportunity. Review the hand summary to understand the error."

**Warning signs:**
- User reports confusion about "N/A" values
- Users don't understand what "off line" means
- Hand summaries don't explain deviations clearly

### Pitfall 6: Precomputation Batch Blocks App Startup

**What goes wrong:** App loads → starts precomputing 100 common boards in Web Worker → main thread still busy initializing solver worker → splash screen for 5+ seconds → user thinks app is frozen.

**Why it happens:** Web Worker initialization + solver precomputation both expensive. If sequenced wrong, init blocks precompute.

**How to avoid:**
- **Separate concerns:**
  - Initialize solver worker on app load (lazy-load first board only)
  - Start precomputation as **background task** with low priority (requestIdleCallback)
  - Don't block app launch on precomputation
- **Show progress:** If precomputation visible, show "Caching common boards... 23/100"
- **Graceful degradation:** If board not cached, fall back to real-time solve with 1-2s delay visible to user
- Use browser's `requestIdleCallback()` to avoid competing with rendering

**Warning signs:**
- Splash screen stays longer than 1s without explanation
- App feels sluggish during initial training hands
- Precomputation restarts frequently

## Code Examples

Verified patterns from official sources:

### XState Machine Setup with React Hook

```typescript
// Source: https://xstate.js.org/ + @xstate/react documentation
import { useMachine } from '@xstate/react';
import { postflopMachine } from '@/lib/postflop/stateMachine/postflopMachine';

export function usePostflopTraining(initialHand: Spot) {
  const [state, send, actor] = useMachine(postflopMachine, {
    input: {
      streets: ['FLOP', 'TURN', 'RIVER'],
      currentStreetIndex: 0,
      userDecisions: new Map(),
      deviation: false,
    },
  });

  return {
    state: state.value,
    context: state.context,
    sendUserDecision: (actionId: ActionId) => send({ type: 'USER_DECIDED', actionId }),
    sendAutoAdvance: () => send({ type: 'AUTO_ADVANCE' }),
    sendReplay: () => send({ type: 'REPLAY_REQUESTED' }),
    canMakeDecision: state.can({ type: 'USER_DECIDED' }),
  };
}
```

### Initializing Solver Worker with Error Handling

```typescript
// Source: https://github.com/GoogleChromeLabs/comlink (official Comlink docs)
import { wrap } from 'comlink';

let solverInstance: Worker | null = null;
let solverProxy: any = null;

export async function initSolverWorker() {
  if (solverProxy) return solverProxy;

  try {
    solverInstance = new Worker(
      new URL('@/workers/solver.worker.ts', import.meta.url),
      { type: 'module' }
    );

    solverProxy = wrap(solverInstance);

    // Precompute common boards in background
    precomputeCommonBoards(solverProxy).catch(err =>
      console.warn('Precomputation failed (non-blocking):', err)
    );

    return solverProxy;
  } catch (error) {
    console.error('Failed to initialize solver worker:', error);
    throw new Error('Solver initialization failed. Web Workers may be blocked.');
  }
}

async function precomputeCommonBoards(solver: any) {
  // Use requestIdleCallback to avoid blocking main thread
  if (!('requestIdleCallback' in window)) {
    // Fallback to setTimeout if requestIdleCallback unavailable
    await new Promise(r => setTimeout(r, 100));
  }

  const commonBoards = [
    { board: ['As', 'Ks', 'Qs'], label: 'AKQ monotone' },
    { board: ['As', 'Ad', '9h'], label: 'Pair Aces' },
    // ... 98 more
  ];

  for (const { board, label } of commonBoards) {
    try {
      await solver.solveNode({
        street: 'FLOP',
        board,
        heroRange: defaultHeroRange,
        villainRange: defaultVillainRange,
        potBb: 30,
        stackBb: 200,
        heroPosition: 'IP',
        actionAbstraction: DEFAULT_ACTION_ABSTRACTION,
      });
      console.log(`Cached: ${label}`);
    } catch (err) {
      console.warn(`Failed to cache ${label}`, err);
      // Don't throw; precomputation is optional
    }
  }
}
```

### Hand Strength Filter UI Component

```typescript
// Source: Existing codebase patterns + phase requirements
import { useState } from 'react';
import { categorizeHandStrength } from '@/lib/postflop/handStrength';
import type { HandStrengthCategory } from '@/lib/postflop/handStrength';

export function HandStrengthFilter() {
  const categories: HandStrengthCategory[] = [
    'OVERPAIR',
    'TOP_PAIR',
    'TWO_PAIR',
    'THREE_OF_A_KIND',
    'STRAIGHT',
    'FLUSH',
    'OPEN_DRAW',
    'AIR',
  ];

  const [selected, setSelected] = useState<Set<HandStrengthCategory>>(new Set());

  const toggleCategory = (cat: HandStrengthCategory) => {
    const updated = new Set(selected);
    if (updated.has(cat)) {
      updated.delete(cat);
    } else {
      updated.add(cat);
    }
    setSelected(updated);
  };

  return (
    <div className="hand-strength-filter">
      <label>Hand Strength (optional):</label>
      <div className="categories">
        {categories.map(cat => (
          <label key={cat}>
            <input
              type="checkbox"
              checked={selected.has(cat)}
              onChange={() => toggleCategory(cat)}
            />
            {cat.replace(/_/g, ' ')}
          </label>
        ))}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom nested async callbacks for multi-street | XState machines with explicit state definitions | 2020s formalization of state machines for games | Replaces callback hell with declarative, testable state graphs |
| Solver computation on main thread | Web Workers + Comlink for offloading | Browser performance concerns (2015+) | Keeps UI responsive; standard pattern for CPU-intensive tasks |
| Manual board texture detection | Poker theory definitions (Monotone, Paired, Connected) | Formalized in GTO Wizard, Simple Poker docs | Clear, testable categories instead of guesswork |
| Showing EV for off-line streets | Hide EV, show "N/A" + "Off solver line" indicator | GTO Wizard training software practice | Prevents confusion; educates users on off-line deviations |
| CFR+ only, 2-player | CFR+ with Discounted CFR variants; Neural network acceleration for 3+ player approximation | Recent poker solver improvements (2020s) | Faster convergence; practical multiway solutions |

**Deprecated/outdated:**
- **Single-threaded solver computation:** Main-thread solvers are unacceptable in modern training apps. Web Workers are standard now.
- **Fixed board sets:** Pre-solved spot databases are inflexible. Random boards + real-time solving is more valuable for learning.
- **EV values only (no frequencies):** Modern training shows action frequencies to teach betting psychology, not just "which action is best."

## Open Questions

1. **Pre-compute batch size and strategy**
   - What we know: Top 100 boards should pre-compute without blocking startup
   - What's unclear: Should we pre-compute all 3-card combos (22,100 boards)? Multiway? 4-card+ boards?
   - Recommendation: Start with top 100 boards (AKQ, AA low cards, etc.). If users request more, expand to 1000 common boards. Multiway pre-compute optional (high iteration count = slow).

2. **Three-player solver approximation accuracy vs. compute time tradeoff**
   - What we know: GTO Wizard achieves ~0.2-0.3% error; takes 1-5 minutes per spot
   - What's unclear: Should Phase 10 include 3-player? If so, accept 0.5-1% error or spend more iterations?
   - Recommendation: Phase 10 locks to 2-player for accuracy. Future phase can add 3-player with neural network acceleration if desired.

3. **Exact hand strength categorization definitions**
   - What we know: Standard categories are Overpair, Top Pair, Two Pair, Sets, Draws, Air
   - What's unclear: Where does "pair + flush draw" fit? "Gutshot only"?
   - Recommendation: Define as listed in handStrength.ts example above. Test with 100 hand examples to validate categorization.

4. **Board texture filter UI presentation**
   - What we know: Texture filters exist (Monotone, Paired, Connected, etc.)
   - What's unclear: Should filters be OR or AND? Can user select "Monotone AND Paired"?
   - Recommendation: OR logic (boards matching ANY selected texture). Single-texture spotting is the use case (e.g., "I want to practice monotone boards").

5. **Animation timing for multi-street reveals**
   - What we know: Phase 9 specifies ~150ms per card, ~300ms for EV reveal
   - What's unclear: Auto-advance delay after hand complete? Villain action delay?
   - Recommendation: 500ms before villain acts, 1s for villain action, 3s before turn card, 2s before river card (adjustable in settings).

## Sources

### Primary (HIGH confidence)

- **XState Official Documentation** — State machines for application logic
  - [https://xstate.js.org/](https://xstate.js.org/)
  - [https://stately.ai/docs/xstate](https://stately.ai/docs/xstate)
  - [https://stately.ai/docs/xstate-react](https://stately.ai/docs/xstate-react)

- **Comlink Official Repository** — Web Worker RPC simplification
  - [https://github.com/GoogleChromeLabs/comlink](https://github.com/GoogleChromeLabs/comlink)
  - [https://www.npmjs.com/package/comlink](https://www.npmjs.com/package/comlink)

- **Web Workers API** — Official MDN documentation
  - [https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

- **GTO Wizard Multiway Solving** — Practical poker solver implementation
  - [https://blog.gtowizard.com/gto-wizard-ai-custom-multiway-solving/](https://blog.gtowizard.com/gto-wizard-ai-custom-multiway-solving/)
  - [https://blog.gtowizard.com/introducing-multiway-preflop-solving/](https://blog.gtowizard.com/introducing-multiway-preflop-solving/)

- **Poker Board Texture Definitions** — GTO Wizard & 888poker
  - [https://pages.gtowizard.com/en/glossary/board-texture/](https://pages.gtowizard.com/en/glossary/board-texture/)
  - [https://www.888poker.com/magazine/poker-board-textures](https://www.888poker.com/magazine/poker-board-textures)

### Secondary (MEDIUM confidence)

- **Postflop Solver Performance** — Open-source implementations
  - [https://github.com/b-inary/postflop-solver](https://github.com/b-inary/postflop-solver)
  - [https://github.com/JoakimMich/opensolver](https://github.com/JoakimMich/opensolver)

- **Web Workers in Next.js** — Community patterns (verified against official docs)
  - [https://park.is/blog_posts/20250417_nextjs_comlink_examples/](https://park.is/blog_posts/20250417_nextjs_comlink_examples/)
  - [https://blog.logrocket.com/integrating-web-workers-in-a-react-app-with-comlink/](https://blog.logrocket.com/integrating-web-workers-in-a-react-app-with-comlink/)

- **Hand Strength Categorization** — Wikipedia & poker training sites
  - [https://en.wikipedia.org/wiki/Effective_hand_strength_algorithm](https://en.wikipedia.org/wiki/Effective_hand_strength_algorithm)
  - [https://www.pokerstrategy.com/poker-hand-charts-evaluations/](https://www.pokerstrategy.com/poker-hand-charts-evaluations/)

- **Game State Machines** — Game programming patterns
  - [https://gameprogrammingpatterns.com/state.html](https://gameprogrammingpatterns.com/state.html)

### Tertiary (MEDIUM-LOW confidence, verified with multiple sources)

- **Multiway Solver Mathematics** — Research papers
  - [https://arxiv.org/abs/2509.25618](https://arxiv.org/abs/2509.25618) (Quadratic Programming for Nash equilibrium)
  - [https://www.irif.fr/~santha/Papers/hrs08.pdf](https://www.irif.fr/~santha/Papers/hrs08.pdf) (Approximate Nash Equilibria for Multiplayer Games)

- **Caching and Precomputation** — Software architecture patterns
  - [https://gameprogrammingpatterns.com/data-locality.html](https://gameprogrammingpatterns.com/data-locality.html)

## Metadata

**Confidence breakdown:**
- **Standard Stack (XState, Web Workers, Comlink):** HIGH — Official docs + existing codebase CFR+ solver confirm feasibility. These libraries are standard in their domains.
- **Architecture Patterns (State Machines, Board Texture, Hand Strength):** HIGH — Patterns sourced from official XState docs, established poker theory (GTO Wizard), and verified against existing codebase.
- **Pitfalls (UI blocking, EV propagation, multiway approximation):** MEDIUM-HIGH — Sourced from poker training domain knowledge, game development best practices, and research papers. Some guidance from community (WebSearch verified with official sources).
- **Multiway Solver Approximation:** MEDIUM — Computational limits confirmed via GTO Wizard benchmarks and research. Error bounds from published sources (0.2-0.7%), but exact Phase 10 approach deferred to planner discretion.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (XState and Comlink are stable; recheck poker solver benchmarks after 30 days if multiway support added)

**Key caveats:**
- Existing codebase has working CFR+ solver (Phase 1); Phase 10 assumes this is correct and focuses on orchestration
- Multiway approximation deferred to planner; 2-player exact solution is standard
- Board texture and hand strength categorization deferred to specific definitions in planning phase
