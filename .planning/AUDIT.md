# EV-Trainer Static Audit

**Date**: 2026-04-07
**Scope**: Static code and architecture review (no execution)
**Project State**: Phase 11 of 12-phase roadmap; core engine, grading, preflop training, auth, and analytics functional; mock solver in use

---

## Executive Summary

EV-Trainer is a well-architected poker training platform with strong fundamentals: deterministic engine, clean solver adapter contract, comprehensive test suite (62 files, ~10,890 lines), polished dark-theme UI with atomic component design, and working auth/stats. The project is ready for the transition from mock solver to real solver -- the primary remaining work.

**Top 3 issues by impact:**
1. No real solver integrated -- the mock solver produces synthetic data, making the app a UI demo rather than a training tool
2. `sessionHandlers.ts` (665 lines) is the largest tech debt concentration -- mixed concerns, unsafe casts, no atomicity
3. Several planned features (postflop training, animations, targeted drilling) are not started despite being in the roadmap

---

## Dimension 1: Code Quality / Tech Debt

### Oversized Files

Two files significantly exceed the 400-line target:

- **`src/lib/v2/api/sessionHandlers.ts`** (665 lines) -- The largest non-page file. Mixes request validation, business logic, DB persistence, and response formatting in 4 handler functions. `handleStart()` alone is 81 lines; `handleSubmit()` is 65 lines. Should be decomposed into validation, orchestration, and response layers.

- **`src/app/training/page.tsx`** (799 lines) -- The core training page manages session state, keyboard shortcuts, config dialog, spot rendering, action submission, and feedback display in a single component. Should extract custom hooks and sub-components.

### Unsafe Type Casts

`src/lib/v2/api/sessionHandlers.ts` contains the worst offenders:
- Line 544: `spotValue as unknown as Spot` -- double cast bypasses type safety entirely
- Lines 556, 580: `actionId as ActionId` -- casts after string validation instead of using type narrowing
- Line 386: `input.packId as string | undefined` -- cast after typeof check

**Why this matters**: These casts hide type errors at compile time. A real solver returning different shapes would silently pass these checks.

### Hardcoded Values

- `src/lib/v2/api/sessionHandlers.ts:245` -- `"ev-dev-pack-v1"` default packId baked into handler
- `src/lib/v2/api/sessionHandlers.ts:371` -- `{ epsilon: 0.01, gradeBy: "evLossVsBest" }` grading config hardcoded
- `src/lib/v2/api/sessionHandlers.ts:250,264` -- hash digest slicing with magic number `24`
- `src/lib/engine/mockSolver.ts:25-27` -- magic number ranges for frequencies (`0.2 + ((seed % 61) / 100)`) and EVs (`(seed % 2001 - 1000) / 100`) with no documentation

### Epsilon Inconsistency

- `src/lib/engine/grading.ts` uses `DEFAULT_EPS = 1e-9` for numeric stability
- `src/lib/engine/solverAdapter.ts` uses `FREQ_EPS = 1e-4` for frequency validation

These serve different purposes but the 5-order-of-magnitude difference is undocumented. A real solver with frequencies at 1e-6 precision would pass grading but fail adapter validation.

### No Atomicity in DB Writes

`src/lib/v2/api/sessionHandlers.ts:417-427` performs multiple sequential Supabase writes (session creation, entry insertion, stats update) without transactions. If any write fails mid-sequence, state becomes inconsistent with no rollback mechanism.

### Brittle Error Handling

`src/lib/v2/api/sessionHandlers.ts:483` catches errors and matches on the error message string (`error.message.includes(...)`) instead of using typed error classes or error codes. 20+ `errorResult()` calls with similar boilerplate could be replaced with error middleware.

### Actionable Next Steps

1. Extract `sessionHandlers.ts` into: `sessionValidation.ts`, `sessionOrchestrator.ts`, `sessionResponse.ts`
2. Replace unsafe casts with Zod schema validation (Zod v4 already a dependency)
3. Move magic values to `src/lib/engine/constants.ts` or config
4. Document epsilon values or unify them
5. Wrap multi-step DB writes in Supabase RPC transactions
6. Introduce typed error classes replacing string matching

---

## Dimension 2: Architecture / Scalability Readiness

### Current Architecture

```
React UI (Next.js App Router)
    ↓
API Routes (/api/session/*)
    ↓
V2 Session Handlers (business logic)
    ↓
Engine Layer (grading, RNG, solver adapter)
    ↓
Mock Solver ← needs replacement
    ↓
Three-layer storage: in-memory sessionStore + Supabase + localStorage
```

### Strengths

- **Solver adapter pattern** (`src/lib/engine/solverAdapter.ts`): Clean `SolverNodeOutput` contract with runtime validation. Solver-agnostic grading. This is the right abstraction for swapping in a real solver.
- **Canonical node hashing** (`src/lib/engine/canonicalHash.ts`): Deterministic hashing of game states enables solver output caching. Order-insensitive for board cards, order-sensitive for action history.
- **Deterministic engine**: Seeded RNG (`src/lib/engine/rng.ts`) ensures reproducible sessions. Mulberry32 PRNG + FNV-1a hashing is well-tested.
- **Clean layer separation**: Engine -> Runtime -> V2 API -> HTTP Routes -> React UI. Each layer is independently testable.

### Bottlenecks

1. **In-memory session store** (`src/lib/v2/sessionStore.ts`): All active sessions live in process memory. No persistence across server restarts. Cannot horizontally scale. A single serverless function restart loses all active sessions.

2. **Fire-and-forget Supabase writes**: DB writes in session handlers don't await confirmation or handle failures. Silent data loss is possible on Supabase errors or network issues.

3. **No solver output cache**: `src/lib/engine/nodeCache.ts` exists but is in-memory only. Real solver calls (seconds per solve) need persistent caching by canonical hash. Without this, the same spot solved twice wastes computation.

4. **No rate limiting server-side**: Guest limiting exists (`src/lib/v2/guestLimiting.ts`) but is client-side. No middleware protects API routes from abuse.

5. **No async job infrastructure**: Real solver computation can take seconds to minutes. No queue, Web Worker pool, or background job system exists.

6. **REPLICA IDENTITY FULL on training_sessions** (`supabase/migrations/001_initial_schema.sql`): Enables Supabase Realtime but adds write amplification overhead on every UPDATE. Evaluate if Realtime is actually used.

### Actionable Next Steps

1. Move session store to Supabase or Redis for persistence across restarts
2. Add error handling and retry logic for Supabase writes
3. Implement two-tier solver cache: IndexedDB (client) + Supabase table (server)
4. Add server-side rate limiting via Next.js middleware
5. Design async solver pattern: WASM Web Workers (client) or server queue
6. Evaluate whether REPLICA IDENTITY FULL is needed

---

## Dimension 3: Feature Completeness vs. Roadmap

Assessed against `.planning/ROADMAP.md` (12 phases):

| Phase | Name | Status | Evidence |
|-------|------|--------|----------|
| 1 | Solver Core | **Complete** | All 7 plans checked. CFR+ in `src/lib/solver/` with 10 test files. Card/action abstraction, game tree, convergence tests. |
| 2 | Backend Foundation | **Complete** | All 4 plans checked. Express server in `src/server/`, Supabase schema deployed. AWS deployment deferred. |
| 3 | Authentication | **Complete** | All 5 plans checked. Supabase Auth with email + OAuth. Login/signup pages, RLS policies, profile trigger. |
| 4 | Table UI Foundation | **Complete** | All 6 plans checked. PokerTable organism, atomic components, dark theme, responsive 6max/9max. |
| 5 | Preflop Training | **Complete** | All 7 plans checked. Full training loop functional. 2 minor issues deferred (keyboard shortcuts, info bar metrics). |
| 6 | Trainer Configuration | **Complete** | All 6 plans checked. ConfigDialog, filters, lobby, drill suggestions. |
| 7 | Range Visualization | **Complete** | All 5 plans checked. RangeGridView, EquityTable, RangeGridModal, ActionLegend. |
| 8 | Statistics & Analytics | **Complete** | All 9 plans checked. Stats dashboard, PerformanceChart, PositionHeatmap, SessionHistory, FlaggedHands. |
| 9 | Animations | **Not Started** | All 7 plans unchecked. Motion library is a dependency and some basic animations exist (AnimatedCard, ActionButton pulse), but the systematic animation phase is not started. |
| 10 | Postflop Training | **Not Started** | All 7 plans unchecked. PostflopTrainingSession component exists. Postflop reducer and board texture classification have tests. But full flow is incomplete. |
| 11 | Supabase Database Integration | **Partially Complete** | 9/12 plans checked. Core migration done. 3 gap closures remain: OAuth diagnostics (11-10), folded positions in spot data (11-11), session summary error + stats alignment (11-12). |
| 12 | Dashboard & Training Config Popout | **Partially Complete** | Plans unchecked in roadmap, but implementation exists: dashboard at `/` with training card + drill suggestions, TrainingConfigDialog using native `<dialog>`, training page at `/training`. Roadmap not updated to reflect work done. |

### Deferred Features

- **DRIL-01 to DRIL-04** (Targeted Drilling): Position matchup drills, weak spot identification, quick-drill buttons -- not implemented
- **POST-01 to POST-06** (Postflop Training): Multi-street progression, flop/turn/river decisions -- in progress but incomplete
- **ANIM-01 to ANIM-07** (Animations): Card dealing, chip movement, EV reveal, street transitions -- not started as a systematic phase
- **Known deferred from Phase 5**: Keyboard shortcuts (Tests 11-12), info bar metrics (Test 13)

---

## Dimension 4: Solver Integration Readiness

### What's Ready

1. **`src/lib/engine/solverAdapter.ts`** (115 lines): Well-defined `SolverNodeOutput` interface with `actions[]` (actionId, frequency, ev), status, units, exploitability. `validateSolverNodeOutput()` checks frequency sum, finite numbers, unique action IDs. This contract works for any solver.

2. **`src/lib/engine/grading.ts`** (98 lines): Solver-agnostic. Takes `SolverNodeOutput` + user action, computes `evLossVsBest`, `evLossVsMix`, `evUser`, `evMix`, `evBest`. No coupling to mock-specific behavior.

3. **`src/lib/engine/canonicalHash.ts`**: Deterministic hashing of game nodes (board, positions, history, stacks). Essential for caching solver output. Order-insensitive for board cards, case-insensitive.

4. **`src/lib/engine/solverResolver.ts`**: Abstracts solver resolution -- can swap the underlying implementation without changing callers.

5. **`src/lib/solver/`** directory: A full CFR+ implementation with game tree builder, info sets, card/action abstraction, equity calculation, and convergence tests. This custom solver could serve as a fallback or validation reference.

### What Needs to Change

1. **Synchronous solver interface**: `mockSolve()` in `src/lib/engine/mockSolver.ts` is synchronous. A real solver (WASM or server-side) will be async. The adapter contract needs `async solve(): Promise<SolverNodeOutput>`.

2. **Fixed 2-action assumption**: The mock always returns CHECK + BET_75PCT. While the grading pipeline handles variable action counts, UI components (`src/components/poker/organisms/ActionPanel.tsx`, `src/components/poker/molecules/ActionButton.tsx`) should be audited for hardcoded action count assumptions.

3. **No solver configuration**: `SolverRequest` exists but doesn't specify bet sizing trees, player ranges, iteration count, or exploitability targets that a real solver needs.

4. **No persistent solver cache**: `src/lib/engine/nodeCache.ts` is in-memory LRU only. Real solver output (expensive to compute) needs persistent caching in IndexedDB (client) or Supabase (server).

5. **No preflop/postflop routing**: The adapter doesn't distinguish between preflop spots (which should use precomputed ranges) and postflop spots (which need live solving).

6. **No progress/loading pattern**: Long solver computations need progress callbacks and UI loading states.

### Actionable Next Steps

1. Make solver adapter async: `solve(request: SolverRequest): Promise<SolverNodeOutput>`
2. Add solver configuration to `SolverRequest` (bet tree, ranges, iterations, exploitability target)
3. Add preflop/postflop discriminator to route to correct adapter
4. Implement persistent solver cache (IndexedDB + Supabase table)
5. Audit UI components for fixed action count assumptions
6. Add loading/progress states for async solver calls
7. See `SOLVER-COMPARISON.md` for recommended solver and integration architecture

---

## Dimension 5: Test Coverage Gaps

### Strong Coverage (62 test files, ~10,890 lines)

| Area | Files | Quality |
|------|-------|---------|
| Determinism | 4 dedicated files | Comprehensive: seed replay, negative controls, distribution validation |
| Engine (grading, actions, filters) | 28 files | Thorough: golden outputs, edge cases, validation errors |
| Solver (CFR, game tree, abstraction) | 10 files | Good: convergence tests, Nash equilibrium, equity calculations |
| Session lifecycle | 7 integration tests | Strong: full start->submit->next->complete->review flows |
| Storage | storageRoundTrip.test.ts | Corruption resilience, quota handling, round-trip serialization |
| V2 layer | 10 files | Good: session store, spot source, filters, config, guest limiting |

### Critical Gaps

1. **No Supabase integration tests**: All DB interactions are mocked via `vi.mock()`. No tests verify actual Postgres behavior, RLS policy enforcement, or trigger execution. The `supabase/migrations/` SQL is untested against a real database.

2. **No authentication flow tests**: Login, signup, OAuth redirect, session refresh, token expiry -- all untested. `src/app/login/page.tsx` and `src/app/signup/page.tsx` have zero test coverage.

3. **Minimal UI component tests**: 52 React components, but only `uiSmokeCoreLoop.test.ts` (1 test case) and `src/lib/ui/trainingUi.test.ts` (160 lines) provide coverage. PokerTable, ActionPanel, StatsPage, RangeGridView -- all untested.

4. **No E2E tests**: No Playwright or Cypress configuration. Critical user flows (start training -> make decisions -> review stats) have no end-to-end verification.

5. **No error recovery tests**: Network failures, Supabase timeouts, partial state corruption during multi-step writes -- not tested.

6. **No postflop integration tests**: `src/__tests__/postflopLifecycle.test.ts` exists (142 lines, 2 tests) but covers only basic filtering, not the full postflop training flow.

7. **Real solver integration untested**: All solver tests use mocks or the custom CFR. No tests validate integration with an external solver's actual output format.

### Actionable Next Steps

1. Add Supabase integration tests using `supabase start` (local Supabase instance)
2. Add auth flow tests (signup, login, OAuth, session refresh, token expiry)
3. Add component tests for PokerTable, ActionPanel, StatsPage, RangeGridView
4. Set up Playwright for E2E: training session flow, stats review, login/signup
5. Add error scenario tests (network failure, solver timeout, corrupt state)
6. Add solver output contract tests that validate real solver output against `SolverNodeOutput`

---

## Dimension 6: UI/UX State

### Overall Assessment: 8/10 Polish

The UI is significantly above prototype quality. Dark theme is consistent, animations are purposeful, component architecture is clean (atomic design), and the core training loop feels polished.

### Polished and Complete

- **PokerTable** (`src/components/poker/organisms/PokerTable.tsx`): Elliptical positioning math, Z-indexing, 6max/9max variants. Professional look.
- **ActionButton** (`src/components/poker/molecules/ActionButton.tsx`): Motion animations with EV reveal, frequency bars, pulse on selection. Smooth and informative.
- **Dark theme** (`src/app/globals.css`): Custom CSS variables using okLCH color space. Poker-specific action colors (call, raise, fold, jam). Consistent across all pages.
- **Stats dashboard** (`src/app/stats/page.tsx`): Tabbed interface, Recharts integration, skeleton loading states, filter bar. Production-quality.
- **Auth pages** (`src/app/login/page.tsx`, `src/app/signup/page.tsx`): OAuth + email, validation, error handling. Complete flows.
- **TrainingConfigDialog**: Native `<dialog>` element with backdrop click, ESC key, focus trapping. Modern HTML API usage.
- **Shadcn/Radix** foundation: CVA button variants, Radix popover, React Day Picker. Accessible by default.

### Needs Attention

1. **Placeholder pages**: `lobby/page.tsx`, `review/[id]/page.tsx`, `summary/[id]/page.tsx`, `setup/[mode]/page.tsx`, `table-ui-demo/page.tsx` are stubs or minimal implementations. These routes exist in the app but deliver incomplete experiences.

2. **Postflop training UI**: `src/components/training/PostflopTrainingSession.tsx` and `src/components/poker/molecules/StreetActionPanel.tsx` exist but the flow is incomplete. No multi-street progression in the UI.

3. **Range visualization disconnected**: `src/components/range/RangeGridView.tsx`, `EquityTable.tsx` exist and render correctly but are fed mock data, not real solver ranges.

4. **Debug logging in production**: OAuth pages contain `console.log('[OAuth]')` statements that should be removed or replaced with a logging service.

5. **Duplicate component**: `src/components/training/PreflopTrainingSession-EvansLenovo.tsx` appears to be a machine-specific copy of `PreflopTrainingSession.tsx`. Should be deleted.

6. **No onboarding flow**: New users land on the dashboard with no tutorial, guided walkthrough, or explanation of EV grading. For a portfolio piece targeting new players learning GTO, this is a gap.

7. **No user settings page**: Animation speed, sound preferences, theme toggle, account management -- no settings UI exists.

8. **Mobile poker table**: Responsive but the elliptical table layout on small screens could be optimized. Cards and chips may overlap at narrow widths.

### Actionable Next Steps

1. Implement or remove placeholder pages (review, summary, setup)
2. Complete postflop training UI flow
3. Connect range visualization to solver output (post solver integration)
4. Remove console.log debug statements
5. Delete duplicate `PreflopTrainingSession-EvansLenovo.tsx`
6. Add onboarding/tutorial for new users (tooltip walkthrough or guided first session)
7. Add user settings page
8. Test and optimize mobile poker table layout

---

## Dimension 7: Database Schema / Data Model

### Current Schema (3 migrations, 6 tables)

From `supabase/migrations/001_initial_schema.sql`:

| Table | Purpose | Rows (est.) |
|-------|---------|-------------|
| profiles | User profiles (extends auth.users) | 1 per user |
| spots | Practice spot library | ~500 system spots |
| training_sessions | Session records | ~10 per user per day |
| session_entries | Individual decisions | ~10 per session |
| daily_stats | Pre-aggregated daily performance | 1 per user per day |
| spot_stats | Per-spot performance tracking | 1 per user per spot |

### Strengths

- **RLS policies** (`supabase/migrations/002_rls_policies.sql`): All 6 tables have RLS enabled. Uses `(SELECT auth.uid())` subquery pattern for query planner caching (significant performance improvement over direct `auth.uid()` calls).
- **Smart indexing**: GIN index on `spots.tags`, composite indexes on `(user_id, created_at)`, partial index on flagged entries.
- **Automatic triggers** (`supabase/migrations/003_triggers_functions.sql`): `handle_new_user()` creates profile on signup. `update_updated_at()` on 4 tables.
- **Spot sharing**: `share_code` UNIQUE on spots enables sharing without exposing internal IDs.

### Issues and Gaps

1. **No solver output storage**: No table for caching solved node outputs. Every solver call must recompute. Need a `solver_cache` table keyed by canonical hash with columns for solver output (JSONB), iteration count, exploitability, bet tree config, and timestamps.

2. **JSONB fields not queryable**: `training_sessions.filters`, `session_entries.result`, `session_entries.spot`, `spots.stacks_bb` are JSONB without GIN indexes. Analytical queries filtering by these fields require full table scans.

3. **No auto-aggregation**: `daily_stats` and `spot_stats` have no trigger or function to auto-aggregate from `session_entries`. Application code must compute and insert these, creating consistency risk.

4. **Missing tables for planned features**:
   - `solver_cache` -- persistent solver output by canonical hash
   - `user_ranges` -- custom range storage for user-defined training scenarios
   - `drill_templates` -- targeted drilling configuration
   - No leaderboard, achievement, or progress milestone tables

5. **session_entries.result is untyped JSONB**: Stores the full `DecisionGrade` object but has no CHECK constraint validating the shape. Corrupt inserts would be silently accepted.

6. **No composite index on session_entries for action queries**: Missing `(session_id, action_id)` index for queries like "show all FOLD decisions in this session."

7. **spots.share_code has no expiry**: UNIQUE constraint but no TTL or access control beyond existence. Stale share codes accumulate indefinitely.

8. **REPLICA IDENTITY FULL on training_sessions**: Adds write overhead for every UPDATE. Needed for Supabase Realtime cross-tab sync, but evaluate if this feature is actually used.

### Actionable Next Steps

1. Add `solver_cache` table: `(id, canonical_hash UNIQUE, bet_tree_config, solver_output JSONB, iterations INT, exploitability NUMERIC, created_at, accessed_at)`
2. Add GIN indexes on `session_entries.result`, `training_sessions.filters` for analytical queries
3. Add aggregation trigger: on `session_entries` INSERT, update corresponding `daily_stats` and `spot_stats`
4. Add CHECK constraint on `session_entries.result` JSONB shape
5. Add `(session_id, action_id)` composite index on `session_entries`
6. Plan `user_ranges` and `drill_templates` tables for future features
7. Evaluate REPLICA IDENTITY FULL necessity

---

## Project Restructure Proposal

### Artifacts to Remove

| Path | Reason | Action |
|------|--------|--------|
| `.kiro/` (20 files) | Legacy Kiro spec tracking. Not used by Claude Code. Contains 4 spec folders with design/requirements/tasks from an earlier workflow. | Archive to `.archive/kiro/` then delete |
| `.planning/phases/` (~50 files) | Detailed per-phase plans from completed phases 1-8. These are historical records, not active planning docs. Phases 9-12 plans are still relevant. | Archive completed phases (01-08) to `.archive/phases/`. Keep 09-12 in `.planning/phases/`. |
| `promptfoo/` | Prompt evaluation tooling. Not part of the training app. | Remove or move to a separate repo |
| `terraform/` | Infrastructure-as-code. Premature for current stage (no deployment target). | Archive to `.archive/terraform/` |
| `ecosystem.config.js` | PM2 process management config. Not needed for Next.js deployment. | Delete |
| `docker-compose.yml` | Docker config. Evaluate if used for local Supabase dev; if not, delete. | Keep if used for `supabase start`, else delete |
| `src/components/training/PreflopTrainingSession-EvansLenovo.tsx` | Duplicate/machine-specific copy of PreflopTrainingSession. | Delete |
| `src/server/` | Express server from Phase 2, superseded by Supabase + Next.js API routes in Phase 11. | Archive to `.archive/express-server/` |
| `.planning/v3-MILESTONE-AUDIT.md` | Previous audit, superseded by this document. | Archive to `.archive/` |

### Artifacts to Keep

| Path | Reason |
|------|--------|
| `.planning/PROJECT.md` | Project overview and context |
| `.planning/REQUIREMENTS.md` | Requirements traceability matrix |
| `.planning/ROADMAP.md` | Phase definitions and status tracking |
| `.planning/STATE.md` | Current state tracking |
| `.planning/AUDIT.md` | This document |
| `.planning/SOLVER-COMPARISON.md` | Solver research |
| `.planning/codebase/` | Architecture, conventions, stack documentation |
| `.planning/research/` | Research documents |
| `AGENTS.md` | Workflow constraints |

### Proposed Directory Layout

```
ev-trainer/
├── .archive/                         # Archived artifacts (gitignored)
│   ├── kiro/                         # Former .kiro/ specs
│   ├── phases/                       # Completed phase plans (01-08)
│   ├── terraform/                    # Premature IaC
│   ├── express-server/               # Former src/server/
│   └── v3-MILESTONE-AUDIT.md         # Previous audit
├── .planning/
│   ├── AUDIT.md                      # This document
│   ├── SOLVER-COMPARISON.md          # Solver research & recommendation
│   ├── PROJECT.md                    # Project overview
│   ├── REQUIREMENTS.md               # Requirements matrix
│   ├── ROADMAP.md                    # Phase tracking
│   ├── STATE.md                      # Current state
│   ├── SPRINT-ROADMAP.md             # NEW: upcoming sprint plan
│   ├── codebase/                     # Architecture docs (7 files)
│   ├── phases/                       # Active phase plans only (09-12)
│   └── research/                     # Research documents
├── public/
│   ├── audio/                        # Sound effects
│   └── packs/                        # Bundled spot pack JSON
├── scripts/                          # Utility scripts (seed, etc.)
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── api/                      # API routes
│   │   ├── training/                 # Core training page
│   │   ├── stats/                    # Stats dashboard
│   │   ├── login/                    # Auth pages
│   │   ├── signup/
│   │   └── ...
│   ├── components/                   # React components
│   │   ├── config/                   # Configuration UI (11)
│   │   ├── poker/                    # Poker visuals (18)
│   │   │   ├── atoms/               # Card, Chip, DealerButton
│   │   │   ├── molecules/           # ActionButton, PlayerSeat, etc.
│   │   │   └── organisms/           # PokerTable, ActionPanel
│   │   ├── range/                    # Range visualization (5)
│   │   ├── stats/                    # Stats components (8)
│   │   ├── training/                 # Training orchestrators
│   │   └── ui/                       # Shadcn base components
│   ├── hooks/                        # Custom React hooks
│   ├── lib/
│   │   ├── engine/                   # Core game engine (45 files)
│   │   ├── solver/                   # CFR solver implementation
│   │   ├── postflop/                 # Postflop logic
│   │   ├── aggregates/              # Statistics computation
│   │   ├── runtime/                  # App bridge layer
│   │   ├── v2/                       # Active application layer
│   │   └── ui/                       # UI utilities
│   └── __tests__/                    # Integration tests
├── supabase/
│   └── migrations/                   # Database schema (3 files)
├── AGENTS.md                         # Workflow constraints
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

**Key changes:**
- `.kiro/` removed (20 files)
- Completed phase plans archived (50+ files)
- `terraform/`, `ecosystem.config.js`, `promptfoo/` removed
- Express server archived (superseded by Supabase)
- Duplicate component deleted
- `.archive/` added for historical reference (can be gitignored)
- `.planning/` streamlined to active documents only

---

## Phase Ordering Recommendation

Based on dependency analysis and impact assessment. The end goal is: real solver integration, postflop training, polished UI, production deployment.

### Dependency Graph

```
Cleanup (P0) ─────────────────────────────────────────┐
    ↓                                                  │
Solver Integration (P1) ──→ Postflop Training (P4)     │
    ↓                            ↓                     │
Preflop Ranges (P2)        Range Visualization (P5)    │
    ↓                            ↓                     │
DB Schema + Cache (P3) ──→ Config Wiring (P6)          │
                                 ↓                     │
                           UI Polish (P7) ←────────────┘
                                 ↓
                           Testing (P8)
                                 ↓
                           Deployment (P9)
```

### Recommended Phase Order

1. **Project Cleanup & Restructure**
   - Remove `.kiro/`, archive completed phases, delete dead artifacts
   - Close Phase 11 gap closures (11-10, 11-11, 11-12)
   - Delete duplicate component, remove console.log debug statements
   - **Why first**: Clean workspace reduces cognitive load. Gap closures fix known bugs. Zero dependency on other phases.

2. **Postflop Solver Integration (WASM)**
   - Fork `b-inary/postflop-solver` and `wasm-postflop`
   - Build WASM modules in project build pipeline (Rust + wasm-pack)
   - Create `PostflopSolverAdapter` implementing async `SolverNodeOutput`
   - Add Web Worker pool for WASM solver execution
   - Add IndexedDB caching layer keyed by canonical hash
   - **Why second**: All training value depends on real solver output. This is the highest-impact change. Unblocks postflop training, range visualization, and config wiring.

3. **Preflop Range Database**
   - Precompute preflop ranges using existing `src/lib/solver/` CFR or external tool
   - Store as JSON in bundled packs or dedicated database table
   - Create `PreflopRangeAdapter` serving precomputed ranges through `SolverNodeOutput`
   - **Why third**: Preflop is simpler (precomputed, not live-solved). Completes the full solver coverage (preflop + postflop). Depends on adapter contract from Phase 2.

4. **Database Schema & Solver Cache**
   - Add `solver_cache` table for persistent solver output
   - Add GIN indexes on JSONB fields
   - Add auto-aggregation triggers for `daily_stats`/`spot_stats`
   - Add `user_ranges` table for custom range storage
   - **Why fourth**: Solver cache reduces computation. Schema changes support features in phases 5-7. Depends on solver output format being finalized in Phases 2-3.

5. **Postflop Training Completion**
   - Complete PostflopTrainingSession flow (multi-street progression)
   - Implement flop/turn/river decision points with real solver grading
   - Add StreetActionPanel with dynamic bet sizing from solver
   - Add board texture context labels
   - **Why fifth**: Core feature that depends on real solver (Phase 2). Defines what "complete" looks like for the product.

6. **Range Visualization Connected**
   - Wire RangeGridView to real solver action frequencies
   - Connect EquityTable to solver equity data
   - Add hero/villain range comparison in range modal
   - **Why sixth**: Depends on real solver output. Enhances training value significantly. Components already exist, just need real data.

7. **Trainer Configuration & Targeted Drilling**
   - Wire remaining config options (stack depth, bet tree selection)
   - Implement DRIL-01 to DRIL-04 (position matchup drills, weak spot ID)
   - Connect drill suggestions to stats-identified weaknesses
   - **Why seventh**: Configuration is meaningful only with real solver. Drilling depends on having enough solver-backed spots.

8. **UI Polish & Missing Pages**
   - Complete or remove placeholder pages (review, summary, setup)
   - Add onboarding/tutorial flow for new users
   - Add user settings page
   - Implement Phase 9 animations (systematic)
   - Optimize mobile poker table layout
   - **Why eighth**: Polish after substance. Animations and onboarding are important for portfolio quality but don't affect core functionality.

9. **Testing Hardening**
   - Add Supabase integration tests (local instance)
   - Add auth flow tests
   - Add component tests for key UI
   - Set up Playwright E2E for critical flows
   - Add solver output contract tests
   - Target 80%+ coverage across all layers
   - **Why ninth**: Comprehensive tests after features are stable. Testing against moving targets wastes effort. But must precede deployment.

10. **Production Deployment**
    - Configure Vercel deployment (Next.js native)
    - Set up environment variables and secrets
    - Configure CI/CD pipeline (build, test, deploy)
    - Add monitoring and error tracking
    - Performance optimization (bundle size, solver loading)
    - **Why last**: Deploy a complete, tested product. All prior phases must be stable.

### Sprint Estimate

Phases 1-3 are the critical path. Phase 1 is mechanical cleanup (1-2 sessions). Phases 2-3 are the highest-risk, highest-value work (solver integration). Phases 4-7 build on the solver foundation. Phases 8-10 are polish and hardening.

The sprint roadmap should be developed as a separate document (`.planning/SPRINT-ROADMAP.md`) once the solver integration approach from `SOLVER-COMPARISON.md` is confirmed.
