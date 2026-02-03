# Codebase Concerns

**Analysis Date:** 2026-02-03

## Tech Debt

**Large handler file combining business logic:**
- Issue: `src/lib/v2/api/sessionHandlers.ts` is 561 lines with mixed validation, state mutation, and API response construction
- Files: `src/lib/v2/api/sessionHandlers.ts`
- Impact: Difficult to maintain, test in isolation, and extend with new session operations. High cognitive load for modifications.
- Fix approach: Break into smaller modules (parsers, validators, state managers) with single responsibilities. Consider extracting parseFilters, parseMode, and state-building functions to separate modules.

**Unsafe type casting in filter parsing:**
- Issue: Multiple `as any` casts in filter validation bypass TypeScript safety checks. Lines 160, 164, 171, 179, 187 cast unvalidated values before checking with includes()
- Files: `src/lib/v2/api/sessionHandlers.ts`
- Impact: If Streets/Positions/PotTypes arrays are modified, code will silently accept invalid values
- Fix approach: Create type-safe validator functions that use type guards instead of `as any`. Build a constant map for valid values to prevent drift.

**Untyped spot validation in submit handler:**
- Issue: Line 443 casts spotValue as `unknown as Spot` after basic validation, but spot structure is not fully re-validated
- Files: `src/lib/v2/api/sessionHandlers.ts`
- Impact: Malformed spots could reach downstream grading logic. Better validation exists in `src/lib/engine/spot.ts` that should be called
- Fix approach: Always call `validateSpot()` for untrusted inputs before using spot data in business logic

## Known Bugs

**Session selection ID derivation includes mutable state:**
- Symptoms: Spot selection order could change if spot.spotId changes or array order varies
- Files: `src/lib/v2/spotSource.ts` (line 33-34 sorts by spotId but array is modified by filter)
- Trigger: When spot pack metadata changes or filters change
- Workaround: Seed value is stable, so sessions created with same seed/filters will replay correctly. But session ID derivation is not protected against concurrent modifications.

**In-memory session store lost on process restart:**
- Symptoms: Browser session store persists (localStorage), but server-side runtime registry is ephemeral
- Files: `src/lib/v2/sessionStore.ts` (in-memory backend), `src/lib/runtime/v2SessionRegistry.ts` (in-memory registry)
- Trigger: API requests after server restart will fail with "session not found" even if browser has localStorage record
- Workaround: Client-side storage allows recovery, but server cannot resume from stored state. This is acceptable for stateless deployment but limits session durability.

## Security Considerations

**Seed/sessionId not validated for length exploits:**
- Risk: Very long seeds could cause hash collision or performance issues
- Files: `src/lib/engine/session.ts`, `src/lib/v2/spotSource.ts`
- Current mitigation: Basic type checks (non-empty string). No length limits
- Recommendations: Add maximum length validation (e.g., 1000 chars) to prevent DoS via seed expansion. Hash seed early to fixed-size outputs.

**localStorage quota not monitored:**
- Risk: Session storage can fail silently if quota exceeded (private mode, old browsers)
- Files: `src/lib/v2/storage/sessionStorage.ts`
- Current mitigation: Swallows storage failures and sets warning flag (lines 79-81, 88-90)
- Recommendations: Log quota exceeded errors separately. Implement storage cleanup policy (purge old sessions after N days). Alert user before running out of space.

**No CSRF protection on session endpoints:**
- Risk: If browser visits hostile site, it can POST to `/api/session/*` routes
- Files: `src/app/api/session/start/route.ts`, `src/app/api/session/submit/route.ts`, `src/app/api/session/next/route.ts`
- Current mitigation: POST body validation only, no origin/referer checks
- Recommendations: Add SameSite=Strict to session cookies if any. For public app, consider origin validation or require session token in URL to prevent form-based attacks.

## Performance Bottlenecks

**MemoryNodeCache has no eviction strategy for burst queries:**
- Problem: Cache stores raw solver outputs with no compression or deduplication
- Files: `src/lib/engine/nodeCache.ts` (lines 40-52)
- Cause: LRU eviction only applies when size exceeds maxEntries. No cleanup during bursts, and deletes/re-adds on cache hit (line 35-36)
- Improvement path: Consider hit-count based eviction or TTL for stale entries. Measure cache hit rate in production to size maxEntries appropriately (currently 500).

**Spot filtering full-array scan on every request:**
- Problem: No indexing on spot metadata (street, position, potType, stack bucket)
- Files: `src/lib/v2/spotSource.ts` (line 12-13 filters all spots)
- Cause: Filter matching is linear scan with no pre-computed indexes
- Improvement path: If spot pack grows, build in-memory indexes (Set-based) for each filter dimension. Intersection of sets is faster than full array iteration.

**SessionHandlers stableStringify called for every session derivation:**
- Problem: Manual stable JSON stringification on every start request
- Files: `src/lib/v2/api/sessionHandlers.ts` (lines 197-211, 213-222)
- Cause: Sorting object keys and recursively stringifying on every request
- Improvement path: Cache stringified form if inputs don't change. Consider moving to request hash middleware if session derivation becomes bottleneck.

## Fragile Areas

**Deterministic RNG state not sealed:**
- Files: `src/lib/engine/rng.ts`
- Why fragile: Mulberry32 class has mutable `s` field. If this field is accidentally mutated externally or state is not properly threaded through calls, replay will fail silently.
- Safe modification: Always create new RNG from seed rather than reusing instance. Do not store RNG state across request boundaries.
- Test coverage: Good unit tests in rng.test.ts. No integration tests verifying RNG state thread across multi-spot sessions.

**Session record mutation without immutability guards:**
- Files: `src/lib/v2/sessionStore.ts` (lines 91-104 mutate record in place)
- Why fragile: updateSessionSpot and appendSessionEntry modify mutable SessionRecord. If these are called concurrently or callbacks hold stale references, data corruption is possible.
- Safe modification: Always retrieve fresh record before mutation. Consider Object.freeze on critical fields or use copy-on-write pattern.
- Test coverage: sessionStore.test.ts exists but doesn't test concurrent access patterns.

**Spot pack validation only occurs on load:**
- Files: `src/lib/v2/packs/spotPack.ts`, `src/lib/v2/packs/loadBundledPack.ts`
- Why fragile: Pack is cached globally after first parse. If pack data becomes corrupted in memory, all subsequent requests serve bad data until restart.
- Safe modification: Consider periodic validation or checksum verification. Add runtime assertions in spot selection to catch corruption early.
- Test coverage: spotPack.test.ts validates parsing but not cache invalidation scenarios.

**Hard-coded deterministic timestamp base:**
- Files: `src/lib/engine/session.ts` (line 61), `src/lib/runtime/runtimeRegistry.ts` (line 7)
- Why fragile: Both use "2026-01-01T00:00:00.000Z" as base. If code is still running after 2026, or if decision records with dates before 1970 are processed, comparisons will fail.
- Safe modification: Move base timestamp to environment variable or config. Add validation that now() returns monotonically increasing times.
- Test coverage: No tests verify now() consistency across session boundaries.

## Scaling Limits

**In-memory decision store unbounded growth:**
- Current capacity: Stores all DecisionRecords in array. No pagination at storage layer (lines 43-59 in decisionStore.ts filter in memory)
- Limit: Where it breaks: After ~100k records (5-10k user sessions with 10-20 decisions each), array scans become slow
- Scaling path: Add database layer for decision storage. Implement lazy-load pagination in API responses. Add archival job to move old records to cold storage.

**Session registry stores all active sessions in single Map:**
- Current capacity: In-memory Map in runtimeRegistry. Typical session lifecycle is hours but registry never evicts
- Limit: After 10k+ concurrent sessions, object lookup and memory footprint become significant
- Scaling path: Implement session TTL/eviction policy. Move to external session store (Redis) for multi-server deployments.

**Browser localStorage has hard 5-10MB limit:**
- Current capacity: PersistedSessionRecord stores full spot objects, grades, and history
- Limit: Exceeds quota after ~100-200 completed sessions depending on decision count
- Scaling path: Implement storage cleanup (delete sessions older than 30 days). Compress decision history. Move long-term history to server-side database.

## Dependencies at Risk

**Next.js 16 (recent major version):**
- Risk: Heavy reliance on Next.js routing, server components, and API routes. Version 16 may have breaking changes in future releases
- Impact: Requires careful monitoring of Next.js release notes and testing after upgrades
- Migration plan: Pin to 16.1.x for now. Plan incremental migration to next major version with full test coverage before upgrading.

**No external solver integration (mock solver only):**
- Risk: Demo uses makeMockSolverOutput() instead of real poker solver. Production will need actual solver integration
- Impact: Current codebase doesn't validate solver output schema against real data. Mock EV values don't match production distributions
- Migration plan: Implement real solver adapter with validateSolverNodeOutput() already in place. Add integration tests comparing mock vs. real output schemas.

## Missing Critical Features

**No error recovery for failed storage writes:**
- Problem: Storage failures are logged but sessions continue without confirmation of persistence
- Blocks: User cannot know if their practice session data was saved. Reloading page may lose progress if storage quota exceeded
- Recommendation: Implement explicit confirmation flow. Queue offline writes and retry. Show persistent warning if storage is unavailable.

**No session expiration or cleanup:**
- Problem: Sessions persist indefinitely in memory/localStorage
- Blocks: Long-running apps accumulate session data. No way to clean up old test sessions
- Recommendation: Add session TTL (24 hours default). Implement "forget this session" UI. Archive old sessions to database.

**No pagination in decision review list:**
- Problem: All decisions are loaded into memory for sorting and filtering
- Blocks: Users with 1000+ decisions in a session will experience UI slowdown
- Recommendation: Implement cursor-based pagination in review API. Add offset/limit parameters (already in DecisionRecordStore interface but unused).

## Test Coverage Gaps

**Session state transitions not fully tested:**
- What's not tested: Order of operations when session is restarted, paused, or resumed. Current tests only verify happy path.
- Files: `src/lib/v2/api/sessionHandlers.ts`, `src/lib/v2/sessionStore.ts`
- Risk: Edge cases in handleStart -> handleNext -> handleSubmit sequence could accumulate state incorrectly
- Priority: High - state transitions are core to session integrity

**Filter validation edge cases:**
- What's not tested: Interaction between multiple filters (street + position + stack bucket). Invalid combinations. Missing optional filter fields.
- Files: `src/lib/v2/filters/spotFilters.ts`, `src/lib/v2/api/sessionHandlers.ts`
- Risk: Filter logic bugs could silently exclude valid spots or include invalid ones
- Priority: High - affects spot selection determinism

**Storage quota and offline scenarios:**
- What's not tested: Private mode, quota exceeded, network timeout recovery, concurrent storage writes
- Files: `src/lib/v2/storage/sessionStorage.ts`
- Risk: App may fail silently or lose data in real-world conditions
- Priority: Medium - important for mobile/unreliable networks

**Performance under load:**
- What's not tested: Many concurrent sessions, large spot packs, deep decision histories
- Files: All v2 API handlers
- Risk: Response times may degrade exponentially with load
- Priority: Medium - scales with user base

---

*Concerns audit: 2026-02-03*
