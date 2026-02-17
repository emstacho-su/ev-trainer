# Phase 11: Supabase Database Integration - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing Express/PostgreSQL/Prisma backend with Supabase Cloud. Covers: Supabase Auth (replacing custom JWT/Argon2), redesigned database schema, practice spot hand database with user-created spots, Supabase Storage for pack files, and a full data layer rewrite. Express server remains only for solver compute. Migration is incremental (swap one piece at a time).

</domain>

<decisions>
## Implementation Decisions

### Auth Migration
- Full replacement: Supabase Auth handles all authentication (email/password, OAuth, sessions, tokens)
- OAuth providers: Google + GitHub (same as current, migrated to Supabase Auth)
- Fresh start: no user migration — everyone creates new accounts (dev/early-stage project)
- Guest access preserved: anonymous users can train up to 50 hands/day via localStorage tracking
- No email verification for now — accounts active immediately
- Supabase built-in email service (no Resend/custom SMTP)
- Both email/password login AND magic links for recovery
- Rebuild auth UI with @supabase/auth-ui-react (pre-built components)
- Use supabase.auth.onAuthStateChange() for frontend session management — remove all custom token logic
- Authorization: both RLS policies AND app-level checks (defense in depth)
- Supabase Cloud (hosted at supabase.com) for production — scalable, managed infrastructure

### Data Layer Architecture
- Hybrid API approach: Supabase client directly for simple reads (fast), Next.js Server Actions / API routes for complex business logic (solver calls, grading)
- Express server stays ONLY for computationally heavy solver operations
- Schema redesigned for Supabase (not a 1:1 mirror of Prisma schema) — leverage auth.users, Storage, Realtime
- Supabase CLI codegen (supabase gen types) for TypeScript type safety
- Supabase migration system for database schema management
- Supabase Storage for pack JSON files and solver outputs (replacing bundled public/ files)
- Supabase Realtime enabled for cross-tab/cross-device session sync

### Practice Spot DB Design
- Replace bundled JSON packs entirely — all spots served from Supabase database
- Both system-generated AND user-created spots supported
- Tag-based / flat organization (no pack grouping) — spots have tags for position, street, stack depth, pot type
- Hybrid generation: pre-generated comprehensive pool + on-demand for custom configs
- Full scenario builder for user-created spots: position, stack depth, preflop action sequence, board cards (postflop)
- Auto-rated difficulty based on solver EV spread (close decisions = harder spots)
- Comprehensive pre-generated pool: all position matchups x stack depths x pot types (thousands of spots)
- User-created spots shareable via link (others can import)

### Migration Strategy
- Incremental swap: run both systems in parallel, migrate one feature at a time
- Old Express/Prisma/auth code archived in a separate git branch after migration, deleted from main
- Develop against Supabase Cloud directly (user codes on two devices — shared database)
- Drop email verification during migration (simplify scope)
- All other current features must reach parity after migration

### Claude's Discretion
- Exact Supabase schema design (table structure, relationships, indexes)
- RLS policy definitions
- Order of incremental migration steps
- Supabase Edge Functions vs Next.js API routes for specific endpoints
- Solver output caching strategy in Supabase Storage
- Spot difficulty rating algorithm details
- Realtime subscription channel design

</decisions>

<specifics>
## Specific Ideas

- User wants production-ready architecture suitable for taking to market
- Speed matters — both development velocity and runtime performance
- Two-device development workflow (Supabase Cloud as shared dev database)
- GTO training product feel — comprehensive spot library, smart difficulty, shareability
- Express server preserved specifically for solver compute (CFR+ is CPU-intensive)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-supabase-database-integration*
*Context gathered: 2026-02-17*
