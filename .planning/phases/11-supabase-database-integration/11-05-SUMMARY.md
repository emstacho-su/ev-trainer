---
phase: 11-supabase-database-integration
plan: 05
subsystem: data-layer
tags: [supabase, session, persistence, dual-path, api-routes]

dependency_graph:
  requires: ["11-01", "11-02", "11-03"]
  provides: ["Supabase session persistence", "dual-path guest/auth API routes", "session CRUD service"]
  affects: ["11-06", "11-08"]

tech_stack:
  added: []
  patterns: ["dual-path persistence (Supabase for auth, in-memory for guest)", "fire-and-forget DB write alongside in-memory source of truth"]

key_files:
  created:
    - src/lib/supabase/sessionService.ts
  modified:
    - src/app/api/session/start/route.ts
    - src/app/api/session/submit/route.ts
    - src/app/api/session/next/route.ts
    - src/app/api/session/[id]/route.ts

decisions:
  - id: "11-05-01"
    description: "Fire-and-forget Supabase persistence alongside in-memory source of truth during active play"
    rationale: "In-memory runtime registry and sessionStore remain the source of truth for active session progression. Supabase writes happen in try/catch blocks that log errors but never fail the request. This ensures training is never interrupted by DB issues."
  - id: "11-05-02"
    description: "Idempotent session creation using session_id + seed lookup before insert"
    rationale: "Prevents duplicate rows when handleStart is called multiple times for the same session (e.g., page refresh)."
  - id: "11-05-03"
    description: "GET [id] falls back to Supabase for historical sessions not in memory"
    rationale: "After server restart, in-memory sessions are lost. Authenticated users can still access completed sessions from Supabase for review/replay."
  - id: "11-05-04"
    description: "DELETE route added for authenticated session removal"
    rationale: "Sessions persisted to Supabase need a deletion mechanism. Requires authentication and ownership verification."

metrics:
  duration: "6 min"
  completed: "2026-02-17"
---

# Phase 11 Plan 05: Session Data Layer Rewrite Summary

Supabase-backed session persistence with dual-path API routes: authenticated users write to training_sessions/session_entries tables while guests continue using the existing in-memory sessionStore unchanged.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Create Supabase session service | 990c7cd | 8 exported functions: createTrainingSession, getTrainingSession, updateTrainingSession, addSessionEntry, getSessionEntries, getSessionWithEntries, deleteTrainingSession, flagEntry |
| 2 | Update session API routes to use Supabase | ab46ccf | All 4 route files updated with dual-path pattern: auth detection, Supabase persist for authenticated, in-memory fallback for guests |

## Architecture

The dual-path pattern preserves all existing behavior while adding persistence:

```
Request -> Route Handler
  |
  +-- createClient() + getUser()
  |
  +-- handleStart/Submit/Next/GetSession(payload, userId)  <-- business logic unchanged
  |
  +-- if (user) { sessionService.persist(supabase, ...) }  <-- new: fire-and-forget DB write
  |
  +-- return NextResponse.json(result.body)                 <-- response shape unchanged
```

Key properties:
- **In-memory is source of truth** during active play (runtime registry + sessionStore)
- **Supabase is source of truth** for historical sessions (after server restart)
- **GET [id]** tries in-memory first, falls back to Supabase for authenticated users
- **DELETE** is Supabase-only (authenticated, ownership-verified)

## Decisions Made

1. **Fire-and-forget persistence** -- Supabase writes are wrapped in try/catch. Errors logged but never fail the request. Training continues uninterrupted even if DB is unreachable.

2. **Idempotent session creation** -- createTrainingSession checks for existing row by session_id + seed before inserting. Handles page refreshes and retries gracefully.

3. **Historical session fallback** -- When GET [id] returns 404 from in-memory store, authenticated users get a Supabase lookup. Enables cross-device session review.

4. **DELETE route added** -- New endpoint for session deletion with auth + ownership checks.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- [x] `npm run build` passes
- [x] All 4 route files import from supabase/sessionService
- [x] All routes create per-request Supabase client
- [x] sessionService.ts exports all 8 functions
- [x] No Prisma imports in sessionService
- [x] Response shapes unchanged (frontend compatibility)
- [x] Guest path preserved (in-memory fallback when no user)
- [x] Authenticated path writes to Supabase

## Next Phase Readiness

Session persistence is now wired. Future plans can build on:
- Session entries in Supabase for stats aggregation (11-06)
- Historical session queries for review pages (11-08)
- The flagEntry function for flagged hands feature
