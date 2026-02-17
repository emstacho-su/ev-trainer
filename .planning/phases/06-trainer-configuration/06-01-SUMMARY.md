---
phase: 06-trainer-configuration
plan: 01
subsystem: config
tags: [typescript, zod, localStorage, prisma, express, react-hooks]
dependency_graph:
  requires: [03-authentication]
  provides: [TrainerConfig type, validation schemas, localStorage persistence, useTrainerConfig hook, /api/config endpoints]
  affects: [06-02, 06-03, 06-04, 06-05, 06-06]
tech_stack:
  added: []
  patterns: [Zod validation on boundaries, localStorage with schema-migration fallback, debounced auto-save hook, fire-and-forget server sync]
key_files:
  created:
    - src/lib/v2/config/types.ts
    - src/lib/v2/config/validation.ts
    - src/lib/v2/config/configStore.ts
    - src/lib/v2/config/configStore.test.ts
    - src/lib/v2/hooks/useTrainerConfig.ts
    - src/server/controllers/config.controller.ts
    - src/server/routes/config.routes.ts
    - prisma/migrations/20260217024714_add_trainer_preferences/migration.sql
  modified:
    - prisma/schema.prisma
    - src/server/index.ts
decisions:
  - id: "06-01-01"
    description: "ConfigPosition/ConfigPotType as separate types from engine Position/PotType for config-specific context"
  - id: "06-01-02"
    description: "typeof localStorage check instead of typeof window for SSR safety (works in test environments)"
  - id: "06-01-03"
    description: "Fire-and-forget server sync pattern - localStorage is primary, server is background"
  - id: "06-01-04"
    description: "getAccessToken reads from localStorage (integrates with existing auth token storage)"
metrics:
  duration: 5 min
  completed: 2026-02-17
---

# Phase 6 Plan 1: Config Foundation Summary

Type-safe trainer configuration with Zod validation, localStorage persistence, React hook state management, and server-side sync via Prisma/Express API.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create config types and validation schemas | e32505c | types.ts, validation.ts |
| 2 | Implement localStorage persistence with Zod validation | a132955 | configStore.ts, configStore.test.ts |
| 3 | Create useTrainerConfig hook with auto-save and server sync | 9daacd2 | useTrainerConfig.ts |
| 4 | Add database field and API endpoints for user preferences | cf47278 | schema.prisma, config.controller.ts, config.routes.ts |

## What Was Built

### Config Types (types.ts)
- `TrainerConfig` interface with 8 fields (mode, gameType, tableSize, stackDepth, villainAlwaysRaise, positions, potTypes, handCountTarget)
- JSDoc categorization: lobby-only vs mid-session-changeable fields
- `ConfigPosition` and `ConfigPotType` type aliases for config context

### Validation (validation.ts)
- Zod schema with defaults for all required fields (safe to parse empty objects)
- Minimum selection rules: positions min 1, potTypes min 1
- handCountTarget optional with 1-1000 range
- `validateConfig()` returns validated config or null
- `getDefaultConfig()` returns schema defaults

### localStorage Persistence (configStore.ts)
- `loadConfigFromStorage()` - reads, validates, falls back to defaults on any failure
- `saveConfigToStorage()` - validates before write, handles quota errors
- SSR-safe with `typeof localStorage` check
- 8 unit tests covering round-trip, corrupt data, missing data, quota errors

### React Hook (useTrainerConfig.ts)
- Loads from localStorage on mount (instant)
- If userId provided, fetches server config and merges (server takes precedence)
- Debounced 500ms auto-save to localStorage on changes
- Fire-and-forget POST to /api/config for authenticated users
- `updateConfig()` merges partial updates with useCallback stability

### Database + API (schema.prisma, config.controller.ts, config.routes.ts)
- `User.trainerPreferences` Json? field with migration
- `GET /api/config` - returns user preferences or defaults (requireAuth)
- `POST /api/config` - validates and persists config (requireAuth)
- Routes registered at `/api/config` in server index

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **ConfigPosition/ConfigPotType separate from engine types** - Config module defines its own position/pot type constants rather than importing from engine, keeping config self-contained.
2. **typeof localStorage for SSR check** - Using `typeof localStorage === "undefined"` instead of `typeof window === "undefined"` because it works correctly in test environments where localStorage is polyfilled on globalThis.
3. **Fire-and-forget server sync** - Server sync errors are caught and logged but never block UI. localStorage is always the primary source for responsiveness.
4. **getAccessToken from localStorage** - Simple integration point with existing auth system's token storage pattern.

## Verification Results

- Typecheck: passes (4 pre-existing errors in unrelated test files)
- Config tests: 8/8 passing
- Prisma migration: applied successfully
- Routes registered: /api/config mounted in server index

## Next Phase Readiness

Config foundation is complete. Phase 6 Plan 2 (filter components) can build UI on top of these types and the useTrainerConfig hook. The TrainerConfig interface and validation schemas provide the contract for all configuration surfaces.
