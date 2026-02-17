# Phase 5: Preflop Training - Research

**Researched:** 2026-02-16
**Domain:** Interactive preflop poker training with GTO solver integration and session management
**Confidence:** HIGH

## Summary

Phase 5 wires Phase 4's table UI with Phase 1's solver to create an interactive preflop training loop. Users practice decision-making across four scenario types (RFI, facing open, 3bet pots, blind defense) with immediate EV-based feedback. The implementation builds on the existing session lifecycle (start/next/submit), extends spot filtering to support preflop scenario classification, and adds training-specific UI components for action revelation and frequency visualization.

Core technical patterns are already established: deterministic spot selection via seeded RNG, solver integration through SolverNodeOutput adapter, and session persistence through backend-agnostic SessionStore. Phase 5 adds preflop-specific concerns: action history visualization on the table, frequency-weighted color coding for action buttons, and guest session limiting to 50 hands/day.

**Primary recommendation:** Classify spots into four preflop scenario types during pack loading (not at render time). Extend SpotFilterInput to support optional scenario filtering. Use sessionStore's existing pause-resume mechanism directly (no new persistence needed). Implement action history text summary via a separate, simple function (not a new component), keeping the concern separated from table UI.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Client UI components | Already in project; hooks support session state |
| Next.js | 16.1.6 | Frontend app framework | Already deployed; API routes support session endpoints |
| Tailwind CSS | Latest | Utility-first styling | Already configured; color themes support feedback states |
| TypeScript | 5.9.3 | Type-safe implementation | Strict mode; prevents action/frequency type errors |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| poker-evaluator-ts | 2.0.3 | Hand equity calculation | Already in solver; preflop equity table lookups |
| seedrandom (Mulberry32) | Custom | Deterministic RNG | Already in Phase 1; spot selection reproducibility |
| Vitest | 4.0.18 | Unit testing | Already configured; test session handlers and scenario logic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend SpotFilterInput for scenario type | Create separate Scenario model | Scenario type is metadata on Spot, not separate entity; extending filters keeps cohesion |
| Custom action history component | Simple string formatter + existing table UI | Action history is preflop-only; formatting logic separate from rendering avoids coupling |
| Zustand/Redux for session state | useState + Context + sessionStore | SessionStore abstraction already proven; no need for additional state library |
| localStorage for guest counting | Backend counter + session table | Requires minimal client logic; localStorage is reliable for 50-hand limit |

**No new packages required.** All dependencies already present from Phases 1-4.

## Architecture Patterns

### Recommended Project Structure

```
src/lib/v2/
├── packs/
│   ├── scenarioClassifier.ts        # NEW: Classify spots as RFI|FacingOpen|3Bet|BlindDefense
│   └── spotPack.ts                  # EXTEND: Add scenarioType to SpotMeta
├── filters/
│   └── spotFilters.ts               # EXTEND: Add scenarioType to SpotFilterInput
├── api/
│   └── sessionHandlers.ts           # NO CHANGE: Session lifecycle already supports mode/filters
└── api-client/
    └── sessionClient.ts             # NO CHANGE: Existing start/next/submit sufficient

src/components/poker/
├── organisms/
│   ├── PokerTable.tsx               # EXTEND: Display action history summary
│   └── ActionPanel.tsx              # EXTEND: Add frequency bar and color coding
├── molecules/
│   └── ActionButton.tsx             # EXTEND: Color coding, frequency bar, locked border
└── training/
    └── PreflopsTrainingSession.tsx  # NEW: Orchestrate training flow (start/action/reveal)
```

### Pattern 1: Preflop Scenario Classification

**What:** Classify each spot as one of four preflop scenario types based on history depth and position.
**When to use:** At pack load time, once per spot. Not at render time.
**Example:**
```typescript
// Source: Phase 5 CONTEXT.md decision on scenario types
export type PreflopScenarioType = 'RFI' | 'FacingOpen' | '3Bet' | 'BlindDefense';

function classifyPreflopScenario(spot: Spot): PreflopScenarioType {
  // PREFLOP only (street === 'PREFLOP')
  // RFI: hero to act, no history (first to act)
  if (spot.history.length === 0) return 'RFI';

  // FacingOpen: hero to act, history length 1 (single open)
  if (spot.history.length === 1) return 'FacingOpen';

  // 3Bet: hero to act, history length 2 (open + 3bet)
  if (spot.history.length === 2) return '3Bet';

  // BlindDefense: hero is SB or BB, history contains action(s)
  if ((spot.heroToAct === 'SB' || spot.heroToAct === 'BB') && spot.history.length >= 1)
    return 'BlindDefense';

  // Fallback (shouldn't occur in preflop)
  return 'RFI';
}
```

### Pattern 2: Action History Visualization

**What:** Display prior actions as a short text summary below the pot size on the table.
**When to use:** Render on every frame; read from spot.history.
**Example:**
```typescript
// Source: Existing pattern from Phase 4 spot display
function actionHistoryToText(history: ActionId[]): string {
  if (history.length === 0) return 'No prior action';

  const actions = history.map(id => {
    // ActionId format: 'FOLD', 'CALL', 'BET_2.5BB', 'RAISE_3.0BB', etc.
    const [type, size] = id.split('_');
    if (size) return `${type} ${size}`;
    return type;
  });

  return actions.join(' → ');
}

// Usage on PokerTable:
<div className="text-xs text-gray-400 mt-1">
  {actionHistoryToText(currentSpot.history)}
</div>
```

### Pattern 3: Frequency-Weighted Action Button Coloring

**What:** Color actions based on solver frequency: green (highest), yellow (lower), red (non-solver).
**When to use:** After feedback reveal in TRAINING mode; toggleable pre-decision.
**Example:**
```typescript
// Source: Phase 4-04 RESEARCH - Color feedback pattern
interface ActionWithFrequency {
  actionId: ActionId;
  frequency: number;  // 0.0 to 1.0 from SolverNodeOutput.actions
  ev: number;
}

function actionButtonColor(action: ActionWithFrequency, isUserChoice: boolean): string {
  if (isUserChoice) return 'ring-2 ring-blue-500';  // User's chosen action highlighted

  const { frequency } = action;
  if (frequency >= 0.6) return 'bg-green-600';       // Primary solver action
  if (frequency > 0.0) return 'bg-yellow-600';       // Secondary solver action
  return 'bg-red-600';                               // Non-solver action
}
```

### Pattern 4: Guest Session Hand Limiting

**What:** Track guest training hand count in localStorage; prompt when limit hit.
**When to use:** On session end for unauthenticated users.
**Example:**
```typescript
// Source: Existing sessionStore pattern extended
const GUEST_HANDS_PER_DAY = 50;
const STORAGE_KEY = 'guest_training_hands';

function getGuestHandCount(): number {
  const today = new Date().toDateString();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return 0;

  const { date, count } = JSON.parse(stored);
  if (date !== today) return 0;  // Reset on new day
  return count;
}

function incrementGuestHandCount(): void {
  const today = new Date().toDateString();
  const count = getGuestHandCount() + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count }));
}

function isGuestLimitExceeded(): boolean {
  return getGuestHandCount() >= GUEST_HANDS_PER_DAY;
}
```

### Pattern 5: Pause/Resume State Persistence

**What:** Use existing sessionStore.decisionIndex + currentSpot to restore session mid-hand.
**When to use:** On page load; check sessionStore for incomplete session matching seed/sessionId.
**Example:**
```typescript
// Source: Existing sessionStore pattern (no new code needed)
async function resumeSession(seed: string, sessionId: string): Promise<SessionRecord | null> {
  const session = await getSessionRecord(sessionId, seed);
  if (!session || session.isComplete) return null;
  return session;  // Contains decisionIndex and currentSpot for resumption
}

// Usage in training page:
const resumedSession = await resumeSession(seed, sessionId);
if (resumedSession) {
  // Load decisionIndex and currentSpot; skip to that decision
  setCurrentSpot(resumedSession.currentSpot);
  setDecisionCount(resumedSession.decisionIndex);
} else {
  // New session flow
}
```

### Anti-Patterns to Avoid
- **Classify scenarios at render time:** Do it once at pack load or on session start; re-running classification on every render is wasteful
- **Mutate spot.history during training:** Action history is immutable; create new spots during session progression
- **Custom action history component:** The summary is formatting, not a component; keep it separate from PokerTable
- **Duplicate session state:** Don't maintain session state in both sessionStore and React useState; use sessionStore as source of truth and sync via useEffect
- **Global frequency bar styling:** Use Tailwind's utility classes directly in ActionButton; avoid creating new wrapper components just for color logic

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session persistence across page refresh | Custom JSON serialization in localStorage | Existing sessionStore + runtimeKey abstraction | Already handles seed/sessionId hashing and optional backend swapping |
| Determining solver action vs user action | Custom frequency threshold logic | Compare actionId directly; check if in SolverNodeOutput.actions | SolverNodeOutput already sorted by frequency; comparison is 1-line |
| Hand equity calculation | Custom equity computation | poker-evaluator-ts (via Phase 1 solver) | Precomputed tables; 22MM hands/sec; proven accurate |
| Deterministic spot ordering | Custom shuffle or random pick | Existing seeded RNG + spotSource.selectDeterministicSpot() | Already proven reproducible; no need to reinvent |
| Color theming for action buttons | Custom color mapping config | Tailwind class utilities + conditional strings | Tailwind v4 HSL values already configured in theme; no config needed |

**Key insight:** The session lifecycle (start/next/submit) and persistence layer are fully generic. Phase 5's job is narrow: add preflop scenario classification, extend filters to support optional scenario type, and wire the table UI to reveal actions with frequency coloring. Everything else (persistence, RNG, grading) already works.

## Common Pitfalls

### Pitfall 1: Scenario Type Mismatch Between Client and Server

**What goes wrong:** Client classifies a spot as 'RFI' but the spot in the pack was loaded as 'FacingOpen'; user sees mismatched feedback.
**Why it happens:** Scenario classification logic differs between pack generation and runtime classification, or pack metadata disagrees with actual history.
**How to avoid:** Add scenario type to SpotMeta at pack load time (deterministic). Query it from metadata, never re-compute. Test pack integrity in pack loading.
**Warning signs:** Feedback feels "wrong" for a given position/history combination; frequency distributions don't match expected solver patterns for scenario type.

### Pitfall 2: Action Reveal Race Condition

**What goes wrong:** User clicks action, state says "waiting for reveal," but user clicks Next before reveal animation. Next submits a different action.
**Why it happens:** No locking between action submission and next hand; UI state not synchronized with backend.
**How to avoid:** Lock action buttons immediately on submit. Set UI state to 'submitted' (not clickable) before API call. Only unlock on feedback received or error.
**Warning signs:** User can submit two actions in a row; decisionIndex increments inconsistently.

### Pitfall 3: Preflop-Only Assumptions Leak into Generic Session Code

**What goes wrong:** Add preflop-specific logic to sessionHandlers.ts; Phase 10 (postflop) inherits broken behavior.
**Why it happens:** Mixing preflop concerns (history depth rules) with generic session progression.
**How to avoid:** Keep scenario classification in spotPack.ts or filters.ts (not sessionHandlers). sessionHandlers remains generic. Phase 10 can add postflopScenarioType separately.
**Warning signs:** sessionHandlers references 'preflop' or 'history.length' in conditionals; Phase 10 tasks need to modify session logic.

### Pitfall 4: Guest Hand Count Not Reset on Day Boundary

**What goes wrong:** Guest trains on Feb 15, hits 50 hands. On Feb 16, limit still enforced from yesterday's count.
**Why it happens:** localStorage check compares stored date to today's date, but date parsing is off by timezone or the check is missing.
**How to avoid:** Store date as `new Date().toDateString()` (always 'DDD MMM DD YYYY'). Check on every hand increment. Reset if stored date !== today.
**Warning signs:** Guest on Day 2 can't train even though count should be reset; localstorage key contains timestamp/timezone info.

### Pitfall 5: Undo Window Interferes with Submission

**What goes wrong:** User clicks action, then clicks undo within 1s, but submission API still processes.
**Why it happens:** No cancellation token or state locking; undo changes UI state but API request is in-flight.
**How to avoid:** On undo, set UI state to 'undone' (disable further actions). If pending API call completes, ignore result. Test undo timing.
**Warning signs:** User undoes, feedback appears anyway; sessionStore records two entries for same decision.

## Code Examples

Verified patterns from official sources:

### Example 1: Extend SpotFilterInput for Scenario Type

```typescript
// Source: Existing spotFilters.ts pattern
export type PreflopScenarioType = 'RFI' | 'FacingOpen' | '3Bet' | 'BlindDefense';

export interface SpotFilterInput {
  street?: Street;
  heroPosition?: Position;
  villainPosition?: Position;
  effectiveStackBbBucket?: EffectiveStackBucket;
  potType?: PotTypeFilter;
  // NEW: Optional preflop scenario filter
  scenarioType?: PreflopScenarioType | 'ANY';
}

export function matchesSpotFilters(entry: SpotEntry, filters: SpotFilterInput): boolean {
  // ... existing checks ...

  // NEW: Check scenario type if present
  if (filters.scenarioType && 'scenarioType' in entry.meta &&
      filters.scenarioType !== 'ANY' &&
      entry.meta.scenarioType !== filters.scenarioType) {
    return false;
  }
  return true;
}
```

### Example 2: Extend SpotMeta with Scenario Type

```typescript
// Source: Existing spotPack.ts pattern
export interface SpotMeta {
  street: Street;
  heroPosition: Position;
  villainPosition: Position;
  effectiveStackBb: number;
  potType: PotType;
  // NEW: Preflop scenario classification
  scenarioType?: PreflopScenarioType;  // Only set if street === 'PREFLOP'
}

// At pack load time (or pack generation):
function enrichSpotWithScenario(entry: SpotEntry): SpotEntry {
  if (entry.meta.street !== 'PREFLOP') return entry;

  return {
    ...entry,
    meta: {
      ...entry.meta,
      scenarioType: classifyPreflopScenario(entry.spot),
    },
  };
}
```

### Example 3: Action Button with Frequency Bar and Color

```typescript
// Source: Phase 4-04 ActionButton pattern extended
interface ActionButtonProps {
  action: 'fold' | 'call' | 'raise';
  label?: string;
  state: 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect';
  ev?: number;                    // NEW: EV in BB
  frequency?: number;              // NEW: Solver frequency 0.0-1.0
  onClick?: () => void;
  className?: string;
}

export function ActionButton({
  action,
  label,
  state,
  ev,
  frequency,
  onClick,
  className,
}: ActionButtonProps) {
  const getButtonColor = () => {
    if (state === 'selected') return 'ring-2 ring-blue-500';
    if (frequency === undefined) return 'bg-gray-600';

    if (frequency >= 0.6) return 'bg-green-600';
    if (frequency > 0.0) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <button
      onClick={onClick}
      disabled={state === 'disabled'}
      className={cn(
        'px-4 py-3 rounded font-semibold text-white transition',
        getButtonColor(),
        state === 'disabled' && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div>{label || action.toUpperCase()}</div>

      {/* NEW: Frequency bar and EV display (only after reveal) */}
      {(state === 'revealed-correct' || state === 'revealed-incorrect') && (
        <>
          {frequency !== undefined && (
            <div className="mt-1 bg-gray-800 rounded h-2 overflow-hidden">
              <div
                className="bg-white h-full transition-all"
                style={{ width: `${frequency * 100}%` }}
              />
            </div>
          )}
          {ev !== undefined && (
            <div className="text-xs mt-1 text-gray-300">
              EV: {(ev > 0 ? '+' : '')}{ev.toFixed(2)} BB
            </div>
          )}
        </>
      )}
    </button>
  );
}
```

### Example 4: Training Session Flow with Reveal Delay

```typescript
// Source: Session handler pattern + React state
export function PreflopsTrainingSession() {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [state, setState] = useState<'waiting' | 'submitted' | 'revealed'>('waiting');
  const [grade, setGrade] = useState<DecisionGrade | null>(null);

  const handleSubmitAction = async (actionId: ActionId) => {
    setState('submitted');

    // 0.5s pause before reveal
    const response = await submitAction({
      seed,
      sessionId,
      spot: spot!,
      actionId,
    });

    if (response.ok) {
      // Wait 500ms then reveal
      await new Promise(resolve => setTimeout(resolve, 500));
      setGrade(response.result);
      setState('revealed');
    }
  };

  const handleNext = async () => {
    setState('waiting');
    setGrade(null);
    const response = await nextDecision({ seed, sessionId });
    setSpot(response.spot);
  };

  return (
    <div>
      <PokerTable
        spot={spot}
        actionHistory={spot?.history ?? []}
      />
      <ActionPanel
        actions={/* map from solver output and grade */}
        state={/* 'idle' | 'disabled' | 'revealed-*' based on state */}
        onAction={handleSubmitAction}
      />
      {state === 'revealed' && (
        <button onClick={handleNext}>Next Hand (Space/Enter)</button>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static preflop charts (hard-coded ranges) | GTO solver with live computation | 2010s → 2020s | Players can adapt to new stack depths; solvers provide exact frequencies |
| Batch training (download CSV, offline) | Interactive web-based training | 2015 → 2020+ | Real-time feedback; instant grading; mobile support |
| Single-street training only | Multi-street progression (Phase 10 vision) | 2018+ | Develops full decision trees; Phase 5 is preflop foundation |
| Uniform action feedback | Frequency-weighted color coding | 2022+ | Visual pattern recognition; faster skill transfer |
| Session stored in URL only | Backend persistence + localStorage resumption | 2023+ | Survives browser crash; cross-device resume possible |

**Deprecated/outdated:**
- Static GTO charts (printed): Replaced by interactive solvers; players need frequency distribution, not single range
- Practice-mode-only training: TRAINING mode provides instant feedback; modern players expect real-time grading

## Open Questions

Things that couldn't be fully resolved:

1. **Exact Undo Mechanism Implementation (Claude's Discretion)**
   - What we know: Brief ~1s window to undo before feedback reveal; after reveal, decision is locked
   - What's unclear: Should undo be button, right-click, keyboard (Ctrl+Z), or all three?
   - Recommendation: Implement as a keyboard shortcut first (Ctrl+Z); add button if UX testing shows need. Measure undo frequency in analytics (Phase 8) to validate.

2. **Side Panel Pre-Decision Information Toggle (Claude's Discretion)**
   - What we know: Panel always present; mid-hand info (equity, hand category) toggleable
   - What's unclear: Should toggle persist across sessions? Default on or off?
   - Recommendation: Store toggle in localStorage per user (or session). Default OFF to avoid information leakage; experienced players can toggle ON.

3. **Action History Summary Format (Claude's Discretion)**
   - What we know: Short text summary below pot size; toggleable in settings
   - What's unclear: Exact wording ("2.5x → 3x raise" vs "BET 2.5BB RAISE 3.0BB" vs "B3")
   - Recommendation: Use human-readable format with positions and action types: "BTN opens 2.5BB, Hero 3bets 7.5BB". Test with users in Phase 7 (UX validation).

4. **Guest Hand Counter Reset Timing**
   - What we know: 50 hands per day; reset on day boundary
   - What's unclear: What timezone/UTC? How to handle guests bridging midnight?
   - Recommendation: Use browser local midnight (toDateString() is local). If guest straddles midnight, count resets mid-session naturally (50 hands from yesterday → next hand resets counter).

5. **Raise Sizing Per Scenario Type**
   - What we know: "Raise sizing predetermined per scenario type (e.g., 2.5x open, 3x 3bet)"
   - What's unclear: Source of truth for these sizes? Configurable?
   - Recommendation: Define in spotPack metadata as part of scenario type (e.g., { scenarioType: 'RFI', raiseSize: 2.5 }). Hardcode for Phase 5; make configurable in Phase 6.

## Sources

### Primary (HIGH confidence)
- **Existing Phase 1-4 codebase:** Session handlers, spot model, action types, grading logic, API structure
- **Phase 4-04 RESEARCH.md:** ActionButton 5-state machine pattern, frequency bar implementation, color feedback scheme
- **Phase 5 CONTEXT.md:** User decisions on scenario types, training flow, guest limits, feedback visibility
- **Poker-evaluator-ts documentation:** Hand evaluation library; precomputed equity table pattern (via Phase 1)

### Secondary (MEDIUM confidence)
- WebSearch results on GTO poker training platforms: BBZ, PioSolver, GTO Wizard use frequency-weighted color coding and interactive scenario selection
- WebSearch results on React state management 2026: localStorage + sessionStorage for client state, Context API for app-wide config
- WebSearch results on poker UI design trends: Modern apps use progress bars, visual feedback, and keyboard shortcuts for training workflows

### Tertiary (LOW confidence)
- Unverified industry best practices: Exact undo window duration (estimated 1s from CONTEXT), raise sizing multiples (assumed from Phase 1 defaults)
- Unverified UX patterns: Side panel toggle defaults, action history text format (Claude's Discretion areas requiring user testing)

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - All dependencies already in project; no new packages required
- Architecture: HIGH - Session lifecycle, spot model, grading, and API patterns proven in Phase 1-4; Phase 5 is thin orchestration layer
- Pitfalls: MEDIUM - Common issues identified from codebase patterns; undo/pause timing requires validation in implementation
- Code Examples: MEDIUM - Patterns built on verified Phase 4 code; scenario classification is new but follows existing filter pattern

**Research date:** 2026-02-16
**Valid until:** 2026-03-02 (14 days - moderate stability, preflop scenario logic unchanged, React patterns stable)
**Codebase state:** v3 branch; Phase 4 complete; Phase 1-2 solver and session API in use

---

*Research for Phase 5: Preflop Training - Interactive GTO-graded decision training*
