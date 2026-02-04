# Project Research Summary

**Project:** EV Trainer V3
**Domain:** GTO Poker Training Platform (CFR+ Solver, Interactive UI, Backend Infrastructure)
**Researched:** 2026-02-03
**Confidence:** MEDIUM-HIGH

## Executive Summary

EV Trainer V3 is a GTO poker training platform that requires a sophisticated three-tier architecture: a CFR+ solver core for strategy computation, an Express backend for persistence and auth, and a Next.js frontend with animated poker UI. The project builds on a mature V2 codebase with strong determinism patterns and established testing infrastructure.

The recommended approach combines **pre-computed strategies** (for common preflop spots) with **runtime solving** (for postflop subgames), using TypeScript throughout to preserve V2's determinism guarantees. The oval table UI (not the 13x13 range grid modal) is the primary training interface for both preflop and postflop, with immediate visual feedback (green/red action buttons) after each decision. The 13x13 range grid appears as a "View Ranges" modal accessible during training sessions.

Key risks include **CFR+ algorithmic correctness** (regret flooring errors cause non-convergence), **memory explosion** (unabstracted game trees exceed Node.js heap limits), and **determinism preservation** (migration to PostgreSQL and auth must not break existing replay guarantees). Mitigation strategies include early benchmark validation against known GTO solutions, aggressive card/action abstraction, and careful session key design that separates auth from determinism.

## Key Findings

### Recommended Stack

The stack preserves V2's proven foundation (Next.js 16, React 19, TypeScript 5.9, Tailwind 4, Vitest) while adding backend infrastructure and animation capabilities. Core new technologies are Express 5.2 for API server, PostgreSQL 16+ with Prisma 7.3 for persistence, and Framer Motion 12.31 for animations.

**Core technologies:**
- **Next.js 16 + React 19**: Already in V2, proven App Router patterns, SSR for auth pages
- **Express 5.2**: Backend API server, separates concerns from Next.js, WebSocket-ready for future
- **PostgreSQL 16 + Prisma 7.3**: Relational model fits user/session/decision data, type-safe queries
- **Framer Motion 12.31**: Industry standard React animations, spring physics for card dealing and chip movement
- **TypeScript 5.9**: Strict mode enables safe solver refactoring, unified language across stack

**Solver-specific stack:**
- **Custom CFR+ implementation** in TypeScript (no library exists for poker CFR)
- **seedrandom 3.0.5**: Already used in V2's rng.ts, ensures deterministic solver runs
- **Web Workers**: Offload CFR iterations to background, keep UI responsive
- **CSS Grid + Tailwind**: 13x13 range matrix visualization (no library needed)

**Critical version notes:**
- Prisma client and CLI must match exactly (7.3.0)
- Next.js 16 requires React 19
- Framer Motion 12.31 has full React 19 support
- Avoid Redux (over-engineered), MobX (unnecessary observables), Mongoose (wrong DB)

### Expected Features

**Must have (table stakes):**
- **Oval table training UI**: Interactive positions (UTG/HJ/CO/BTN/SB/BB), not grid-based — this is the main interface
- **Immediate action grading**: Gray buttons before, green (correct/high freq) or red (incorrect/low freq) after decision
- **EV + frequency reveal**: Show EV and frequency for each action AFTER user submits
- **13x13 range grid modal**: Accessible via "View Ranges" button during postflop, shows color-coded action frequencies
- **Session history + review**: EV-sorted mistake list, per-decision detail view, already built in V2
- **Preflop training scenarios**: RFI, vs 3bet, vs 4bet by position/stack depth
- **Statistics dashboard**: Mean EV loss, best-action rate, 7D/30D/90D filtering

**Should have (competitive differentiators):**
- **Animated UI**: Card dealing, chip movement, EV reveal animations create engaging experience
- **Performance graphs**: Visual trend analysis (EV loss improving over time)
- **Weakness detection**: Auto-identify worst spot types for targeted practice
- **Trainer Config toggles**: Preflop/Flop, Cash/HU, 6max/9max, 50bb/100bb, Villain Always Raise
- **Daily streak tracking**: Gamification for habit formation

**Defer (v2+):**
- **Hand replay animation**: High complexity, nice-to-have not must-have
- **Practice recommendations**: Requires substantial user data before valuable
- **Custom scenario creation**: Power user feature, standard scenarios sufficient for launch
- **Equity calculators**: Complex, not core training flow
- **Note-taking system**: Can use external tools initially

**Anti-features (explicitly avoid):**
- Real-money integration (regulatory nightmare)
- Multiplayer/social training (scope creep)
- Leaderboards with real usernames (privacy concerns)
- Auto-play suggestions (removes learning opportunity)
- Copy GTOWizard UI directly (legal risk, missed originality opportunity)

### Architecture Approach

The architecture uses a three-tier design separating solver computation from backend persistence from frontend presentation. The CFR+ solver core implements Counterfactual Regret Minimization Plus with card/action abstraction to make NLHE tractable. A hybrid solving approach combines pre-computed strategies (PostgreSQL lookup) with runtime subgame refinement (on-demand CFR+ iterations).

**Major components:**
1. **CFR+ Solver Core**: GameTree builder, InfoSetStore (regret/strategy vectors), AbstractionLayer (card clustering, bet sizing), CFREngine (iteration loop), StrategyExporter. Implemented in TypeScript, potentially compiled to WASM for performance.
2. **Express Backend**: SessionService (lifecycle), TrainingService (grading), SolverService (adapter to solver layer), StatsService (aggregates). Migrates V2's engine layer (`grading.ts`, `rng.ts`, `canonicalHash.ts`) to persistent storage.
3. **Next.js Frontend**: Oval table UI with animated positions, ActionPanel with bet slider, FeedbackPanel with EV reveal, RangeGrid modal (13x13), StatsPage with performance graphs. Uses Framer Motion for animations, React Query for server state, Zustand for minimal global state.

**Data flow pattern:**
- User starts session → Express creates session, selects spot → Solver resolves node (pre-computed or runtime) → Frontend displays oval table with positions
- User submits action → Express grades vs solver output → Frontend animates EV reveal (green/red feedback) → Next spot or session summary

**V2 preservation:**
- Deterministic session keys (`seed::sessionId`, auth-independent)
- Canonical node hashing for solver cache
- EV-first grading (evLossVsMix, evLossVsBest)
- Adapter interface stability (`SolverNodeOutput` unchanged)

### Critical Pitfalls

1. **CFR+ Regret Floor Implementation Error** — CFR+ differs from vanilla CFR by flooring cumulative regrets at zero AFTER accumulation. Flooring before or flooring instantaneous regret causes non-convergence. Prevention: `cumulativeRegret[a] = Math.max(0, cumulativeRegret[a] + instantaneousRegret)`. Warning signs: exploitability plateaus above target, strategies oscillate. Detection: benchmark against known-good solver on small tree, track exploitability curve.

2. **Memory Explosion from Unabstracted Game Tree** — NLHE has ~10^160 states. Without card/bet abstraction, memory grows unbounded. Prevention: implement card clustering (169 canonical preflop hands) and bet abstraction (3-4 discrete sizes) BEFORE tree building. Use lazy node generation with explicit budget. Warning signs: memory > 4GB for simple preflop scenario. Detection: monitor `process.memoryUsage().heapUsed`, set max node limit.

3. **Determinism Broken by Iteration Order** — JavaScript Map iteration is insertion-order dependent. If tree traversal order varies (timing, parallelization), accumulated floating-point errors differ, breaking session replay. Prevention: always sort children before traversal (by action ID), use deterministic containers. Warning signs: same seed produces different spotId sequences. Detection: run determinism replay test after solver integration.

4. **Card Isomorphism Breaking Hand Clusters** — AhKh and AsKs must map to same strategy (suit-isomorphic preflop). Failing to canonicalize suits causes 4-24x memory usage and incorrect divergent strategies. Prevention: canonical suit ordering, test isomorphic hands return identical strategies. Warning signs: node count ~1326 instead of ~169 for preflop tree.

5. **PostgreSQL Migration Losing localStorage Data** — V2 users have accumulated training history. Migration without export/import path destroys trust. Prevention: build localStorage export feature BEFORE backend, import endpoint AFTER migration, test with real user data dumps. Warning signs: migration plan doesn't mention existing data.

6. **Authentication Breaking Session Determinism** — Adding userId to session key changes hashes, breaking replay. Prevention: keep session key derivation auth-independent (`seed::sessionId`), use userId only for access control (`userId::sessionKey`). Warning signs: determinism tests fail after auth integration.

## Implications for Roadmap

Based on research, suggested phase structure prioritizes solver core (everything depends on accurate GTO), then backend infrastructure (persistence unlocks multi-device), then UI enhancements (animations add polish not core value).

### Phase 1: Solver Foundation
**Rationale:** All training value depends on accurate solver output. Mock solver worked for V2 prototype, but V3 requires real CFR+ for preflop training. Building solver first enables iterative validation and abstraction tuning before backend/UI complexity.

**Delivers:** CFR+ core algorithm with regret matching plus, card abstraction (169 canonical preflop hands), action abstraction (3-5 bet sizes), preflop range generation for common spots (RFI, vs 3bet), exploitability tracking for convergence validation.

**Addresses:** Table stakes features requiring solver (preflop training scenarios, range grid visualization), architectural requirement for hybrid solving approach (pre-computed + runtime).

**Avoids:** Pitfall 1 (regret floor error) via unit tests with hand-computed examples, Pitfall 2 (memory explosion) via abstraction-first design, Pitfall 3 (determinism) via sorted tree traversal, Pitfall 4 (card isomorphism) via canonical suit ordering.

**Research flags:** Standard CFR+ patterns well-documented. Poker-specific abstraction may need phase-level research for optimal bucket counts.

### Phase 2: Backend Infrastructure
**Rationale:** Persistence enables multi-device, multi-session history, and stats aggregation. Backend must exist before frontend can integrate. Auth enables deployment beyond localhost.

**Delivers:** Express scaffold with Helmet/CORS/Zod middleware, PostgreSQL + Prisma schema (User, Session, Decision, DailyStats), auth with next-auth + bcryptjs + JWT, migration of V2 session handlers to Express controllers with Prisma.

**Addresses:** Architecture requirement for Express backend, data persistence for statistics dashboard (7D/30D/90D filtering, performance graphs), user accounts for future deployment.

**Avoids:** Pitfall 5 (data loss) via export/import feature built during migration, Pitfall 6 (auth breaks determinism) via session key design that separates userId from seed/sessionId, moderate pitfall of transaction boundaries via Prisma transactions for multi-table operations.

**Uses:** Stack elements: Express 5.2, PostgreSQL 16, Prisma 7.3, next-auth 4.24, bcryptjs 3.0.3, Zod 4.3.6.

**Research flags:** Standard Express + Prisma patterns. Determinism preservation during migration may need validation testing.

### Phase 3: Preflop Training UI
**Rationale:** Preflop is simpler than postflop (less state, faster solving), enabling early user value. Range grid is reusable across features. Oval table UI with positions is the main training interface, not the grid.

**Delivers:** Oval table layout component with 6 positions (UTG/HJ/CO/BTN/SB/BB), preflop scenario selector (RFI/3bet/4bet, stack depth presets), 13x13 range grid modal (color-coded action frequencies, accessible via "View Ranges" button), action grading with immediate visual feedback (gray → green/red buttons), range reveal after decision.

**Addresses:** Must-have features: preflop training scenarios, 13x13 range grid display, color-coded action frequencies, immediate action grading, full range reveal post-decision. Competitive feature: Trainer Config toggles (Preflop/Flop, Cash/HU, 6max/9max, 50bb/100bb).

**Implements:** Frontend architecture components: PokerTable with positions, RangeGrid modal, ScenarioSelector, ActionPanel, FeedbackPanel.

**Avoids:** Moderate pitfall of range grid state management via Zustand or React Context, memoized cell components.

**Uses:** Stack elements: Framer Motion (hover/selection animations), CSS Grid (13x13 layout), Tailwind (color gradients for frequency heatmaps), Radix UI Tooltip (cell frequency details).

**Research flags:** Standard React patterns. Range grid performance may need optimization if 169 cells + 5 actions each cause re-render issues.

### Phase 4: Statistics Overhaul
**Rationale:** Visual progress feedback drives retention. Backend persistence from Phase 2 enables rich statistics. Graphs and weakness detection differentiate from competitors.

**Delivers:** Performance graphs (line/area charts, 7D/30D/90D/All Time filtering), per-spot-type breakdown (aggregation by position/action-history, sorted by mean EV loss), daily streak tracking (counter with date persistence), weakness detection (identify worst spot types, suggest targeted practice).

**Addresses:** Table stakes: session history, per-session summary stats, time-based filtering, aggregate totals. Differentiators: performance graphs over time, weakness detection, daily streak tracking.

**Implements:** Frontend StatsPage with PerformanceGraph (D3 or Recharts), SpotTypeBreakdown, SessionHistory. Backend StatsService with aggregation queries.

**Uses:** Stack elements: @tanstack/react-query (server state caching), date-fns (time filtering), Prisma aggregation queries (DailyStats model).

**Research flags:** Standard charting patterns. May need performance optimization for large datasets (10K+ decisions).

### Phase 5: Animated UI Polish
**Rationale:** Functional UI exists from Phases 2-3. Animations add engagement and polish but don't change core training value. Build last to avoid premature optimization.

**Delivers:** Card dealing animation (spring physics, staggered timing), chip movement to pot (layout animations), EV reveal suspense animation (delayed number display), action button highlight (smooth color transitions), feedback grade display (fade-in with scale).

**Addresses:** Competitive differentiator: animated UI for engaging experience. Improves table stakes features (action grading) with visual polish.

**Implements:** Animation architecture: coordinated animation timeline, chip movement from positions to pot, card dealing state machine.

**Avoids:** Minor pitfall of animation performance via CSS animations (GPU-accelerated) not JS, "skip animation" preference.

**Uses:** Stack elements: Framer Motion (component transitions, layout animations), Tailwind transitions (simple state changes).

**Research flags:** Standard Framer Motion patterns. Performance testing needed to ensure animations don't block training pace.

### Phase 6: Postflop Integration
**Rationale:** Postflop is significantly more complex than preflop (board cards, multiple streets, larger game tree). Deferred until solver, backend, and UI patterns are proven with preflop.

**Delivers:** Postflop scenario selection (flop textures, turn/river continuation), hybrid solving integration (pre-computed common spots, runtime subgame refinement), board card display with animation, multi-street action history, postflop range grid modal with board context.

**Addresses:** Must-have: extend oval table UI to postflop, session grading for postflop decisions. Competitive: range comparison view (Hero vs Villain overlaps).

**Implements:** Postflop game tree traversal, board abstraction (texture clustering), multi-street solver resolution, range grid with board context.

**Avoids:** Critical pitfall of solver latency (runtime solving takes seconds) via aggressive caching, loading states, pre-solved common spots. Moderate pitfall of range context ignored in abstraction via `rangeContext` in canonical node hash.

**Uses:** Stack elements: Web Workers (background solving), pre-computed strategy database (PostgreSQL JSONB or blob), solver adapter hybrid routing.

**Research flags:** NEEDS PHASE-LEVEL RESEARCH. Postflop abstraction is complex (board texture clustering, equity bucket refinement), and runtime solving performance is uncertain. Recommend `/gsd:research-phase` for postflop solving strategy before implementation.

### Phase Ordering Rationale

- **Solver first** because all training value depends on accurate GTO output. Mock solver cannot provide preflop training.
- **Backend second** because persistence is required for stats and multi-device, and Express must exist before frontend integration.
- **Preflop UI third** because it's simpler than postflop (less state, faster solving), proves UI patterns before tackling postflop complexity.
- **Statistics fourth** because it requires backend persistence and benefits from preflop training data for realistic testing.
- **Animations fifth** because they add polish to existing functional UI, not core value. Building earlier risks premature optimization.
- **Postflop last** because it's the most complex (multi-street trees, runtime solving latency, range context), and benefits from proven solver/backend/UI patterns.

This order **minimizes rework** (solver interface stable before UI builds on it), **enables incremental value** (preflop training is usable before postflop), and **defers uncertainty** (postflop solving complexity addressed after foundation is proven).

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 6 (Postflop Integration)**: Complex board abstraction, runtime solving performance characteristics, cache strategy for hybrid solving. Recommend `/gsd:research-phase` for postflop abstraction and solving approach.
- **Phase 1 (Solver Foundation)**: Optimal abstraction bucket counts (quality vs speed tradeoff), exact convergence iteration requirements for 0.1% EV accuracy. May benefit from targeted research on CFR+ performance benchmarks.

**Phases with standard patterns (skip research-phase):**
- **Phase 2 (Backend Infrastructure)**: Well-documented Express + Prisma + PostgreSQL patterns, existing V2 codebase provides clear migration path.
- **Phase 3 (Preflop Training UI)**: Standard React component patterns, CSS Grid for 13x13 layout is straightforward.
- **Phase 4 (Statistics Overhaul)**: Common charting patterns (Recharts or D3), Prisma aggregation queries well-documented.
- **Phase 5 (Animated UI Polish)**: Framer Motion has extensive documentation, animation patterns are standard React.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified via npm registry 2026-02-03. V2 codebase analysis confirms compatibility. |
| Features | MEDIUM | Based on training data (GTO Wizard, GTO Nexus, PioSolver patterns). User screenshots confirm oval table UI is primary interface, not 13x13 grid. Specific competitor features may have evolved since knowledge cutoff. |
| Architecture | MEDIUM-HIGH | CFR+ algorithm fundamentals and abstraction techniques well-documented in academic literature. V2 codebase patterns directly observable. Specific solver performance characteristics (iteration counts, memory requirements) need validation during implementation. |
| Pitfalls | MEDIUM | CFR+ regret floor error and card isomorphism are well-known solver pitfalls. Determinism preservation patterns proven in V2 codebase. Specific benchmark comparisons to PioSolver need validation. |

**Overall confidence:** MEDIUM-HIGH

Research is strong on foundational patterns (CFR+ algorithm, Express + Prisma architecture, React animation libraries) and V2 codebase analysis provides high-confidence migration path. Uncertainty exists around postflop solving performance (runtime vs pre-computed tradeoffs) and optimal abstraction granularity (bucket counts for quality/speed balance).

### Gaps to Address

**Solver performance characteristics:**
- Exact CFR+ iteration counts for 0.1% EV convergence target unknown. Recommendation: build exploitability tracking early in Phase 1, empirically determine iteration requirements via benchmarking.
- Memory requirements for full NLHE postflop game tree uncertain. Recommendation: implement aggressive abstraction and memory budget monitoring from start, measure actual footprint during Phase 6.

**Postflop solving strategy:**
- Pre-computed vs runtime solving tradeoff unclear (which spots to pre-solve, which to compute on-demand). Recommendation: conduct phase-level research during Phase 6 planning, potentially run `/gsd:research-phase` for postflop abstraction.

**Migration data integrity:**
- localStorage schema from V2 is known, but real user data shapes may have variations. Recommendation: test export/import with multiple real localStorage dumps before Phase 2 deployment.

**UI performance at scale:**
- Range grid with 169 cells + 5 actions + frequency overlays may cause re-render issues. Recommendation: build performance monitoring into Phase 3, test with large datasets, optimize if needed (memoization, virtualization).

**Animation performance:**
- Coordinated animations (card dealing + chip movement + EV reveal) may block UI on slower hardware. Recommendation: performance test on low-end hardware during Phase 5, provide "skip animation" preference if needed.

## Sources

### Primary (HIGH confidence)
- **npm registry (2026-02-03)**: All package versions verified via `npm view [package] version`. Compatibility matrix validated (Next.js 16 + React 19, Prisma 7.3 client/CLI match).
- **Existing V2 codebase**: `src/lib/engine/` (grading.ts, rng.ts, canonicalHash.ts, solverAdapter.ts), `src/lib/runtime/` (v2SessionRegistry.ts, trainingOrchestrator.ts), `src/lib/v2/` (SessionPage component). Direct analysis of determinism patterns, solver interface, session lifecycle.
- **PROJECT.md**: V3 requirements, determinism constraints, solver integration goals.
- **User screenshots**: GTO Nexus UI showing oval table as primary interface, 13x13 grid as modal, action button feedback pattern (gray → green/red).

### Secondary (MEDIUM confidence)
- **CFR+ algorithm literature**: Tammelin 2014 "Solving Large Imperfect Information Games Using CFR+" for regret flooring, convergence properties.
- **Training data on poker solver implementations**: OpenSpiel, RLCard, PokerCFR patterns for card abstraction (equity buckets, suit isomorphism), action abstraction (discrete bet sizes).
- **Training data on GTO training products**: GTO Wizard, GTO Nexus, PioSolver feature sets and UI conventions (13x13 range grid, color scheme red=raise/green=call/blue=fold, frequency percentages).
- **.kiro/specs/ev-drill-trainer/research.md**: Prior research on CFR vs MCCFR, abstraction layer design.

### Tertiary (LOW confidence, needs validation)
- **Exact solver performance benchmarks**: Specific iteration counts for convergence, memory footprint for NLHE trees. Needs empirical validation during Phase 1.
- **Postflop abstraction granularity**: Optimal bucket counts for board texture clustering, equity refinement. Needs research during Phase 6 planning.
- **Competitor feature evolution**: GTO Wizard/Nexus may have added features since training knowledge cutoff (January 2025). Recommend manual review before Phase 3 UI decisions.

---
*Research completed: 2026-02-03*
*Ready for roadmap: yes*
