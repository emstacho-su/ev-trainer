# Sprint Roadmap: EV-Trainer Production Build

**Created**: 2026-04-07
**Authority**: This document is the single source of truth for the remaining build. Phases execute in order. Each phase has testable exit criteria.
**References**: `.planning/AUDIT.md` (findings), `.planning/SOLVER-COMPARISON.md` (solver research)

---

## Architecture Decisions (Locked)

These decisions are final. Do not revisit during implementation.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Postflop solver | b-inary/postflop-solver via WASM | Only OSS solver with proven browser WASM pipeline (wasm-postflop). DCFR algorithm, faster than PioSOLVER natively. |
| Preflop strategy | Precomputed ranges from existing `src/lib/solver/` CFR+ | Preflop is solved at chart level. No need for live solving. Existing CFR+ produces 169-hand ranges per position. |
| WASM threading | Single-threaded initially (solver-st), multi-threaded later | COOP/COEP headers for SharedArrayBuffer can break third-party embeds. Start simple, upgrade if solve times demand it. |
| Solver adapter | Async interface with preflop/postflop routing | Real solving is async (WASM). Adapter routes by street to correct backend (JSON lookup vs WASM). |
| Solver cache | Two-tier: IndexedDB (client) + Supabase table (server) | Client cache avoids re-solving; server cache enables cross-device sharing and analytics. |
| Range format | PioSOLVER-compatible string format + f32[1326] internal | postflop-solver expects f32[1326]. String format for display/config. 13x13 grid for UI. |
| Hand evaluation | poker-evaluator-ts (existing dep) + postflop-solver internal | Keep existing evaluator for preflop. postflop-solver handles postflop hand strength internally. |
| Deployment | Vercel (Next.js native) | Free tier, built-in CI/CD, preview deploys. WASM supported via Fluid Compute. |
| Build tool | Webpack (not Turbopack) | Turbopack's WASM support is incomplete. Use `--webpack` flag for dev until Turbopack catches up. |
| AGENTS.md update | Replace Kiro workflow gate with SPRINT-ROADMAP authority | .kiro/ is archived. New gate: phases in this document, not Kiro specs. |

---

## Dependency Graph

```
Phase 0 (Cleanup) ──────────────────────────────────────────────┐
    ↓                                                            │
Phase 1 (Async Solver Infra) ──→ Phase 3 (WASM Postflop)        │
    ↓                                ↓                           │
Phase 2 (Preflop Ranges)       Phase 5 (Postflop Training)      │
    ↓                                ↓                           │
Phase 4 (DB + Cache) ─────→ Phase 6 (Range Viz Connected)       │
                                     ↓                           │
                              Phase 7 (Config + Drilling)        │
                                     ↓                           │
                              Phase 8 (UI Polish) ←──────────────┘
                                     ↓
                              Phase 9 (Testing)
                                     ↓
                              Phase 10 (Deploy)
```

Phases 1 and 2 can run in parallel. Phase 3 depends on Phase 1. All later phases are sequential.

---

## Phase 0: Cleanup & Stabilization

**Goal**: Clean workspace, close known bugs, update project governance to use this roadmap.

**Depends on**: Nothing

**Requirements**: None (infrastructure)

### Success Criteria

1. `.kiro/` archived to `.archive/kiro/`
2. Completed phase plans (01-08) archived to `.archive/phases/`
3. `terraform/`, `ecosystem.config.js`, `promptfoo/` removed or archived
4. `src/server/` archived (Express, superseded by Supabase)
5. `PreflopTrainingSession-EvansLenovo.tsx` deleted
6. Console.log debug statements removed from OAuth pages
7. AGENTS.md updated: Kiro workflow gate replaced with SPRINT-ROADMAP reference
8. Phase 11 gap G4 fixed: session summary page handles API errors gracefully
9. Phase 11 gap G5 fixed: stats SessionHistory table columns aligned
10. Phase 11 gap G3 addressed: spots include all 6 positions with folded seats
11. Phase 11 gap G1/G2: `.env.local.example` created with all required variables, seed script validates env

### Tasks

1. Create `.archive/` directory, move `.kiro/` -> `.archive/kiro/`
2. Move `.planning/phases/01-*` through `08-*` -> `.archive/phases/`
3. Move `terraform/` -> `.archive/terraform/`, delete `ecosystem.config.js`
4. Move `promptfoo/` -> `.archive/promptfoo/`
5. Move `src/server/` -> `.archive/express-server/`
6. Delete `src/components/training/PreflopTrainingSession-EvansLenovo.tsx`
7. Remove `console.log('[OAuth]')` from `src/app/login/page.tsx` and `src/app/signup/page.tsx`
8. Update `AGENTS.md`: replace Kiro gate with "Follow SPRINT-ROADMAP.md phases in order"
9. **G4**: In `src/app/api/session/[id]/route.ts`, wrap GET in try/catch returning JSON errors. In `src/app/summary/[id]/page.tsx`, fall back to `readSessionRecord()` from localStorage on API failure.
10. **G5**: In `src/app/stats/components/SessionHistory.tsx`, replace `<td colSpan={6}>` with 6 individual `<td>` cells matching `<th>` headers.
11. **G3**: Transform `public/packs/ev-demo-pack-v2.json` to include all 6 positions per spot. Update `spotToPlayers()` in `src/components/training/PreflopTrainingSession.tsx` to handle folded seats.
12. **G1/G2**: Create `.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Update `scripts/seedSpots.ts` to check for service role key.
13. Add `.archive/` to `.gitignore`
14. Run `npm test` -- all existing tests must pass

### Verification

```bash
test ! -d .kiro && echo "PASS: .kiro removed"
test -d .archive/kiro && echo "PASS: .kiro archived"
test ! -f src/components/training/PreflopTrainingSession-EvansLenovo.tsx && echo "PASS: duplicate deleted"
test -f .env.local.example && echo "PASS: env template exists"
grep -L "console.log.*OAuth" src/app/login/page.tsx src/app/signup/page.tsx && echo "PASS: debug logs removed"
grep -q "SPRINT-ROADMAP" AGENTS.md && echo "PASS: AGENTS.md updated"
npm test -- --passWithNoTests
```

---

## Phase 1: Async Solver Infrastructure

**Goal**: Refactor the solver adapter to async, add preflop/postflop routing, and decompose sessionHandlers.ts. This phase builds the foundation every subsequent phase depends on.

**Depends on**: Phase 0

**Requirements**: SOLV-08 (partial: solver interface with progress tracking)

### Success Criteria

1. `SolverAdapter` interface is async: `solve(request): Promise<SolverNodeOutput>`
2. `SolverRequest` includes solver config: bet tree, ranges, iterations, exploitability target
3. Preflop/postflop routing dispatches to correct adapter by street
4. `sessionHandlers.ts` decomposed into 3 files under 300 lines each
5. Zod schemas replace unsafe type casts in session validation
6. All existing tests pass with no behavioral changes

### Tasks

1. **Create `src/lib/engine/solverTypes.ts`**: Extract and extend solver types:
   ```typescript
   interface SolverConfig {
     maxIterations: number;
     targetExploitability: number;
     betSizes?: BetSizeConfig;
     ranges?: { oop: string; ip: string };
   }
   interface AsyncSolverAdapter {
     solve(request: SolverRequest): Promise<SolverNodeOutput>;
     solveWithProgress?(request: SolverRequest, onProgress: (p: SolverProgress) => void): Promise<SolverNodeOutput>;
   }
   interface SolverProgress {
     iteration: number;
     exploitability: number;
     elapsedMs: number;
   }
   ```

2. **Update `src/lib/engine/solverAdapter.ts`**: Add `SolverConfig` to `SolverRequest`. Keep `validateSolverNodeOutput` unchanged. Export `AsyncSolverAdapter` interface.

3. **Create `src/lib/engine/solverRouter.ts`**: Routes by street:
   - `PREFLOP` -> PreflopRangeAdapter (Phase 2)
   - `FLOP | TURN | RIVER` -> PostflopSolverAdapter (Phase 3)
   - Falls back to mockSolve for unimplemented adapters

4. **Decompose `src/lib/v2/api/sessionHandlers.ts`** (665 lines) into:
   - `src/lib/v2/api/sessionValidation.ts` (~150 lines): Zod schemas for start/submit/next requests, `parseFilters()`, typed error classes
   - `src/lib/v2/api/sessionOrchestrator.ts` (~200 lines): `handleStart()`, `handleSubmit()`, `handleNext()`, `handleGetSession()` business logic
   - `src/lib/v2/api/sessionResponse.ts` (~100 lines): Response builders, error formatting
   - Keep `sessionHandlers.ts` as a thin re-export barrel file

5. **Add Zod schemas** in `sessionValidation.ts`:
   ```typescript
   const StartRequestSchema = z.object({
     mode: z.enum(["TRAINING", "PRACTICE"]),
     packId: z.string().optional(),
     seed: z.string().optional(),
     filters: SpotFiltersSchema.optional(),
     userId: z.string().uuid().optional(),
   });
   ```

6. **Replace unsafe casts**: Remove `as unknown as Spot`, `as ActionId`, `as string | undefined`. Use Zod `.parse()` or type narrowing functions instead.

7. **Move hardcoded values to constants**: `DEFAULT_PACK_ID = "ev-dev-pack-v1"`, `DEFAULT_GRADING_CONFIG`, `SESSION_ID_HASH_LENGTH = 24`.

8. **Update all imports** across the codebase to use new file paths.

9. Run `npm test` -- zero regressions.

### Verification

```bash
wc -l src/lib/v2/api/sessionValidation.ts src/lib/v2/api/sessionOrchestrator.ts src/lib/v2/api/sessionResponse.ts
# Each under 300 lines
grep -r "as unknown as" src/lib/v2/api/ | wc -l  # Should be 0
grep -r "AsyncSolverAdapter" src/lib/engine/solverAdapter.ts  # Should find interface
npm test -- --passWithNoTests
```

---

## Phase 2: Preflop Range Database

**Goal**: Generate preflop ranges for all 6-max positions using the existing CFR+ solver, store them, and create a PreflopRangeAdapter that serves them through the async solver interface.

**Depends on**: Phase 1 (async adapter interface)

**Requirements**: SOLV-05 (preflop ranges for all positions)

### Success Criteria

1. Preflop ranges generated for all position matchups (UTG, HJ, CO, BTN, SB, BB) as 169-hand frequency maps
2. Ranges stored as JSON in `public/ranges/` (bundled, no DB dependency)
3. `PreflopRangeAdapter` implements `AsyncSolverAdapter`, returns `SolverNodeOutput` from stored ranges
4. Preflop training uses real ranges instead of mock solver
5. Existing determinism tests still pass (seeded RNG unaffected)

### Tasks

1. **Create `scripts/generatePreflopRanges.ts`**: Run existing `solvePreflopScenario()` from `src/lib/solver/preflopSolver.ts` for each position matchup. Use `DEFAULT_CFR_CONFIG` (1M iterations, 0.1 mbb target). Output JSON files per scenario.

2. **Create `public/ranges/` directory** with generated files:
   - `preflop-6max-100bb.json` -- all position matchup ranges at 100bb
   - Format: `{ [scenarioKey]: { actions: SolverActionOutput[], exploitability: number } }`
   - Scenario key: `"UTG_RFI"`, `"HJ_vs_UTG"`, `"BB_vs_BTN"`, etc.

3. **Create `src/lib/engine/preflopRangeAdapter.ts`**:
   ```typescript
   export class PreflopRangeAdapter implements AsyncSolverAdapter {
     private ranges: Map<string, SolverNodeOutput>;
     async load(): Promise<void>;  // fetch from /ranges/
     async solve(request: SolverRequest): Promise<SolverNodeOutput>;
   }
   ```
   - Build scenario key from `request.publicState` (position, history)
   - Return stored `SolverNodeOutput` (instant, no computation)
   - Return `{ status: "unsolved" }` for unknown scenarios

4. **Wire into `solverRouter.ts`**: `PREFLOP` requests -> `PreflopRangeAdapter`

5. **Update preflop training flow**: Replace mock solver calls with router calls. The grading pipeline (`gradeDecision()`) doesn't change -- it already accepts any `SolverNodeOutput`.

6. **Add range validation script**: `scripts/validateRanges.ts` -- verify all generated ranges have frequencies summing to ~1.0, EVs are finite, and cover all expected position matchups.

7. Run `npm test` -- all preflop training tests pass with real ranges.

### Verification

```bash
test -f public/ranges/preflop-6max-100bb.json && echo "PASS: ranges generated"
node -e "const r=require('./public/ranges/preflop-6max-100bb.json'); console.log(Object.keys(r).length + ' scenarios')"
npm test -- --passWithNoTests
```

---

## Phase 3: Postflop Solver Integration (WASM)

**Goal**: Integrate postflop-solver via WASM so the app can solve real postflop spots in-browser.

**Depends on**: Phase 1 (async adapter interface)

**Requirements**: SOLV-06 (postflop subgame solving), SOLV-08 (convergence + progress)

### Success Criteria

1. postflop-solver compiles to WASM via wasm-pack (solver-st module minimum)
2. WASM module loads in Next.js client-side via Web Worker + Comlink
3. `PostflopSolverAdapter` implements `AsyncSolverAdapter` with real WASM solving
4. Solver accepts ranges (f32[1326]), board, pot, stack, bet sizes and returns strategy
5. Results convert to `SolverNodeOutput` format (actionId, frequency, ev per action)
6. Solve progress reported via callback (iteration, exploitability, elapsed)
7. Next.js config has `asyncWebAssembly` experiment and COOP/COEP headers

### Tasks

1. **Fork repos**: Fork `b-inary/postflop-solver` and `b-inary/wasm-postflop` to project GitHub.

2. **Set up Rust toolchain**: Add to project root:
   - `rust-toolchain.toml` specifying nightly channel
   - `wasm/` directory for WASM build artifacts
   - `scripts/build-wasm.sh`: builds solver-st and range modules via `wasm-pack build`

3. **Build WASM modules** (minimum viable):
   - `wasm/pkg/range/` -- RangeManager for range parsing
   - `wasm/pkg/solver-st/` -- GameManager for single-threaded solving
   - Build command: `wasm-pack build --target web --out-dir ../../wasm/pkg/solver-st rust/solver-st`

4. **Update `next.config.js`**:
   ```javascript
   webpack(config) {
     config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
     return config;
   },
   async headers() {
     return [{ source: "/(.*)", headers: [
       { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
       { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
     ]}];
   }
   ```

5. **Create `src/lib/engine/wasm/solverWorker.ts`** (Web Worker):
   - Import WASM modules
   - Expose via Comlink: `init()`, `solve(config)`, `getProgress()`
   - `solve()` creates GameManager, calls init() with ranges/board/bet sizes, runs solve_step loop, returns strategy

6. **Create `src/lib/engine/wasm/solverBridge.ts`** (main thread):
   - Initialize worker via Comlink
   - Convert between ev-trainer types and WASM types:
     - `SolverRequest` -> GameManager.init() params
     - GameManager strategy/EV output -> `SolverNodeOutput`
   - Handle worker lifecycle (init once, reuse)

7. **Create `src/lib/engine/postflopSolverAdapter.ts`**:
   ```typescript
   export class PostflopSolverAdapter implements AsyncSolverAdapter {
     private bridge: SolverBridge;
     async solve(request: SolverRequest): Promise<SolverNodeOutput>;
     async solveWithProgress(request, onProgress): Promise<SolverNodeOutput>;
   }
   ```
   - Map request.publicState (board, pot, stack) + request config (bet sizes, ranges) to WASM params
   - Convert WASM output (strategy array, actions, EVs) to `SolverNodeOutput`
   - Validate output via `validateSolverNodeOutput()`

8. **Wire into `solverRouter.ts`**: `FLOP | TURN | RIVER` -> `PostflopSolverAdapter`

9. **Install Comlink**: `npm install comlink`

10. **Add integration test**: `src/__tests__/postflopSolverWasm.test.ts` -- verify WASM loads, solves a simple flop spot, returns valid `SolverNodeOutput`.

### Verification

```bash
test -d wasm/pkg/solver-st && echo "PASS: WASM built"
grep "asyncWebAssembly" next.config.js && echo "PASS: webpack configured"
grep "Cross-Origin-Opener-Policy" next.config.js && echo "PASS: COOP headers"
npm test -- --passWithNoTests
```

---

## Phase 4: Database Schema & Caching

**Goal**: Add solver output caching, JSONB indexes, and auto-aggregation triggers.

**Depends on**: Phase 2, Phase 3 (solver output format finalized)

**Requirements**: SOLV-07 (partial: benchmark data storage)

### Success Criteria

1. `solver_cache` table stores solved outputs keyed by canonical hash
2. GIN indexes on frequently queried JSONB fields
3. Auto-aggregation trigger updates `daily_stats` and `spot_stats` on `session_entries` INSERT
4. IndexedDB client-side cache implemented via Dexie
5. Cache hit/miss metrics logged

### Tasks

1. **Create `supabase/migrations/004_solver_cache.sql`**:
   ```sql
   CREATE TABLE solver_cache (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     canonical_hash TEXT UNIQUE NOT NULL,
     street TEXT NOT NULL,
     board TEXT[],
     pot_bb NUMERIC(10,2),
     effective_stack_bb NUMERIC(10,2),
     bet_tree_config JSONB,
     solver_output JSONB NOT NULL,
     iterations INT,
     exploitability NUMERIC(10,6),
     created_at TIMESTAMPTZ DEFAULT NOW(),
     accessed_at TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE INDEX idx_solver_cache_hash ON solver_cache (canonical_hash);
   CREATE INDEX idx_solver_cache_street ON solver_cache (street);
   ```

2. **Create `supabase/migrations/005_jsonb_indexes.sql`**:
   ```sql
   CREATE INDEX idx_session_entries_result ON session_entries USING GIN (result);
   CREATE INDEX idx_training_sessions_filters ON training_sessions USING GIN (filters);
   CREATE INDEX idx_session_entries_action ON session_entries (session_id, action_id);
   ```

3. **Create `supabase/migrations/006_aggregation_triggers.sql`**: Trigger on `session_entries` INSERT that upserts into `daily_stats` and `spot_stats`.

4. **Create `src/lib/engine/solverCache.ts`**:
   - `SolverCacheClient` class with two tiers:
     - `IndexedDBCache` (Dexie) for client-side
     - `SupabaseSolverCache` for server-side
   - Key: canonical hash from `canonicalHash.ts`
   - Methods: `get(hash)`, `set(hash, output)`, `updateAccessTime(hash)`

5. **Install Dexie**: `npm install dexie`

6. **Create `src/lib/engine/solverCacheDb.ts`**: Dexie schema:
   ```typescript
   class SolverCacheDB extends Dexie {
     solverResults!: Table<{ canonicalHash: string; output: SolverNodeOutput; createdAt: number }>;
     constructor() {
       super("EVTrainerSolverCache");
       this.version(1).stores({ solverResults: "canonicalHash" });
     }
   }
   ```

7. **Integrate cache into `solverRouter.ts`**: Check cache before calling adapter. Store result after solve.

8. **Regenerate Supabase types**: `npm run gen:types`

### Verification

```bash
grep "solver_cache" supabase/migrations/004_solver_cache.sql && echo "PASS: migration exists"
grep "Dexie" src/lib/engine/solverCacheDb.ts && echo "PASS: IndexedDB cache"
npm test -- --passWithNoTests
```

---

## Phase 5: Postflop Training Mode

**Goal**: Complete the postflop training flow with multi-street progression using real solver output.

**Depends on**: Phase 3 (WASM solver), Phase 4 (caching)

**Requirements**: POST-01 through POST-06

### Success Criteria

1. User can train flop decision points with dynamic bet sizing from solver
2. User can progress through flop -> turn -> river in a single hand
3. Off-solver-line deviations are tracked and displayed
4. Spot context labels show scenario description ("3b IP Aggressor", "SRP OOP Caller")
5. Last Raiser Indicator (LRI) token displayed next to aggressor
6. Hand summary modal shows all street decisions with grades after hand completes

### Tasks

1. **Complete `src/components/training/PostflopTrainingSession.tsx`**: Wire to real solver via async adapter. Use `postflopReducer` state machine. Handle loading states during WASM solve.

2. **Update `src/components/poker/molecules/StreetActionPanel.tsx`**: Render dynamic bet sizes from solver output (not hardcoded). Show frequency bars and EV after decision.

3. **Create `src/components/poker/molecules/SpotContextLabel.tsx`** (if not exists): Display scenario context ("SRP IP Caller, Flop: Ah Ks 7d").

4. **Create `src/components/poker/molecules/LastRaiserIndicator.tsx`** (if not exists): Visual token (chip or badge) positioned at the last aggressor's seat.

5. **Update `src/lib/postflop/solver/solverClient.ts`**: Replace `mockSolvePostflop()` with real WASM adapter call via `solverRouter`.

6. **Update `src/app/training/page.tsx`** (or create `src/app/postflop-training/page.tsx`): Add postflop training route that uses `PostflopTrainingSession`.

7. **Create `src/components/poker/molecules/HandSummaryModal.tsx`** (if not exists): Show each street's decision, solver recommendation, grade, and cumulative EV loss.

8. **Add tests**: `src/__tests__/postflopTrainingFlow.test.ts` -- full multi-street hand with real solver adapter (can mock WASM).

### Verification

```bash
grep "POST-01\|POST-02\|POST-03\|POST-04\|POST-05\|POST-06" src/components/training/PostflopTrainingSession.tsx  # Not literal; verify functionality
npm test -- postflop
```

---

## Phase 6: Range Visualization (Connected)

**Goal**: Wire the existing range grid components to real solver output so users see actual GTO frequencies.

**Depends on**: Phase 3 (real solver output available)

**Requirements**: RANG-01 through RANG-05

### Success Criteria

1. Range grid cells show real action frequencies color-coded by action
2. Hero and villain ranges displayed side-by-side from solver ranges
3. Board cards shown between range grids
4. Equity breakdown by hand category displayed
5. Action frequency summary at bottom (e.g., "Fold 42.1%, Call 35.2%, Raise 22.7%")

### Tasks

1. **Create `src/lib/engine/rangeExtractor.ts`**: Given a solved game state, extract per-hand action frequencies from WASM solver. Convert WASM `strategy()` output (flat f32 array) to `Map<CanonicalHand, ActionFrequency[]>`.

2. **Update `src/components/range/RangeGridView.tsx`**: Accept real frequency data instead of mock. Map frequencies to cell colors using existing color scheme.

3. **Update `src/components/range/RangeGridModal.tsx`**: Fetch solver data when "View Ranges" clicked. Show loading spinner during solve. Pass hero/villain range data to grids.

4. **Update `src/components/range/EquityBreakdown.tsx`**: Compute equity by hand category (overpair, top pair, draws, etc.) from solver equity output.

5. **Update `src/components/range/ActionLegend.tsx`**: Show actual action names from solver output (not hardcoded CHECK/BET).

6. **Add integration test**: Verify range modal displays correct frequencies for a known solved spot.

### Verification

```bash
grep "rangeExtractor" src/components/range/RangeGridModal.tsx && echo "PASS: connected to real data"
npm test -- range
```

---

## Phase 7: Trainer Configuration & Drilling

**Goal**: Wire remaining config options and implement targeted drilling from stats.

**Depends on**: Phase 5 (postflop training), Phase 6 (range viz)

**Requirements**: CONF-01 through CONF-07, DRIL-01 through DRIL-04

### Success Criteria

1. Street toggle (Preflop/Flop) selects training mode
2. Stack depth selection (50bb/100bb/200bb) adjusts solver config
3. Position and pot type filters narrow spot selection
4. Drill specific position matchups from stats breakdown
5. Quick-drill button starts targeted session for weak spots
6. Config changes persist across sessions (localStorage + Supabase for logged-in users)

### Tasks

1. **Update `src/components/config/GameSetup.tsx`**: Wire stack depth selector to solver config. Pass `effectiveStackBb` through to solver adapter.

2. **Update `src/components/config/ModeToggle.tsx`**: Street toggle switches between preflop route (PreflopRangeAdapter) and postflop route (PostflopSolverAdapter).

3. **Update `src/lib/v2/config/configStore.ts`**: Add `stackDepthBb`, `betTreePreset` to config schema. Sync to Supabase for authenticated users.

4. **Create `src/lib/v2/drilling.ts`**: `createDrillSession(weakSpot: SpotStats): SessionConfig` -- builds a targeted session from stats-identified weaknesses.

5. **Update `src/components/config/DrillSuggestions.tsx`**: Wire to real stats data. Quick-drill button calls `createDrillSession()` and navigates to training.

6. **Update `src/app/stats/components/WeaknessBreakdown.tsx`**: Add drill button per weakness row that starts targeted session.

7. **Add tests**: Config persistence round-trip, drill session creation from stats.

### Verification

```bash
npm test -- config drilling
```

---

## Phase 8: UI Polish & Animations

**Goal**: Complete all remaining UI work for portfolio-ready quality.

**Depends on**: Phase 7 (all features functional)

**Requirements**: ANIM-01 through ANIM-07

### Success Criteria

1. Card dealing animation (smooth flip + slide to positions)
2. Chip movement animation (slide to pot on bets)
3. EV reveal animation (fade in with color transition)
4. Action button pulse on selection
5. Smooth transitions between streets
6. Animation skip option for fast training
7. Placeholder pages completed or removed
8. Onboarding flow for new users
9. User settings page (animations, sound, theme)

### Tasks

1. **Implement `src/lib/ui/animationTiming.ts`**: Centralized timing constants for all animations. Respect user's reduced-motion preference.

2. **Update `src/components/poker/atoms/AnimatedCard.tsx`**: Add deal animation (stagger from deck position to seat) and flip animation (3D transform).

3. **Update `src/components/poker/molecules/ActionButton.tsx`**: Add pulse animation on selection, EV text slide-up reveal, background color transition.

4. **Create chip slide animation**: In `src/components/poker/atoms/Chip.tsx` or `PotDisplay.tsx`, animate chips from player seat to pot center.

5. **Add street transition**: Smooth fade/slide between flop -> turn -> river board reveals.

6. **Add animation settings**: `src/components/config/AnimationSettings.tsx` with toggle (on/off/reduced) and speed control. Store in user preferences.

7. **Complete or remove placeholder pages**:
   - `src/app/review/[id]/page.tsx` -- implement hand review using session entries
   - `src/app/summary/[id]/page.tsx` -- implement post-session summary (fixed in Phase 0, enhance here)
   - Delete `src/app/table-ui-demo/page.tsx` if not needed
   - Delete or redirect `src/app/setup/[mode]/page.tsx` if superseded by config dialog

8. **Create onboarding flow**: `src/components/Onboarding.tsx` -- tooltip walkthrough on first visit explaining EV grading, action buttons, and stats. Store completion flag in localStorage/profile.

9. **Create user settings page**: `src/app/settings/page.tsx` -- animation preferences, sound toggle, display name, theme.

10. **Mobile optimization**: Audit PokerTable at 375px width. Ensure cards and action buttons don't overlap. Consider simplified mobile layout.

### Verification

```bash
# Visual verification required for animations
grep "motion" src/components/poker/atoms/AnimatedCard.tsx && echo "PASS: card animations"
grep "AnimationSettings" src/components/config/ && echo "PASS: animation settings"
test -f src/app/settings/page.tsx && echo "PASS: settings page"
npm test -- --passWithNoTests
```

---

## Phase 9: Testing Hardening

**Goal**: Achieve 80%+ test coverage with integration, component, and E2E tests.

**Depends on**: Phase 8 (all features stable)

**Requirements**: Cross-cutting quality requirement

### Success Criteria

1. Supabase integration tests run against local instance
2. Auth flow tests cover signup, login, OAuth redirect, session refresh
3. Component tests for PokerTable, ActionPanel, StatsPage, RangeGridView
4. Playwright E2E for: start training -> make 5 decisions -> view stats
5. Solver output contract tests validate WASM output against `SolverNodeOutput`
6. Overall coverage >= 80% (lines)

### Tasks

1. **Set up Supabase local**: Add `supabase start` to test setup. Create `src/__tests__/supabase/` directory.

2. **Create Supabase integration tests**:
   - `rls.test.ts` -- verify RLS policies (users can't read other users' data)
   - `triggers.test.ts` -- verify `handle_new_user`, `update_updated_at`, aggregation triggers
   - `solver_cache.test.ts` -- verify cache read/write/update accessed_at

3. **Create auth flow tests**: `src/__tests__/auth/`:
   - `signup.test.ts` -- registration, email verification
   - `login.test.ts` -- email/password, session persistence
   - `oauth.test.ts` -- OAuth redirect, callback handling

4. **Create component tests**: `src/components/__tests__/`:
   - `PokerTable.test.tsx` -- renders correct seats, handles 6max/9max
   - `ActionPanel.test.tsx` -- renders solver actions, handles click, shows EV
   - `RangeGridView.test.tsx` -- renders 13x13 grid, colors correct

5. **Set up Playwright**:
   - `npm install -D @playwright/test`
   - Create `playwright.config.ts`
   - Create `e2e/` directory

6. **Create E2E tests**: `e2e/`:
   - `training-session.spec.ts` -- start session, make decisions, view feedback, complete session
   - `stats-dashboard.spec.ts` -- navigate to stats, verify charts render, filter works
   - `auth-flow.spec.ts` -- signup, login, session persists across refresh

7. **Create solver contract test**: `src/__tests__/solverContract.test.ts` -- solve known spot via WASM, validate output format matches `SolverNodeOutput`, compare key EV values against known reference.

8. **Run coverage**: `npm run test:cov` and verify >= 80%.

### Verification

```bash
npx vitest run --coverage | grep "All files" | awk '{print $NF}'  # Check >= 80%
npx playwright test --reporter=list
```

---

## Phase 10: Production Deployment

**Goal**: Deploy to Vercel with CI/CD, monitoring, and production environment.

**Depends on**: Phase 9 (tests passing)

**Requirements**: Infrastructure readiness

### Success Criteria

1. App deploys to Vercel with working WASM solver
2. Environment variables configured in Vercel dashboard
3. CI/CD pipeline: push to main -> build -> test -> deploy
4. WASM modules served with correct MIME types and caching headers
5. Error tracking via Vercel Analytics or Sentry
6. Lighthouse performance score >= 80 on training page

### Tasks

1. **Configure Vercel project**:
   - Link GitHub repo to Vercel
   - Set framework to Next.js
   - Configure build command: `npm run build` (must include WASM build step)

2. **Set environment variables in Vercel**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

3. **Update build pipeline**: Ensure `scripts/build-wasm.sh` runs before `next build`. Options:
   - Add to `package.json` scripts: `"prebuild": "bash scripts/build-wasm.sh"`
   - Or commit pre-built WASM artifacts to repo (simpler, avoids Rust toolchain in CI)

4. **Configure caching headers**: WASM files should have long cache TTL with content-hash filenames.

5. **Add error tracking**: Install Vercel Analytics or `@sentry/nextjs`. Configure error boundaries in `src/app/error.tsx` and `src/app/global-error.tsx`.

6. **Add `robots.txt` and `sitemap.xml`** if app should be indexed.

7. **Performance audit**: Run Lighthouse on `/training` page. Optimize bundle size (lazy-load WASM, code-split stats page).

8. **Create production README**: Update `README.md` with: what the app does, live URL, how to run locally, tech stack, architecture overview.

### Verification

```bash
curl -s https://[deployed-url]/api/session/start -X POST | jq .status  # Should work
curl -sI https://[deployed-url] | grep "Cross-Origin-Opener-Policy"  # COOP header present
```

---

## Requirements Traceability (Updated)

Maps original v3 requirements to new sprint phases:

| Requirement | Sprint Phase | Status |
|-------------|-------------|--------|
| SOLV-01 (CFR+) | Complete (existing `src/lib/solver/`) | Done |
| SOLV-02 (Card abstraction) | Complete (existing) | Done |
| SOLV-03 (Bet abstraction) | Complete (existing) | Done |
| SOLV-04 (Game tree) | Complete (existing) | Done |
| SOLV-05 (Preflop ranges) | Phase 2 | Pending |
| SOLV-06 (Postflop solving) | Phase 3 | Pending |
| SOLV-07 (Benchmark) | Phase 9 (contract tests) | Pending |
| SOLV-08 (Convergence) | Phase 1 + 3 | Pending |
| TRUI-01 to 12 | Complete | Done |
| RANG-01 to 05 | Phase 6 | Pending |
| CONF-01 to 07 | Phase 7 | Pending |
| DRIL-01 to 04 | Phase 7 | Pending |
| PREF-01 to 05 | Complete | Done |
| POST-01 to 06 | Phase 5 | Pending |
| BACK-01 to 08 | Superseded by Supabase (Phase 11 old roadmap) | Done (different impl) |
| AUTH-01 to 07 | Complete | Done |
| STAT-01 to 08 | Complete | Done |
| VISU-01 to 05 | Complete | Done |
| ANIM-01 to 07 | Phase 8 | Pending |

**Coverage**: 74 requirements. 44 complete, 30 pending (covered by Phases 1-9).

---

## Cross-Cutting Concerns

### Testing Protocol

Every phase must exit with `npm test` passing. New features require tests before merging. Target patterns:
- Engine/solver logic: unit tests with deterministic seeds
- API handlers: integration tests with mocked Supabase
- UI components: render tests with React Testing Library
- Critical flows: Playwright E2E (Phase 9)

### Error Handling

All solver calls must handle: WASM load failure, solve timeout, invalid output, worker crash. Pattern:
```typescript
try {
  const output = await solverRouter.solve(request);
  return gradeDecision(output, userAction);
} catch (error) {
  // Log error, return graceful fallback (mock solve or "unsolved" status)
}
```

### Performance Budget

- WASM initial load: < 2MB gzipped
- Solve time (typical flop spot, 1000 iterations): < 5 seconds
- Time to first decision display: < 1 second (use cached ranges for preflop)
- Bundle size (JS, excluding WASM): < 500KB gzipped

### Commit Protocol

- One logical change per commit
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`
- Run `npm test` before every commit
- No secrets in commits (`.env*` in `.gitignore`)
