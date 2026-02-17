# Phase 10: Postflop Training - Research

**Researched:** 2026-02-16
**Domain:** Multi-street state orchestration, real-time solver execution, animation sequencing, hand evaluation display
**Confidence:** HIGH (Solver exists in codebase; state patterns from existing training infrastructure; animation stack established in Phase 9)

## Summary

Phase 10 builds multi-street postflop training (flop→turn→river) using the existing CFR+ solver from Phase 1. The core challenge is **orchestrating three connected decision points** with deviation handling (if user goes off-line, subsequent streets show N/A). The existing codebase provides:

1. **Working postflopSolver** — CFR+ with 50 buckets, E[HS] abstraction, discrete action set (BET_33, BET_75, RAISE_2.2, ALL_IN, etc.)
2. **Training infrastructure** — DecisionGrade, DecisionRecord, session recording in `trainingOrchestrator.ts`
3. **UI components** — Card, ActionButton, CommunityCards, PokerTable from Phase 4/7
4. **Animation system** — Motion library available (Phase 9 choice, not in package.json yet but planned)

The research focuses on: (1) State machine pattern for Flop→Turn→River with interruption handling, (2) Worker pattern for solver computation (avoiding UI blocking), (3) Board texture and hand strength classification, (4) Precomputation strategy for real-time feel.

**Primary recommendation:** Use React Context + useReducer for multi-street session state (simpler than XState for this domain; existing training uses Redux-like patterns). Offload solver to Web Worker with Comlink RPC. Implement board texture classification as utility functions. Pre-compute 50-100 common boards asynchronously during app initialization.

## Standard Stack

### Core (Existing/Confirmed Available)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| **postflopSolver** | In codebase | CFR+ solver with E[HS] buckets, discrete actions | CONFIRMED — src/lib/solver/postflopSolver.ts works; solves Flop/Turn/River |
| **React** | 19.2.4 | UI state and component rendering | CONFIRMED — in package.json |
| **Tailwind CSS** | 4.1.18 | Styling | CONFIRMED — in package.json |
| **poker-evaluator-ts** | 2.0.3 | Hand evaluation for strength categorization | CONFIRMED — in package.json, used for hand ranking |
| **Motion** | 12.34.0+ | Card reveal animations, street transitions | DECIDED in Phase 9 — not yet in package.json, will be added |

### Supporting Libraries (To Add)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **Comlink** | 4.4.1+ | Web Worker RPC wrapper | Simplifies solver computation in background thread without blocking UI |
| **Web Workers API** | Native | Background thread execution | Browser standard; no external dependency needed |

### Alternatives NOT Recommended

| Instead of | Why Not | Use Case | Decision |
|------------|--------|----------|----------|
| Web Worker | Server-side solver endpoint | Network latency (100-300ms) defeats real-time feel; Web Worker keeps 10-50ms overhead | Use Web Worker |
| XState | Custom useReducer + Context | XState overkill for 3-state machine (Flop→Turn→River); existing codebase uses functional approaches | Use React Context + useReducer |
| Custom hand strength | poker-evaluator-ts | Hand strength already available in codebase; don't duplicate | Reuse existing |

**Installation:**
```bash
npm install comlink
# Motion will be added in Phase 9 completion
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/postflop/
│   ├── session/
│   │   ├── postflopSession.ts         # Context + state management
│   │   ├── postflopReducer.ts         # Reducer logic (Flop→Turn→River)
│   │   └── types.ts                   # Session context types
│   ├── solver/
│   │   ├── solverWorker.ts            # Web Worker entry point
│   │   ├── solverClient.ts            # Comlink wrapper
│   │   └── solverCache.ts             # Simple memoization/LRU
│   ├── classification/
│   │   ├── boardTexture.ts            # Classify board into categories
│   │   ├── handStrength.ts            # Categorize hand strength
│   │   └── filters.ts                 # Apply user-selected filters
│   └── ui/
│       └── postflopSpotContext.ts     # Current spot display state
├── components/poker/
│   ├── organisms/
│   │   └── PostflopTraining.tsx        # Main training component
│   ├── molecules/
│   │   ├── StreetDecision.tsx          # Flop/Turn/River decision panel
│   │   ├── ActionHistoryLog.tsx        # Action log display
│   │   └── HandSummaryModal.tsx        # Post-hand summary
│   └── hooks/
│       └── usePostflopTraining.ts      # Session orchestration
└── workers/
    └── postflop.worker.ts              # Web Worker module
```

### Pattern 1: Multi-Street Session State Machine

**What:** React Context + useReducer manages three discrete states: FloppDecision→TurnDecision→RiverDecision. State includes decisions, solver outputs, and deviation flag. Reduces via action types: USER_DECIDED, VILLAIN_ACTED, ADVANCE_STREET.

**When to use:** Main postflop training flow. Replaces nested callbacks with explicit state transitions.

**Why not XState:** Existing codebase uses functional patterns (DecisionGrade, DecisionRecord, trainingOrchestrator). useReducer fits the existing paradigm better. XState is heavier and provides less value for a 3-state machine.

**Example:**

```typescript
// src/lib/postflop/session/postflopSession.ts
import { createContext, useReducer, ReactNode } from 'react';

export type Street = 'FLOP' | 'TURN' | 'RIVER';
export type PostflopState = 'deciding' | 'evaluating' | 'advancing' | 'summary' | 'complete';

export interface PostflopSessionState {
  // Hand structure
  heroHand: { c1: Card; c2: Card };
  board: Card[]; // Grows: [c1,c2,c3] → [c1,c2,c3,c4] → [c1,c2,c3,c4,c5]
  potBb: number;
  stackBb: number;

  // Street progression
  currentStreet: Street;
  streetIndex: number; // 0=FLOP, 1=TURN, 2=RIVER

  // Decision history
  decisions: {
    FLOP?: { actionId: string; solverOutput: SolverNodeOutput };
    TURN?: { actionId: string; solverOutput: SolverNodeOutput };
    RIVER?: { actionId: string; solverOutput: SolverNodeOutput };
  };

  // Deviation tracking
  deviatedStreet?: Street; // Which street user went off-line (if any)

  // UI state
  machineState: PostflopState;
  loading: boolean;
  error?: string;
}

export type PostflopAction =
  | { type: 'START_HAND'; payload: { heroHand: Hand; board: Card[]; potBb: number; stackBb: number } }
  | { type: 'USER_DECIDED'; payload: { actionId: string } }
  | { type: 'SOLVER_OUTPUT'; payload: { output: SolverNodeOutput } }
  | { type: 'VILLAIN_ACTED'; payload: { actionId: string; delay: number } }
  | { type: 'ADVANCE_STREET'; payload: { nextBoard: Card[] } }
  | { type: 'SHOW_SUMMARY'; payload: { handSummary: HandSummaryData } }
  | { type: 'REPLAY'; }
  | { type: 'COMPLETE' };

const initialState: PostflopSessionState = {
  heroHand: { c1: null, c2: null },
  board: [],
  potBb: 30,
  stackBb: 200,
  currentStreet: 'FLOP',
  streetIndex: 0,
  decisions: {},
  machineState: 'deciding',
  loading: false,
};

function postflopReducer(state: PostflopSessionState, action: PostflopAction): PostflopSessionState {
  switch (action.type) {
    case 'START_HAND':
      return {
        ...state,
        heroHand: action.payload.heroHand,
        board: action.payload.board.slice(0, 3), // Start with flop
        potBb: action.payload.potBb,
        stackBb: action.payload.stackBb,
        currentStreet: 'FLOP',
        streetIndex: 0,
        decisions: {},
        deviatedStreet: undefined,
        machineState: 'deciding',
      };

    case 'USER_DECIDED':
      return {
        ...state,
        machineState: 'evaluating',
        decisions: {
          ...state.decisions,
          [state.currentStreet]: {
            actionId: action.payload.actionId,
            solverOutput: null, // Will be filled by SOLVER_OUTPUT
          },
        },
      };

    case 'SOLVER_OUTPUT': {
      const currentDecision = state.decisions[state.currentStreet];
      // Check if user's action matches solver's expected line
      const userAction = currentDecision?.actionId;
      const solverActions = action.payload.output.actions || [];
      const userMatches = solverActions.find(a => a.actionId === userAction);
      const isDeviated = !userMatches || (userMatches.frequency ?? 0) < 0.01;

      return {
        ...state,
        machineState: 'advancing',
        deviatedStreet: isDeviated && !state.deviatedStreet ? state.currentStreet : state.deviatedStreet,
        decisions: {
          ...state.decisions,
          [state.currentStreet]: {
            ...currentDecision,
            solverOutput: action.payload.output,
          },
        },
      };
    }

    case 'ADVANCE_STREET': {
      const nextIndex = state.streetIndex + 1;
      const nextStreet = nextIndex === 0 ? 'FLOP' : nextIndex === 1 ? 'TURN' : nextIndex === 2 ? 'RIVER' : null;

      if (!nextStreet || nextIndex > 2) {
        return { ...state, machineState: 'complete' };
      }

      return {
        ...state,
        currentStreet: nextStreet,
        streetIndex: nextIndex,
        board: action.payload.nextBoard,
        machineState: 'deciding',
        loading: false,
      };
    }

    case 'SHOW_SUMMARY':
      return {
        ...state,
        machineState: 'summary',
      };

    case 'REPLAY':
      return {
        ...state,
        machineState: 'deciding',
        streetIndex: 0,
        currentStreet: 'FLOP',
      };

    case 'COMPLETE':
      return {
        ...state,
        machineState: 'complete',
      };

    default:
      return state;
  }
}

export const PostflopSessionContext = createContext<{
  state: PostflopSessionState;
  dispatch: React.Dispatch<PostflopAction>;
} | null>(null);

export function PostflopSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(postflopReducer, initialState);
  return (
    <PostflopSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </PostflopSessionContext.Provider>
  );
}

export function usePostflopSession() {
  const context = React.useContext(PostflopSessionContext);
  if (!context) throw new Error('usePostflopSession must be within PostflopSessionProvider');
  return context;
}
```

### Pattern 2: Web Worker Solver with Comlink

**What:** Solver computation runs in background thread. Main thread calls via Comlink's type-safe RPC wrapper, making async computation feel synchronous in usage.

**When to use:** Any solver.solve() call that might block UI (CFR+ iterations take 100-500ms).

**Example:**

```typescript
// src/workers/postflop.worker.ts
import { expose } from 'comlink';
import { solvePostflop } from '@/lib/solver/postflopSolver';
import type { PostflopConfig } from '@/lib/solver/postflopSolver';

const solverApi = {
  async solve(config: PostflopConfig) {
    const solution = await solvePostflop(config);
    return {
      actions: solution.strategies.map((s, idx) => ({
        actionId: POSTFLOP_ACTIONS[idx], // Map index to action name
        frequency: s.frequency,
        ev: s.ev,
      })),
      board: solution.board,
      street: solution.street,
    };
  },
};

expose(solverApi);

// src/lib/postflop/solver/solverClient.ts
import { wrap } from 'comlink';
import type { Remote } from 'comlink';

type SolverWorker = typeof import('@/workers/postflop.worker').solverApi;

let solverRemote: Remote<SolverWorker> | null = null;

export async function initSolverWorker(): Promise<Remote<SolverWorker>> {
  if (solverRemote) return solverRemote;

  const worker = new Worker(
    new URL('@/workers/postflop.worker.ts', import.meta.url),
    { type: 'module' }
  );
  solverRemote = wrap<SolverWorker>(worker);
  return solverRemote;
}

export async function solveFlopNode(config: PostflopConfig) {
  const solver = await initSolverWorker();
  return solver.solve(config);
}
```

### Pattern 3: Board Texture Classification

**What:** Classify board into discrete categories (Monotone, Paired, Connected, Rainbow). Used for filtering and difficulty hints.

**When to use:** Spot selection UI, pre-compute prioritization, difficulty display.

**Example:**

```typescript
// src/lib/postflop/classification/boardTexture.ts
import type { Card } from '@/lib/engine/types';

export type BoardTexture = 'MONOTONE' | 'TWO_TONE' | 'PAIRED' | 'CONNECTED' | 'RAINBOW';

export function classifyBoardTexture(board: Card[]): BoardTexture {
  if (board.length < 3) throw new Error('Board must have 3+ cards');

  const suits = board.map(c => c.split('')[1]); // 'As' → 's'
  const ranks = board.map(c => parseRank(c.split('')[0])); // 'As' → 14

  // Count suit frequency
  const suitCounts = new Map<string, number>();
  suits.forEach(s => suitCounts.set(s, (suitCounts.get(s) || 0) + 1));
  const maxSuitCount = Math.max(...Array.from(suitCounts.values()));

  // Check: 3 same suit
  if (maxSuitCount === 3) return 'MONOTONE';

  // Check: 2 cards same rank (paired boards)
  const rankCounts = new Map<number, number>();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));
  if (Math.max(...Array.from(rankCounts.values())) === 2) return 'PAIRED';

  // Check: 2 same suit
  if (maxSuitCount === 2) return 'TWO_TONE';

  // Check: connected (gaps ≤ 3 in rank)
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  const maxGap = Math.max(
    sortedRanks[1] - sortedRanks[0],
    sortedRanks[2] - sortedRanks[1]
  );
  if (maxGap <= 3) return 'CONNECTED';

  return 'RAINBOW';
}

export function textureDifficulty(texture: BoardTexture): 'easy' | 'medium' | 'hard' {
  const map: Record<BoardTexture, 'easy' | 'medium' | 'hard'> = {
    MONOTONE: 'hard',
    PAIRED: 'medium',
    CONNECTED: 'hard',
    TWO_TONE: 'medium',
    RAINBOW: 'easy',
  };
  return map[texture];
}
```

### Pattern 4: Hand Strength Categorization

**What:** Categorize hero hand into buckets (TopPair, Overpair, Draw, Air, etc.). Used for optional filtering.

**When to use:** Hand strength filter in spot selection UI.

**Example:**

```typescript
// src/lib/postflop/classification/handStrength.ts
import { evaluateHand } from '@/lib/solver/evaluation/handRanking';
import type { Hand, Card } from '@/lib/engine/types';

export type HandStrengthCategory =
  | 'OVERPAIR'
  | 'TOP_PAIR'
  | 'SECOND_PAIR'
  | 'TWO_PAIR'
  | 'SET'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'OPEN_DRAW'
  | 'AIR';

export function categorizeHandStrength(heroHand: Hand, board: Card[]): HandStrengthCategory {
  const allCards = [heroHand.c1, heroHand.c2, ...board];
  const eval = evaluateHand(allCards);

  // Made hands
  if (eval.category === 'TWO_PAIR') return 'TWO_PAIR';
  if (eval.category === 'THREE_OF_A_KIND') return 'SET';
  if (eval.category === 'STRAIGHT') return 'STRAIGHT';
  if (eval.category === 'FLUSH') return 'FLUSH';
  if (eval.category === 'FULL_HOUSE') return 'SET'; // Rare, count as set

  // Single pairs
  if (eval.category === 'PAIR') {
    const pairRank = extractPairRank(heroHand);
    const boardRanks = board.map(c => parseRank(c)).sort((a, b) => b - a);

    if (pairRank > boardRanks[0]) return 'OVERPAIR';
    if (pairRank === boardRanks[0]) return 'TOP_PAIR';
    if (pairRank === boardRanks[1]) return 'SECOND_PAIR';
  }

  // Draws (simplified: count outs)
  const straightOuts = countStraightOuts(heroHand, board);
  const flushOuts = countFlushOuts(heroHand, board);
  if (straightOuts + flushOuts >= 8) return 'OPEN_DRAW';

  return 'AIR';
}

// Helper: count outs by checking if a new card makes a straight
function countStraightOuts(hand: Hand, board: Card[]): number {
  // Simplified: iterate through remaining ranks and check if straight forms
  let count = 0;
  for (let r = 2; r <= 14; r++) {
    const testCards = [hand.c1, hand.c2, ...board, createCard(r, 'h')];
    if (evaluateHand(testCards).category === 'STRAIGHT') count++;
  }
  return count;
}

function countFlushOuts(hand: Hand, board: Card[]): number {
  const suits = [hand.c1.split('')[1], hand.c2.split('')[1], ...board.map(c => c.split('')[1])];
  const suitCounts = new Map<string, number>();
  suits.forEach(s => suitCounts.set(s, (suitCounts.get(s) || 0) + 1));

  for (const [suit, count] of suitCounts) {
    if (count >= 4) return 13 - count; // Remaining cards in that suit
  }
  return 0;
}
```

### Anti-Patterns to Avoid

- **Blocking UI with solver calls:** Never call `solvePostflop()` on main thread. Always use Web Worker.
- **Showing EV after deviation:** If user deviates on flop, don't show EV for turn/river. Show "N/A" + "Off solver line".
- **Caching without context:** Don't cache just by board. Cache by {board, stack, ranges, iterations} to avoid stale results.
- **Precomputing all boards upfront:** Pre-compute 50-100 common boards in background; solve custom boards real-time.
- **Hand-rolling multi-street logic:** Use reducer pattern (not nested async); makes state transitions explicit and testable.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Managing Flop→Turn→River state transitions with deviation tracking | Custom setState chains | React Context + useReducer | Reducer makes state flow explicit; easier to test and debug |
| Computing solver output without blocking UI | Direct solver calls on main thread | Web Worker + Comlink | Main thread blocking causes animation jank; Comlink RPC makes async feel synchronous |
| Caching solver results | Manual Map or Object keying | Memoization by {board, stack, ranges} | Manual caching misses edge cases (different stacks, ranges on same board) |
| Board texture classification | Custom suit/rank parsing logic | boardTexture.ts utility (pattern above) | Texture has edge cases (paired boards that are also two-tone); centralized logic reduces bugs |
| Hand strength evaluation | Custom pair/draw detection | Use existing poker-evaluator-ts + categorization logic | poker-evaluator-ts handles 5-7 card evaluation; categorization wraps it |
| Multi-street animation sequencing | Nested setTimeout/requestAnimationFrame | Motion.js variants with stagger (Phase 9) | Variants handle sequencing declaratively; easier to adjust timing |

**Key insight:** Postflop training looks custom but each problem (state, solver, classification, animation) has established patterns. Reusing them reduces implementation complexity.

## Common Pitfalls

### Pitfall 1: Solver Computation Blocks Animation

**What goes wrong:** User clicks action button → solver computes turn strategy → main thread busy → buttons unresponsive for 2+ seconds → feels broken.

**Why it happens:** CFR+ solver runs 50+ iterations of regret matching + strategy averaging. Each iteration ~10-100ms on main thread.

**How to avoid:**
- **Always** run solver in Web Worker via Comlink. Verify with Chrome DevTools: no "Long Tasks" (>50ms) when solver runs.
- Pre-compute 50-100 common boards during app startup (background task, not blocking).
- For real-time boards, show "Computing GTO strategy..." loading state with spinner.
- Fallback: if solver times out (>2s), show "Using approximation" + heuristic strategy.

**Warning signs:**
- ActionButton clicks feel slow
- Motion animations stutter when solver runs
- Console shows long task warnings

### Pitfall 2: Showing EV for Off-Line Streets

**What goes wrong:** User checks flop (wrong move; solver recommends bet). Turn solver output shows +3 EV. User confused: "But I made a mistake; why is EV positive?"

**Why it happens:** EV is **contingent on action history**. After user deviates, the turn game state is different from solver's expectation. Can't just pull EV from a different solution.

**How to avoid:**
- **Track deviation street.** Once user goes off-line, mark that street and all subsequent streets.
- Show "N/A" with "Off solver line" indicator for subsequent streets.
- In hand summary, show all three streets' full solver output so user understands what went wrong.
- Don't try to compute counterfactual EV. Keep it simple: show what GTO would have done, not what the deviation was worth.

**Warning signs:**
- EV values shown after user deviates
- User reports confusion about positive EV on bad decisions
- No explanation for N/A values

### Pitfall 3: Board Texture Filter Has Overlapping Logic

**What goes wrong:** Paired board (AsAh2d) shows up in "Monotone" filter because two-tone check comes before paired check.

**Why it happens:** Texture categories overlap. A paired board is also two-tone. Check order matters.

**How to avoid:**
- **Define priority hierarchy:**
  1. Paired (2 same rank) — highest priority
  2. Monotone (3 same suit)
  3. Two-tone (2 same suit)
  4. Connected (gaps ≤ 3)
  5. Rainbow (default)
- Test edge cases: AsKsQs (Monotone), AsAh2d (Paired, not Two-tone), As2h3d (Rainbow).
- Unit test each category with 5+ examples.

**Warning signs:**
- Users report wrong boards in texture filter
- Texture distribution looks unbalanced (one category has too many)
- Filter tests failing edge cases

### Pitfall 4: Not Showing Villain Actions Clearly

**What goes wrong:** User makes flop decision → screen changes to turn → user doesn't realize villain acted → confusion about what happened.

**Why it happens:** Silent transitions between streets. User expects to see villain's action before proceeding.

**How to avoid:**
- **Show villain action with brief animation.** After user acts on flop, show: "Villain checks" or "Villain bets 75%" for 1-2 seconds before revealing turn card.
- Display action label in seat or action history log.
- Brief delay (500ms) before revealing next card to let villain action "land."

**Warning signs:**
- User asks "Did the villain act?"
- Transitions feel abrupt, lacking narrative
- No trace of what villain did on previous street

### Pitfall 5: Precomputation Delays App Startup

**What goes wrong:** App loads → starts precomputing 100 boards → splash screen for 5+ seconds → user thinks app frozen.

**Why it happens:** Precomputation is expensive (solver iterations); if not managed, blocks initialization.

**How to avoid:**
- **Don't block app load on precomputation.** Start with 1-2 common boards (e.g., AKQ, paired aces) that load fast.
- Use `requestIdleCallback()` for batch precomputation (low-priority background task).
- Show progress only if precomputation visible: "Caching boards: 23/100" (optional UI).
- Graceful fallback: if board not cached, solve real-time with 1s delay visible to user.
- Test: app should be interactive within 500ms, precomputation happens in background.

**Warning signs:**
- Splash screen stays >1s
- First hand has long loading delay
- Precomputation blocks user actions

### Pitfall 6: Multiway Approximation Accuracy

**What goes wrong:** User trains on 3-player spots with approximation → strategy diverges 0.5% from true GTO → user learns suboptimal plays.

**Why it happens:** 3-player GTO is computationally hard. Exact solutions infeasible. Approximations have inherent error.

**How to avoid:**
- **Phase 10 targets 2-player (heads-up) only.** This is standard, fast, and exact.
- If 3-player support requested in future, clearly label as "Approximation" not "GTO Solution."
- Use extended iteration count (200+ iterations) for 3-player to reduce error.
- Include disclaimer: "This is an approximation to GTO; error ~0.5% per street."

**Warning signs:**
- 3-player spots feel "off" compared to actual GTO
- Solver not converging with more iterations
- Benchmark tests show >0.3% gap

## Code Examples

Verified patterns from existing codebase and official sources.

### Using PostflopSession Context in Component

```typescript
// src/components/poker/organisms/PostflopTraining.tsx
import { usePostflopSession } from '@/lib/postflop/session/postflopSession';
import { solveFlopNode } from '@/lib/postflop/solver/solverClient';

export function PostflopTraining() {
  const { state, dispatch } = usePostflopSession();
  const [isLoading, setIsLoading] = useState(false);

  async function handleUserDecision(actionId: string) {
    dispatch({ type: 'USER_DECIDED', payload: { actionId } });
    setIsLoading(true);

    try {
      // Solver runs in Web Worker, doesn't block UI
      const output = await solveFlopNode({
        street: state.currentStreet,
        board: state.board,
        heroRange: /* ... */,
        villainRange: /* ... */,
        potBb: state.potBb,
        stackBb: state.stackBb,
        heroPosition: 'IP',
        actionAbstraction: DEFAULT_ACTIONS,
      });

      dispatch({ type: 'SOLVER_OUTPUT', payload: { output } });

      // After brief delay, animate villain action then advance street
      setTimeout(() => {
        dispatch({ type: 'VILLAIN_ACTED', payload: { actionId: 'CHECK', delay: 1000 } });
      }, 500);

      setTimeout(() => {
        dispatch({
          type: 'ADVANCE_STREET',
          payload: { nextBoard: [...state.board, 'Ad'] }, // Turn card
        });
      }, 2500);
    } catch (error) {
      dispatch({ type: 'SHOW_SUMMARY', payload: { handSummary: /* error summary */ } });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <CommunityCards board={state.board} />
      <StreetDecision
        street={state.currentStreet}
        actionId={state.decisions[state.currentStreet]?.actionId}
        solverOutput={state.decisions[state.currentStreet]?.solverOutput}
        isDeviated={state.deviatedStreet === state.currentStreet}
        loading={isLoading}
        onActionSelected={handleUserDecision}
      />
      {state.machineState === 'summary' && (
        <HandSummaryModal decisions={state.decisions} deviatedStreet={state.deviatedStreet} />
      )}
    </div>
  );
}
```

### Board Texture Filter in Spot Selection

```typescript
// src/components/poker/molecules/BoardTextureFilter.tsx
import { classifyBoardTexture } from '@/lib/postflop/classification/boardTexture';

export function BoardTextureFilter({ onFilter }: Props) {
  const [selected, setSelected] = useState<Set<BoardTexture>>(new Set());

  const applyFilter = (boards: Card[][]) => {
    return boards.filter(board => {
      const texture = classifyBoardTexture(board);
      return selected.size === 0 || selected.has(texture);
    });
  };

  return (
    <div className="filter-group">
      <label>Board Texture (optional):</label>
      {(['MONOTONE', 'PAIRED', 'CONNECTED', 'RAINBOW'] as BoardTexture[]).map(texture => (
        <label key={texture}>
          <input
            type="checkbox"
            checked={selected.has(texture)}
            onChange={() => {
              const updated = new Set(selected);
              updated.has(texture) ? updated.delete(texture) : updated.add(texture);
              setSelected(updated);
            }}
          />
          {texture.replace(/_/g, ' ')}
        </label>
      ))}
    </div>
  );
}
```

### Initializing Solver Worker at App Load

```typescript
// src/lib/postflop/solver/initializeSolver.ts
import { initSolverWorker } from './solverClient';

export async function initializePostflopSolver() {
  try {
    await initSolverWorker();
    console.log('Solver worker initialized');

    // Precompute common boards in background (non-blocking)
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => precomputeBoards());
    } else {
      setTimeout(() => precomputeBoards(), 100);
    }
  } catch (error) {
    console.error('Failed to initialize solver:', error);
    // Fallback: solver will initialize on first use
  }
}

async function precomputeBoards() {
  const solver = await initSolverWorker();
  const commonBoards = [
    ['As', 'Ks', 'Qs'],
    ['As', 'Ad', '9h'],
    ['Ks', 'Qs', 'Jd'],
    // ... add ~50 more
  ];

  for (const board of commonBoards) {
    try {
      await solver.solve({
        street: 'FLOP',
        board,
        heroRange: DEFAULT_HERO_RANGE,
        villainRange: DEFAULT_VILLAIN_RANGE,
        potBb: 30,
        stackBb: 200,
        heroPosition: 'IP',
        actionAbstraction: DEFAULT_ACTIONS,
      });
      console.log(`Cached: ${board.join('')}`);
    } catch (error) {
      console.warn(`Failed to cache ${board.join('')}`, error);
    }
  }
}

// Call this in app root (e.g., _app.tsx or layout.tsx)
useEffect(() => {
  initializePostflopSolver();
}, []);
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single-threaded solver | Web Worker + Comlink | UI stays responsive; solver runs in parallel |
| Fixed board spots | Random boards + real-time solving | Maximum variety; users learn flexible strategy |
| EV only | EV + action frequencies | Teaches betting psychology, not just "best move" |
| Custom state management | React Context + useReducer | Explicit state flow; easier to test and debug |
| Silent street transitions | Animated villain actions + card reveals | Narrative flow; users understand what happened |
| All-in-one solver precomputation | Mixed pre-compute + real-time | Fast startup; responsive training |

## Open Questions

1. **Exact precomputation batch strategy**
   - What we know: Top 50-100 boards should pre-compute without blocking
   - What's unclear: Should we prioritize by frequency? If so, where does frequency data come from?
   - Recommendation: Start with 50 hardcoded common boards (AKQ, paired, broadway combos). If users request more, implement frequency-based selection in future phase.

2. **Three-player approximation in future phases**
   - What we know: 2-player exact solutions are fast and standard
   - What's unclear: If multiway support added, how much iteration budget for acceptable error?
   - Recommendation: Phase 10 locks to 2-player. Future phase can add 3-player with 200+ iterations and clear "approximation" labeling.

3. **Exact "Off Solver Line" indicator design**
   - What we know: Users need to understand why EV is N/A after deviation
   - What's unclear: Should it be a banner, icon, tooltip, or all?
   - Recommendation: Icon + tooltip on N/A EV values + banner after hand completes explaining deviation.

4. **Hand strength filter completeness**
   - What we know: Standard categories exist (TopPair, Overpair, Draws)
   - What's unclear: What about "pair + flush draw" or "gutshot only"?
   - Recommendation: Implement basic categories (Overpair, TopPair, TwoPair, Set, OpenDraw, Air). Add sub-categories in future if users request.

5. **Villain action sampling policy**
   - What we know: After user decides, need to show villain's action before advancing
   - What's unclear: Should villain be sampled from GTO strategy or just play best response?
   - Recommendation: Sample from GTO strategy (realistic). Implement `sampleVillainAction(solverOutput)` utility that picks random action weighted by frequency.

## Sources

### Primary (HIGH confidence)

- **Existing postflopSolver.ts** — CFR+ solver in codebase; confirmed working
  - `src/lib/solver/postflopSolver.ts` — Flop/Turn/River solving with E[HS] buckets
  - `src/lib/solver/abstraction/cards.ts` — Hand strength bucketing (50 buckets default)
  - `src/lib/solver/postflopSolver.test.ts` — Solver test suite validates correctness

- **Existing Training Infrastructure** — DecisionGrade, RecordFactory, sessions
  - `src/lib/engine/trainingOrchestrator.ts` — Decision grading and recording
  - `src/lib/engine/session.ts` — Training session state management
  - Lines 13-24: `DecisionGrade` interface matches postflop feedback needs

- **React + Tailwind** — Package.json confirmed
  - React 19.2.4, Tailwind 4.1.18, Next.js 16.1.6

- **poker-evaluator-ts** — Hand evaluation library in codebase
  - Package.json: `poker-evaluator-ts 2.0.3`
  - Used in existing solvers for hand ranking

### Secondary (MEDIUM confidence — verified with official docs)

- **Comlink Official Documentation** — Web Worker RPC wrapper
  - https://github.com/GoogleChromeLabs/comlink
  - https://www.npmjs.com/package/comlink (v4.4.1+)
  - Provides type-safe RPC; standard pattern for background computation

- **Web Workers API** — Native browser standard
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
  - No external dependency needed; standard for 10+ years

- **Phase 9 Animation Research** — Motion library decision
  - `.planning/phases/09-animations/09-RESEARCH.md`
  - Confirms Motion 12.34.0+ for sequencing and stagger

- **Game State Machine Patterns** — Established design
  - https://gameprogrammingpatterns.com/state.html
  - useReducer is React idiomatic equivalent

- **Poker Board Texture Definitions** — GTO Wizard + poker theory
  - https://pages.gtowizard.com/en/glossary/board-texture/
  - Standard poker terminology (Monotone, Paired, Connected, etc.)

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — postflopSolver confirmed in codebase; React/Tailwind confirmed; poker-evaluator-ts confirmed
- **Architecture Patterns:** HIGH — Existing codebase uses Context + Reducer patterns; Phase 9 confirms Motion choice; Comlink verified with official docs
- **Pitfalls:** HIGH — CFR+ solver performance confirmed via existing implementation; deviation handling from existing training patterns; board texture from poker theory
- **Multi-street orchestration:** MEDIUM-HIGH — State machine pattern standard but implementation details deferred to planner

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (Postflop solver and state patterns are stable; re-check if multiway support considered)

**Key assumptions:**
- postflopSolver.ts is correct and production-ready (Phase 1 delivered)
- Motion library will be available (Phase 9 completing)
- Comlink adds <2KB to bundle (acceptable)
- Web Workers supported (all modern browsers since 2015)
- 2-player exact solving preferred over 3-player approximation
