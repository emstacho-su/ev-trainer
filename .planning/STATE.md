# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-03)

**Core value:** Players can practice poker decisions and receive solver-accurate EV feedback that helps them identify and fix leaks in their game.
**Current focus:** Phase 8 - Statistics & Analytics / Phase 9 - Animations (parallel)

## Current Position

Phase: 8 of 10 (Statistics & Analytics) / Phase 9 (Animations) in parallel
Plan: 08-03 complete, Phase 8 (08-01/02/03/04/05 done) and Phase 9 in progress
Status: In progress
Last activity: 2026-02-17 -- Completed 08-03 performance chart

Progress: [███████████████░] ~88% (53 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 42
- Average duration: 5.9 min
- Total execution time: 244 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-solver-core | 7/7 ✓ | 72 min | 10.3 min |
| 02-backend-foundation | 4/4 ✓ | 48 min | 12.0 min |
| 03-authentication | 5/5 ✓ | 15 min | 3.0 min |
| 04-table-ui-foundation | 6/6 ✓ | 65 min | 10.8 min |
| 05-preflop-training | 7/7 ✓ | 14 min | 2.0 min |

**Recent Trend:**
- Last 5 plans: 06-04 (2 min), 06-05 (5 min), 07-03 (2 min), 07-04 (2 min), 07-05 (2 min)
- Trend: Phase 7 plans fast (component composition, no new infrastructure)

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
- 04-01: HSL color values space-separated (no commas) for Tailwind v4 compatibility
- 04-01: defaultTheme set to 'dark' for poker aesthetic
- 04-01: Poker-specific CSS tokens: --table-surface, --table-border, --chip-stack, --dealer-button, --action-positive/negative
- 04-01: suppressHydrationWarning on html tag prevents theme flash warning
- 04-02: Unicode suit symbols (♥ ♦ ♣ ♠) for cards instead of custom SVG icons
- 04-02: Size variant system sm/md/lg with explicit pixel dimensions per component
- 04-02: Theme-aware styling via hsl(var(--custom-property)) in Tailwind arbitrary values
- 04-03: PlayerSeat supports 6-max and 9-max positions via union type
- 04-03: Hero seats use pulsing blue border (isHero prop) for visual distinction
- 04-03: showCards prop controls face-up (hero) vs face-down (villain) card display
- 04-03: Folded seats dim with opacity-40 for clear visual state
- 04-03: CommunityCards returns null when empty (preflop state)
- 04-03: All BB amounts display with 1 decimal precision (toFixed(1))
- 04-04: 5-state machine for ActionButton (idle, disabled, selected, revealed-correct, revealed-incorrect)
- 04-04: EV feedback displays only in revealed states with BB format (+X.XX BB)
- 04-04: Frequency bar as horizontal progress indicator with percentage label
- 04-04: Button disabled in revealed states to prevent re-clicks after feedback
- 04-05: PokerTable defaults to 6-max with optional 9-max via tableSize prop
- 04-05: Seat positions percentage-based for responsive scaling
- 04-05: Dealer button positioned with offset maps separate from seat positions
- 04-05: Z-index layering: table surface < seats (z-10) < dealer button (z-20) < center content (z-30)
- 04-05: ActionPanel conditionally shows raise sizing only when Raise action available
- 04-05: Aspect ratio locked at 16:10 with max-w-6xl for responsive sizing
- 05-01: Four preflop scenario types (RFI, FacingOpen, 3Bet, BlindDefense)
- 05-01: BlindDefense takes priority over other classifications (most specific)
- 05-01: Scenario classification at pack load time (deterministic, performance)
- 05-01: Scenario type stored in SpotMeta (optional field, preflop only)
- 05-01: SpotFilterInput supports scenarioType filter (specific type or 'ANY')
- 05-03: DecisionGrade includes allActions array for UI feedback display
- 05-03: Mock solver detects preflop (board.length === 0) and returns Fold/Call/Raise
- 05-03: Guest limiting enforced after hand submission (not before session start)
- 05-03: 500ms reveal delay for training feedback timing
- 05-03: Training session state machine: idle → submitted → revealed
- 05-03: Keyboard shortcuts: Space/Enter (next), 1/F (fold), 2/C (call), 3/R (raise)
- 05-03: Guest limit 50 hands/day tracked in localStorage with daily reset
- 05-05: isActive = !hasFolded (player still in hand, not based on action existence)
- 05-05: Bet display shows blinds for SB/BB even when they haven't acted yet
- 05-06: Empty dependency array for keyboard event handlers prevents listener detach/reattach
- 05-06: Inline handler logic with ref-based state access for stable event listeners
- 05-07: Vertical label/value layout (label above value) for better metric visibility
- 05-07: Color coding for metrics: white for Hand #, blue-400 for Accuracy %, green-400 for Correct count
- 05-07: Info bar styling: bg-gray-800 with border-b border-gray-700 for visual separation
- 05-07: Metric display pattern: uppercase text-xs labels above text-lg bold values
- 06-01: ConfigPosition/ConfigPotType as separate types from engine types for config context
- 06-01: typeof localStorage check (not typeof window) for SSR safety in test environments
- 06-01: Fire-and-forget server sync pattern (localStorage primary, server background)
- 06-01: getAccessToken reads from localStorage (integrates with auth token storage)
- 06-02: Toggle chips use Set-based selection with minimum-1 enforcement
- 06-02: GameSetup uses partial onChange pattern for individual field updates
- 06-02: Static preset arrays for position filters (domain-fixed)
- 06-03: Native details/summary for collapsible advanced filters (no JS dependency)
- 06-03: canStart = positions.length > 0 && potTypes.length > 0 (minimum validation)
- 06-03: crypto.randomUUID() for session seed (browser-native, unique per session)
- 06-04: Toast auto-dismiss default 3000ms for info toasts in sidebar
- 06-04: Click-outside via mousedown event on document for sidebar close
- 06-04: Backdrop and sidebar as sibling elements in fragment for independent z-index
- 06-05: Minimum 10 decisions threshold for drill suggestion eligibility
- 06-05: Sort by avgEvLoss descending for worst-first drill suggestions
- 06-05: DrillSuggestions beside Essentials card in lg:grid-cols-2 layout
- 07-01: RangeActionType separate from engine ActionType (lowercase solver output vs uppercase engine)
- 07-01: oklch color space for action colors (better perceptual uniformity than HSL)
- 07-01: @theme block for Tailwind v4 custom property registration
- 07-01: Grid layout: pairs on diagonal, suited above diagonal, offsuit below diagonal
- 07-02: getActionColor used with inline style backgroundColor for dynamic CSS variable colors
- 07-02: EMPTY_ACTIONS shared constant prevents memo invalidation for empty hands
- 07-02: Pre-computed 169-cell position array in useMemo for stable grid rendering
- 07-03: 5% frequency threshold for action group classification (filters noise)
- 07-03: RangeContext pattern for cross-component filter state sharing
- 07-03: EquityCategory click filtering only in hand-strength view mode
- 07-04: Native HTML <dialog> instead of react-modal (zero dependency, built-in WCAG 2.1 accessibility)
- 07-04: View Ranges button on PokerTable (bottom-right, z-30) disabled when range data unavailable
- 07-04: Filter state reset to null on modal close for clean slate each open
- 07-04: useEffect sync pattern for imperative dialog API (showModal/close)
- 07-05: generateMockRangeData co-located in session page as module-level utility until solver integration
- 07-05: Range state cleared on handleNext to reset button disabled state for next hand
- 07-05: heroRange ?? undefined coercion bridges RangeData | null state to RangeData | undefined prop
- 09-04: Web Audio API with AudioContext singleton for low-latency sound playback
- 09-04: Lazy audio init on first playSound call to comply with browser autoplay policy
- 09-04: Separate localStorage key (ev-trainer-audio-enabled) from animation toggle
- 09-04: Promise.allSettled for sound loading so one missing file does not block others
- 09-01: Motion v12 as animation library (package name "motion", import from "motion/react")
- 09-01: reducedMotion='always' when user disables, 'user' otherwise (OS detection)
- 09-01: localStorage key 'ev-trainer-animations-enabled' for animation toggle persistence
- 08-01: Server-side Prisma groupBy for all stats aggregation (no client-side reduce)
- 08-01: 20-hand confidence threshold for position stat confidence flag
- 08-01: Auto granularity: session (<7d), day (<90d), week (>90d)
- 08-01: Top 5 biggest mistakes by absolute EV diff descending
- 09-03: AnimatePresence overlay pattern for background color transitions (motion.div absolute z-0)
- 09-03: Removed getFrequencyBg — Motion overlay handles all reveal colors uniformly
- 09-02: Perspective 600px for 3D card flip depth
- 09-02: Sequential deal+flip: flip starts after CARD_DEAL delay completes
- 09-02: AnimatedCard wraps Card/CardBack for all card rendering with consistent animation
- 08-04: 6-level color scale for heatmap (green-600 to red-600 with opacity)
- 08-04: Tab navigation on stats page (Performance/Positions/Sessions)
- 08-04: Dark theme applied to existing BreakdownTable for consistency
- 08-05: Client-side sorting on current page with server-side pagination
- 08-05: Optimistic local state removal on delete (instant UI feedback)
- 09-05: Chip animate in with scale+opacity (CHIP_SLIDE 250ms), exit with CHIP_COLLECT 300ms
- 09-05: playSoundRef pattern for stable sound calls in keyboard event handlers with empty deps
- 09-05: playSound added to useCallback dependency arrays for handler functions
- 08-02: shadcn/ui initialized with Tailwind v4 for reusable UI primitives (calendar, popover, button)
- 08-02: URL search params (startDate, endDate) for filter state persistence
- 08-02: First-half vs second-half comparison for trend calculation in metric cards
- 08-02: oklch color format from shadcn merged with existing poker HSL tokens in globals.css

### Pending Todos

None yet.

### Known Issues (Deferred)

- Phase 5: Keyboard shortcuts not working (Tests 11, 12) — needs deeper investigation
- Phase 5: Info bar metrics not visible (Test 13) — defer until hand logic complete

### Blockers/Concerns

- Research flag: Phase 1 may need targeted research on optimal abstraction bucket counts
- Research flag: Phase 10 (Postflop) needs phase-level research before planning

## Session Continuity

Last session: 2026-02-17 05:41 UTC
Stopped at: Completed 08-03-PLAN.md (performance chart)
Resume file: None
Next: Continue Phase 8 (08-06, 08-07) and Phase 9 remaining plans
