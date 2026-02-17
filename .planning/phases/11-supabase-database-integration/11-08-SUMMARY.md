---
phase: 11-supabase-database-integration
plan: 08
subsystem: infrastructure-cleanup
tags: [cleanup, prisma-removal, express-strip, dead-code, dependency-reduction]
dependency_graph:
  requires: ["11-04", "11-05", "11-06", "11-07"]
  provides: ["Lean codebase with only Supabase + solver Express", "Clean dependency tree", "No dead auth/Prisma code"]
  affects: ["11-09"]
tech_stack:
  added: []
  patterns: ["Solver-only Express server", "Inline Zod validation (no middleware layer)"]
key_files:
  created: []
  modified:
    - src/server/app.ts
    - src/server/index.ts
    - src/server/routes/postflop.routes.ts
    - package.json
    - .env.example
  deleted:
    - prisma/ (schema, migrations, seed-stats)
    - prisma.config.ts
    - src/lib/prisma/ (client, JSON roundtrip test)
    - src/lib/stats/aggregation.ts
    - src/lib/v2/api/drillSuggestions.ts + test
    - src/lib/v2/storage/prismaSessionStore.ts
    - src/server/auth/ (10 files)
    - src/server/oauth/ (4 files)
    - src/server/email/ (2 files)
    - src/server/middleware/ (2 files)
    - src/server/controllers/ (4 files)
    - src/server/routes/ (5 old route files)
decisions:
  - "Inline Zod validation in postflop route rather than keeping middleware directory for one function"
  - "Delete aggregation.ts and drillSuggestions.ts (only consumed by deleted controllers, replaced by Supabase statsService)"
  - "Keep @types/express and @types/cors since Express solver route still uses them"
  - "Keep sessionStore.ts and its setSessionStoreBackend API (still used by session handlers)"
metrics:
  duration: "12 min"
  completed: "2026-02-17"
---

# Phase 11 Plan 08: Codebase Cleanup Summary

Removed all Prisma, custom auth, and unused Express infrastructure. 45 files deleted, ~6200 lines removed, 16 packages uninstalled.

## What Was Done

### Task 1: Strip Express server to solver-only and remove old auth (c3dd603)

Reduced the Express server from a full-featured backend to a single-purpose solver compute server:

**Modified files (3):**
- `src/server/app.ts` -- Stripped to Express + CORS + JSON parsing + postflop route only. Removed helmet, compression, rate limiting, cookie-parser, auth routes, health routes, error handler.
- `src/server/index.ts` -- Removed Prisma connection, session store backend swap, old route mounting. Now just starts server on port 4000.
- `src/server/routes/postflop.routes.ts` -- Inlined Zod validation directly (removed dependency on deleted validate.middleware.ts and AppError class).

**Deleted directories (5):**
- `src/server/auth/` -- 10 files: JWT auth controller, token service, session auth tests, auth middleware, types
- `src/server/oauth/` -- 4 files: OAuth config, controller, routes, service
- `src/server/email/` -- 2 files: email service, email templates
- `src/server/middleware/` -- 2 files: error middleware, validate middleware
- `src/server/controllers/` -- 4 files: session, stats, config, drill controllers

**Deleted route files (5):**
- session.routes.ts, stats.routes.ts, health.routes.ts, config.routes.ts, drill.routes.ts

**Deleted Prisma/database files (10):**
- `prisma/` directory: schema.prisma, 5 migration files, migration_lock.toml, seed-stats.ts
- `src/lib/prisma/` directory: client.ts, json-roundtrip.test.ts

**Deleted old data layer files (3):**
- `src/lib/v2/storage/prismaSessionStore.ts` -- replaced by Supabase session service
- `src/lib/stats/aggregation.ts` -- replaced by Supabase statsService
- `src/lib/v2/api/drillSuggestions.ts` + test -- replaced by Supabase statsService.getDrillSuggestions

**Result:** Express server directory has exactly 3 files: app.ts, index.ts, routes/postflop.routes.ts

### Task 2: Remove unused packages and clean dependencies (745b494)

Uninstalled 16 packages:

**Production (10):** @prisma/client, @prisma/adapter-pg, pg, argon2, jose, resend, helmet, compression, cookie-parser, express-rate-limit

**Dev (6):** prisma, @types/pg, @types/compression, @types/cookie-parser, supertest, @types/supertest

**Also deleted:** prisma.config.ts (root-level Prisma configuration)

**Updated:** .env.example -- removed DATABASE_URL, kept only Supabase vars

**Package reduction:** 548 -> 370 packages in node_modules (178 removed, 32% reduction)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Inline Zod validation in postflop route | Only one route uses validation; keeping the entire middleware directory for one function was wasteful |
| Delete aggregation.ts and drillSuggestions.ts | Only consumed by deleted controllers; Supabase statsService replaces all functionality |
| Keep @types/express and @types/cors | Express solver route still needs type support |
| Delete prisma.config.ts | Root-level Prisma config was blocking Next.js build after prisma package removal |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inlined Zod validation in postflop route**
- **Found during:** Task 1
- **Issue:** postflop.routes.ts imported validate from middleware/validate.middleware.ts, which imported AppError from middleware/error.middleware.ts. Deleting the middleware directory would break the solver route.
- **Fix:** Inlined Zod safeParse + error response directly in the route handler. No external dependency needed.
- **Files modified:** src/server/routes/postflop.routes.ts

**2. [Rule 3 - Blocking] Deleted prisma.config.ts**
- **Found during:** Task 2
- **Issue:** Root-level prisma.config.ts imported from 'prisma/config' which no longer exists after uninstalling the prisma package, causing build failure.
- **Fix:** Deleted the file entirely (Prisma is no longer used).
- **Files modified:** prisma.config.ts (deleted)

## Verification

- [x] `npm run build` passes cleanly (29 routes generated)
- [x] `npm test` -- 62/64 test files pass (2 pre-existing solver timeout failures unrelated to cleanup)
- [x] No Prisma imports in any source file
- [x] No argon2 or jose imports in any source file
- [x] No helmet, compression, cookie-parser, express-rate-limit imports
- [x] Express server has only 3 files (app.ts, index.ts, routes/postflop.routes.ts)
- [x] package.json contains express, cors, @supabase/supabase-js, @supabase/ssr
- [x] package.json does NOT contain any of the 16 removed packages
- [x] .env.example has Supabase vars only

## Next Phase Readiness

Plan 11-09 (final verification and integration testing) can proceed. The codebase is clean with:
- Supabase handling auth, database, and all data operations
- Express hosting only the CPU-intensive solver route
- No dead code or unused dependencies remaining
