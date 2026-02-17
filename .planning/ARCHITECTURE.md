# EV Trainer — Feature Architecture

How features are built, where they live, and how they connect.

## System Overview

```
Browser (React/Next.js)          Next.js Server               Supabase Cloud
─────────────────────────       ──────────────────            ──────────────────
AuthProvider (user state)        Middleware (JWT refresh)       auth.users
  └── useAuth() hook             Route handlers                6 tables + RLS
Training UI components           Session handlers (in-memory)   Storage
Stats UI components              Supabase service layer
localStorage (sessions)          Bundled pack fallback
```

## 1. Authentication

### Files

| File | Role |
|------|------|
| `src/lib/supabase/client.ts` | Browser Supabase client (`createBrowserClient<Database>`) |
| `src/lib/supabase/server.ts` | Server client (async, per-request, cookie-based) |
| `src/lib/supabase/middleware.ts` | Middleware client (`updateSession` with `getUser()` for JWT validation) |
| `src/app/providers/AuthProvider.tsx` | React context: `{ user, loading }` via `getSession()` + `onAuthStateChange` |
| `src/middleware.ts` | Runs `updateSession()` on all non-static routes |
| `src/app/auth/callback/route.ts` | OAuth PKCE code exchange → `exchangeCodeForSession(code)` |
| `src/app/auth/confirm/route.ts` | Email OTP verification via `verifyOtp()` |
| `src/app/login/page.tsx` | Email/password `signInWithPassword` + OAuth buttons |
| `src/app/signup/page.tsx` | `signUp` with display_name metadata + OAuth buttons |
| `src/components/AppHeader.tsx` | Shows Log In/Sign Up or display_name + Log Out |

### Three Supabase Clients

| Client | Created in | Auth method | Used for |
|--------|-----------|-------------|----------|
| Browser | `client.ts` | Automatic browser cookies | AuthProvider, login/signup pages, AppHeader signOut |
| Server | `server.ts` | `next/headers` cookies() | API route handlers, auth callback |
| Middleware | `middleware.ts` | Request/Response dual-write cookies | JWT refresh + route protection |

### Route Protection

Middleware checks `PROTECTED_PREFIXES = ['/stats', '/review', '/summary']`. Unauthenticated → redirect to `/login?redirect=<path>`. Training routes (`/training`, `/session/*`, `/train`) are guest-accessible.

### OAuth Flow

```
Login page: signInWithOAuth({ provider, redirectTo: origin + '/auth/callback' })
  → Browser redirects to Google/GitHub
  → Provider redirects back to /auth/callback?code=<pkce>
  → Route handler: exchangeCodeForSession(code)
  → Cookies set, redirect to / (or /login?error=auth_callback_failed)
  → onAuthStateChange fires → AuthProvider updates user state
```

**Known gap**: OAuth `redirectTo` does NOT forward a `?next=` param, so post-OAuth always lands at `/`, not the originally intended page.

### Component Tree

```
layout.tsx
  ThemeProvider
    AnimationProvider
      AuthProvider ← provides { user, loading }
        ToastProvider
          AppHeader ← consumes useAuth()
          {children}
```

---

## 2. Spot System

### Files

| File | Role |
|------|------|
| `src/lib/supabase/spotService.ts` | Supabase CRUD: `getFilteredSpots`, `getRandomSpots`, `getSpotById`, `createSpot` |
| `src/lib/v2/packs/loadBundledPack.ts` | Unified loader: `loadSpots()` (Supabase-first, bundled fallback) |
| `src/lib/v2/packs/spotPack.ts` | Pack schema, validation (`parseSpotPack`), scenario classification |
| `public/packs/ev-demo-pack-v2.json` | Bundled demo pack (JSON) |
| `public/packs/ev-dev-pack-v1.json` | Bundled dev pack (JSON, used by session handlers) |
| `scripts/seedSpots.ts` | Seeds Supabase spots table from bundled pack using service role key |

### Spot Data Flow

```
Supabase spots table ←(seed script)← Bundled pack JSON
         |                                    |
    getFilteredSpots()              loadBundledPack() + filterSpotEntries()
         |                                    |
         └──── loadSpots() (unified) ─────────┘
                    |
            SpotEntry[] { spot: Spot, meta: SpotMeta }
                    |
            Session handler → selectDeterministicSpot()
                    |
            Training UI (PokerTable, ActionPanel)
```

### Spot Structure

```typescript
Spot {
  spotId, positions: Position[], stacksBb: Record<Position, number>,
  potBb, board: string[], history: ActionId[], heroToAct: Position
}
SpotMeta {
  street, heroPosition, villainPosition, effectiveStackBb, potType, scenarioType?
}
```

### Current behavior

Session handlers call `loadBundledPack()` directly (not the unified `loadSpots()`). The unified Supabase-first loader exists in `loadBundledPack.ts` but is not yet wired into the session start flow. This means **training currently always uses the bundled JSON pack**, not Supabase spots.

### Seed Script

`scripts/seedSpots.ts` reads the bundled pack, converts each spot to a Supabase row via `convertEngineSpotToSupabaseRow()`, and upserts using a **service role client** (bypasses RLS). Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

---

## 3. Training Session

### Files

| File | Role |
|------|------|
| `src/app/training/page.tsx` | Main training page (config dialog + session loop) |
| `src/components/training/PreflopTrainingSession.tsx` | Legacy standalone training component (separate session loop) |
| `src/components/config/TrainingConfigDialog.tsx` | Native `<dialog>` with mode/position/potType/stack config |
| `src/lib/v2/api/sessionHandlers.ts` | Business logic: `handleStart`, `handleSubmit`, `handleNext`, `handleGetSession` |
| `src/lib/v2/sessionStore.ts` | In-memory `Map` (server-side, source of truth during active play) |
| `src/lib/v2/storage/sessionStorage.ts` | Browser localStorage persistence |
| `src/lib/v2/api-client/sessionClient.ts` | Client-side API wrapper (`startSession`, `submitAction`, `nextDecision`, `getSession`) |

### Session Lifecycle

```
TrainingConfigDialog           API Routes               Server Business Logic
──────────────────            ──────────                ────────────────────
"Start Training" click
  → POST /api/session/start → handleStart()            → loadBundledPack()
                                                        → selectDeterministicSpot()
                                                        → createSessionRecord() [in-memory]
                                                        → createTrainingSession() [Supabase, if auth]
  ← { session, spot }
  → writeSessionRecord() [localStorage]

User picks action
  → POST /api/session/submit → handleSubmit()          → gradeAction() [mock solver]
                                                        → appendSessionEntry() [in-memory]
                                                        → addSessionEntry() [Supabase, if auth]
  ← { result: DecisionGrade }
  → updateSessionRecord() [localStorage]

User clicks Next
  → POST /api/session/next → handleNext()              → selectDeterministicSpot()
                                                        → updateSessionSpot() [in-memory]
                                                        → updateTrainingSession() [Supabase, if auth]
  ← { session, spot }
  → updateSessionRecord() [localStorage]

Session complete → redirect to /summary/[id]?seed=...
```

### Three Storage Layers

| Layer | Location | Lifespan | Purpose |
|-------|----------|----------|---------|
| In-memory sessionStore | Server `Map` | Until server restart/HMR | Source of truth during active play |
| Supabase training_sessions | Cloud DB | Permanent | Cross-device, historical access |
| localStorage | Browser | Until cleared | Client-side summary/review, timestamps, aggregates |

### Dual-Path Persistence

API routes write to in-memory first (synchronous, always succeeds), then fire-and-forget to Supabase (async, errors logged but swallowed). This means:
- **Active sessions**: always available from in-memory
- **After server restart**: authenticated users recover from Supabase via `GET /api/session/[id]` fallback
- **Guests after restart**: session is lost (expected behavior)

### Session ID Derivation

`SHA-256({ seed, packId, mode, filters })` → `sess_{first 24 hex chars}`. Deterministic — same inputs = same sessionId.

### State Machine (training page)

```
IDLE → [user picks action] → SUBMITTED → [500ms + grade] → REVEALED → [user clicks Next] → IDLE
                                                                        └── [session complete] → /summary
```

### Key Functions in training/page.tsx

| Function | Purpose |
|----------|---------|
| `parseHistoryActions(spot)` | Walks `spot.history` in preflop order, maps actions to positions |
| `spotToPlayers(spot, heroCards?)` | Converts Spot → `Player[]` for PokerTable rendering |
| `dealHeroCards(spot, seed)` | Deterministic hero card dealing via seeded PRNG |
| `getAvailableActions(spot)` | Context-sensitive action set (RFI vs facing bet vs check) |
| `scoreDecision(grade, actionId)` | 1.0 best, 0.5 +EV non-best, 0.0 -EV |
| `derivePotType(history)` | Count raises: 0-1 = SRP, 2 = 3BP, 3+ = 4BP |

---

## 4. Session Summary

### Files

| File | Role |
|------|------|
| `src/app/summary/[id]/page.tsx` | Summary page (loads session, computes aggregates) |
| `src/lib/v2/api-client/sessionClient.ts` | `getSession(sessionId, seed)` → `GET /api/session/[id]?seed=` |

### Data Flow

```
/summary/[id]?seed=...
  → readSessionRecord(sessionId) [localStorage — for seed + timestamps]
  → getSession(sessionId, seed)  [API call → in-memory → Supabase fallback]
  → computeSessionAggregates(entries) [client-side]
  → updateSessionRecord() [write aggregates to localStorage]
  → Render: SummaryStatsCards { volume, meanEvLoss, bestActionRate, durationMs }
```

### Error Handling

If `getSession()` throws: shows raw error message "Request failed" (default from `normalizeError` in sessionClient.ts when response body lacks `{ error: { message } }` structure). **No localStorage fallback currently implemented**.

---

## 5. Stats & Analytics

### Files

| File | Role |
|------|------|
| `src/app/stats/page.tsx` | Stats page with 4 tabs |
| `src/app/stats/components/FilterBar.tsx` | URL-param-based filters (dates, position, scenario, street) |
| `src/app/stats/components/MetricCards.tsx` | 4 hero metrics (fetches `/api/stats/performance`) |
| `src/app/stats/components/PerformanceChart.tsx` | Recharts line chart |
| `src/app/stats/components/PositionHeatmap.tsx` | 6x6 hero vs villain grid |
| `src/app/stats/components/WeaknessBreakdown.tsx` | Top 10 weakest matchups with drill buttons |
| `src/app/stats/components/SessionHistory.tsx` | Paginated session table |
| `src/app/stats/components/FlaggedHandsList.tsx` | Flagged entries table |
| `src/app/stats/components/SessionReplay.tsx` | Hand-by-hand replay viewer |
| `src/lib/supabase/statsService.ts` | All analytics queries (12 functions) |

### API Routes

| Endpoint | Service Function | Tables |
|----------|-----------------|--------|
| `GET /api/stats` | `getOverviewStats` | `daily_stats` |
| `GET /api/stats/performance` | `getDailyStats` | `daily_stats` |
| `GET /api/stats/positions` | `getPositionStats` | `spot_stats` |
| `GET /api/stats/sessions` | `getSessionHistory` | `training_sessions` + `session_entries` |
| `GET /api/stats/sessions/[id]` | `getSessionDetail` | `training_sessions` + `session_entries` |
| `DELETE /api/stats/sessions/[id]` | `deleteSession` | `training_sessions` |
| `PATCH .../entries/[index]/flag` | `toggleEntryFlag` | `session_entries` |
| `GET /api/stats/flagged` | `getFlaggedHands` | `training_sessions` + `session_entries` |
| `GET /api/drills/suggestions` | `getDrillSuggestions` | `spot_stats` |

### SessionHistory Table Structure (BUG)

The `<thead>` has 6 `<th>` columns (Date, Hands, Accuracy, Avg EV Loss, Duration, Actions). But `<tbody>` rows use `<td colSpan={6}>` with a flex `<div>` inside. This means **header columns and data columns don't share widths** — alignment breaks at different viewports.

### Stats Data Pipeline

```
Stats page mounts → each tab component fetches its own API route
  → API route: createClient() → supabase.auth.getUser() → 401 if !user
  → statsService function → Supabase query → client-side aggregation
  → JSON response → component state → render
```

### Filter State

All filter state lives in URL search params (`?startDate=...&endDate=...&positions=UTG,BB`). Components read from `useSearchParams()` and push new params via `router.push()`. This enables shareable URLs and state persistence across tab switches.

**Known gap**: `positions`, `scenarios`, `streets` params are parsed by FilterBar and passed in fetch calls, but `getSessionHistory()` only accepts `startDate`/`endDate` — the extra filters are silently ignored.

---

## 6. Dashboard & Drill Suggestions

### Files

| File | Role |
|------|------|
| `src/app/page.tsx` | Dashboard: training card + drill suggestions |
| `src/components/config/DrillSuggestions.tsx` | Fetches `GET /api/drills/suggestions`, renders clickable weak-spot cards |

### Drill Navigation

```
DrillSuggestions → click card → router.push('/training?heroPosition=X')
Dashboard handler builds URL from drill.positions[0]
Training page useEffect reads ?heroPosition → updateConfig({ positions: [heroPosition] })
```

**Known gap**: `potTypes` from drill suggestions is always `[]` because `spot_stats` has no pot_type column. So drills only pre-filter by position, not pot type.

**Known gap**: `WeaknessBreakdown` passes `villainPosition` in URL but training page only reads `heroPosition`.

---

## 7. Navigation & AppHeader

### Route Map

| Route | Protected | Header | Purpose |
|-------|-----------|--------|---------|
| `/` | No | Visible | Dashboard |
| `/training` | No | Hidden | Active training (config + session loop) |
| `/stats` | Yes | Visible | Analytics (4 tabs) |
| `/login` | No | Visible | Email/password + OAuth login |
| `/signup` | No | Visible | Account creation |
| `/summary/[id]` | Yes | Visible | Post-session summary |
| `/review/[id]` | Yes | Visible | Session review |
| `/session/[id]` | No | Hidden | Session viewer |
| `/postflop-training` | No | Visible | Postflop mode |
| `/lobby` | No | Visible | Legacy lobby (still exists) |
| `/auth/callback` | No | N/A | OAuth return endpoint |
| `/auth/confirm` | No | N/A | Email confirmation endpoint |

### AppHeader Nav Links

Always shown: Dashboard (`/`), Training (`/training`), Stats (`/stats`).
Auth section: Loading → skeleton | Guest → Log In + Sign Up | User → display_name + Log Out.

---

## 8. Database Schema

### 6 Tables (all RLS-enabled)

| Table | Key Columns | RLS Policy |
|-------|-------------|------------|
| `profiles` | id (= auth.uid), display_name, subscription_tier | Own profile only |
| `spots` | spot_id, positions[], stacks_bb, hero_position, villain_position, is_system, tags[] | System spots readable by all; own spots by creator |
| `training_sessions` | session_id, user_id, seed, mode, filters, decision_index, is_complete | Own sessions only |
| `session_entries` | session_id (FK), index, spot_id, action_id, result, is_flagged | Via session ownership subquery |
| `daily_stats` | user_id, date, total_decisions, correct_decisions, avg_ev_loss | Own stats only |
| `spot_stats` | user_id, spot_id, hero_position, villain_position, avg_ev_loss | Own stats only |

### Triggers

- `handle_new_user()` — AFTER INSERT on `auth.users` → creates profile row (SECURITY DEFINER)
- `update_updated_at()` — BEFORE UPDATE on profiles, spots, training_sessions, spot_stats

### Key Indexes

- GIN index on `spots.tags` for array containment queries
- FK: `session_entries.session_id` → `training_sessions.id` (CASCADE DELETE)

---

## 9. Environment Variables

| Variable | Required by | Secret? |
|----------|------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase clients | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | All Supabase clients | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed script only | Yes |
