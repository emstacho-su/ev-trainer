# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-03)

**Core value:** Players can practice poker decisions and receive solver-accurate EV feedback that helps them identify and fix leaks in their game.
**Current focus:** Phase 3 - Authentication

## Current Position

Phase: 3 of 10 (Authentication)
Plan: 5 of 5 in Phase 3
Status: Phase complete
Last activity: 2026-02-10 -- Completed 03-05-PLAN.md

Progress: [█████████░░░░░░░] ~30% (3 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 8.6 min
- Total execution time: 135 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-solver-core | 7/7 ✓ | 72 min | 10.3 min |
| 02-backend-foundation | 4/4 ✓ | 48 min | 12.0 min |
| 03-authentication | 5/5 ✓ | 15 min | 3.0 min |

**Recent Trend:**
- Last 5 plans: 03-01 (3 min), 03-02 (3 min), 03-03 (2 min), 03-04 (3 min), 03-05 (4 min)
- Trend: Phase 3 complete, all plans under 4 min (foundation patterns well established)

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
- 01-06: 50 iterations for E[HS] Monte Carlo (balance speed vs accuracy)
- 01-06: 5 hand samples per CFR+ iteration for postflop (tractable complexity)
- 01-06: 50 default buckets for E[HS] with uniform distribution (standard)
- 01-06: Postflop info set ID: {player}:B{bucket}:{board}:{history}
- 01-07: JSON format for PioSolver reference solutions (portable)
- 01-07: 0.1% EV tolerance (0.001 bb) for benchmark validation
- 01-07: Mock solver for testing validation infrastructure independently
- 02-01: Prisma 7.x datasource URL in prisma.config.ts, not schema.prisma
- 02-01: Connection pool max 20, 30s idle timeout, 2s connect timeout
- 02-01: Singleton pattern with globalThis caching for development hot-reload
- 02-01: JSON fields for Spot and DecisionGrade storage
- 02-02: Express 5.x native async (no express-async-errors needed)
- 02-02: SessionStoreBackend uses Promise for all methods (future Prisma swap)
- 02-02: tsx instead of ts-node for TypeScript execution (ESM compatibility)
- 02-02: Zod 4.x z.record(key, value) two-argument syntax
- 02-03: Prisma.JsonNull for explicit null handling in nullable JSON fields
- 02-03: Transaction for atomic session upsert + entry delete/recreate
- 02-03: Entries ordered by index on retrieval (orderBy: { index: "asc" })
- 02-03: setSessionStoreBackend() at server startup for backend swap
- 02-04: AWS deployment deferred until product tangible (cost savings)
- 02-04: Terraform, PM2, GitHub Actions files created and ready
- 03-01: Argon2id for password hashing (64 MB memory, 3 time cost, 4 parallelism)
- 03-01: jose library for JWT (ESM-native, Edge-compatible)
- 03-01: 15-minute access tokens, 7-day refresh tokens
- 03-01: SHA-256 hashing for all tokens before database storage
- 03-01: Verification tokens 24h, password reset tokens 1h
- 03-02: Refresh token rotation on every refresh (security)
- 03-02: Multi-device support with multiple refresh tokens per user
- 03-02: Cookie path restricted to /api/auth
- 03-02: Auth rate limiting 20 req/15min (stricter than general 100 req/15min)
- 03-02: Email enumeration prevention (same error for no user vs wrong password)
- 03-02: Email normalized to lowercase
- 03-03: Resend for email with dev mode fallback (logs to console)
- 03-03: Background email sending (doesn't block registration/password reset)
- 03-03: 24h email verification tokens, 1h password reset tokens
- 03-03: Password reset revokes all refresh tokens (force re-login)
- 03-03: Atomic transactions for verification and password reset operations
- 03-04: Access token passed to frontend via URL fragment (# not sent to server)
- 03-04: State parameter in httpOnly cookie for CSRF protection in OAuth
- 03-04: OAuth users get emailVerified set automatically (provider verified)
- 03-04: Account linking by email (OAuth links to existing user if email matches)
- 03-04: No rate limiting on OAuth routes (external redirects, one-time callbacks)
- 03-05: optionalAuth for session lifecycle (guests allowed, userId attached if logged in)
- 03-05: requireAuth for session history endpoint (401 without token)
- 03-05: Session ownership enforcement (403 if userId mismatch)
- 03-05: Sessions link to userId for cross-device sync, null for guest sessions

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Phase 1 may need targeted research on optimal abstraction bucket counts
- Research flag: Phase 10 (Postflop) needs phase-level research before planning

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 03-05-PLAN.md (Phase 3 complete - all 5 plans done)
Resume file: None
Next: /gsd:execute-phase 4 (Begin Phase 4 - Frontend Foundation)
