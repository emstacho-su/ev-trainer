# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-03)

**Core value:** Players can practice poker decisions and receive solver-accurate EV feedback that helps them identify and fix leaks in their game.
**Current focus:** Phase 1 - Solver Core

## Current Position

Phase: 1 of 10 (Solver Core)
Plan: 5 of 7 in current phase
Status: In progress
Last activity: 2026-02-09 -- Completed 01-05-PLAN.md (Preflop CFR+ Solver)

Progress: [======-----] ~9%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 6.4 min
- Total execution time: 32 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-solver-core | 5/7 | 32 min | 6.4 min |

**Recent Trend:**
- Last 5 plans: 01-01 (5 min), 01-02 (8 min), 01-03 (12 min), 01-04 (5 min), 01-05 (6 min)
- Trend: Stable (averaging ~7 min per plan)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Solver core first (all training value depends on accurate GTO output)
- Roadmap: Backend before UI (persistence required for stats and multi-device)
- Roadmap: Preflop before postflop (simpler, proves patterns before complexity)
- 01-01: Card type uses template literal `${Rank}${Suit}` for type safety
- 01-01: Canonical suit form: high rank first, first card hearts, second hearts if suited else diamonds
- 01-01: Rank values A=0 to 2=12 (lower = higher rank)
- 01-02: Use 0.5 BB precision for rounding (standard solver practice)
- 01-02: All-in threshold 2.0 for bets, 3.0 for raises
- 01-02: Default bet sizes 33/50/75/100% pot; raise sizes 2.2/2.5/3.0x
- 01-03: CFR+ regret floor applied AFTER accumulation (critical for convergence)
- 01-03: Float64Array for numeric storage (memory efficient)
- 01-03: Threshold 1e-9 for zero-sum detection (avoids NaN)
- 01-03: InfoSetStore uses Map for O(1) lookup
- 01-04: Lazy child generation using closures with Map cache
- 01-04: Info set ID format: {player}:{hand}:{history}
- 01-04: Actions deterministically sorted for consistent enumeration
- 01-04: Standard preflop raise multiples: 2.2x, 2.5x, 3.0x
- 01-05: Alternating player updates for CFR+ traversal (standard for two-player)
- 01-05: Sample 20 hero hands x 10 villain hands per iteration for efficiency
- 01-05: Use simplified equity during iteration, precomputed table optional
- 01-05: Exploitability approximation using sum of positive regrets
- 01-05: Average strategies used for final output (converge to Nash)

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Phase 1 may need targeted research on optimal abstraction bucket counts
- Research flag: Phase 10 (Postflop) needs phase-level research before planning

## Session Continuity

Last session: 2026-02-09
Stopped at: Completed 01-05-PLAN.md
Resume file: None
