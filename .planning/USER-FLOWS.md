# EV Trainer — User Experience Flows

Step-by-step user workflows with every feature interaction traced to architecture.
Use this to cross-reference gaps against specific breakpoints in each flow.

---

## Flow 1: Guest Training Session (No Account)

**Entry**: User visits `/`, clicks "Start Training" → navigates to `/training`

### Steps

| # | User Action | What Happens | Features Involved |
|---|------------|--------------|-------------------|
| 1 | Visits `/` | Dashboard renders. DrillSuggestions shows "Sign in to see drill suggestions" (401 from API). Training card renders. | `page.tsx`, `DrillSuggestions`, `AppHeader` (shows Log In + Sign Up) |
| 2 | Clicks "Start Training" | `<Link href="/training">` navigates. AppHeader disappears (hidden on `/training`). | `page.tsx` navigation |
| 3 | Sees TrainingConfigDialog | Dialog auto-opens (`configOpen = true`). Default config loads from localStorage or defaults. Mode toggle (PREFLOP/FLOP), position filters, pot type filters visible. | `TrainingConfigDialog`, `useTrainerConfig()`, localStorage |
| 4 | Configures and clicks "Start Training" | `handleStartTraining()` fires. POSTs to `/api/session/start` with `{ seed, mode, filters }`. | `training/page.tsx`, `sessionClient.startSession()` |
| 5 | Session starts | Server: `handleStart()` loads bundled pack, selects spot deterministically. Creates in-memory record. **No Supabase write** (guest). Returns `{ session, spot }`. Client: `writeSessionRecord()` to localStorage. Dialog closes. PokerTable shows spot. | `sessionHandlers.handleStart`, `sessionStore`, bundled pack, localStorage |
| 6 | Sees poker table | `spotToPlayers(spot)` renders Player seats. `dealHeroCards(spot, seed)` deals two cards. `getAvailableActions(spot)` shows action buttons. | `training/page.tsx`, `PokerTable`, `ActionPanel` |
| 7 | Picks an action (click or keyboard 1/2/3) | `handleSubmitAction(actionId)` fires. POSTs to `/api/session/submit`. UI → `submitted` state. | `training/page.tsx`, `sessionClient.submitAction()` |
| 8 | Sees grade feedback | Server: `gradeAction()` calls mock solver → `DecisionGrade`. Returns grade. Client: 500ms delay, then `revealed` state. ActionButtons show green/red with EV values. Range grids generated. | `sessionHandlers.handleSubmit`, `gradeAction`, mock solver, `ActionPanel` |
| 9 | Clicks "Next Hand" (or Space/Enter) | POSTs to `/api/session/next`. Server selects next spot. Client updates. Back to `idle`. | `training/page.tsx`, `sessionHandlers.handleNext` |
| 10 | Completes all decisions | `handleNext()` returns 409 `SESSION_COMPLETE`. Redirect to `/summary/[id]?seed=...`. | `training/page.tsx` redirect |
| 11 | **BLOCKED**: `/summary` is protected | Middleware detects no auth → redirects to `/login?redirect=/summary/[id]?seed=...`. Guest cannot see their summary. | `middleware.ts`, `PROTECTED_PREFIXES` |

### Failure Points

- **Step 11**: Guest gets redirected away from summary. This is the "Request failed" gap (G4) — but the root cause may actually be the route protection. A guest who just completed training is redirected to login instead of seeing their results.

---

## Flow 2: Authenticated Training Session

**Entry**: Logged-in user visits `/`, starts training

### Steps

| # | User Action | What Happens | Features Involved |
|---|------------|--------------|-------------------|
| 1 | Visits `/` | Dashboard renders. DrillSuggestions fetches `/api/drills/suggestions` with auth. If user has enough stats, shows weak spots. AppHeader shows display_name + Log Out. | `page.tsx`, `DrillSuggestions`, `AppHeader`, `useAuth()` |
| 2 | Clicks "Start Training" | Navigates to `/training`. Config dialog opens. | Navigation |
| 3 | Starts training | Same as guest Flow 1, steps 4-5. **PLUS**: Supabase `createTrainingSession()` fires (async, errors swallowed). | `sessionHandlers.handleStart`, `sessionService.createTrainingSession` |
| 4 | Submits action | Same grading as guest. **PLUS**: Supabase `addSessionEntry()` fires (async). | `sessionService.addSessionEntry` |
| 5 | Next hand | Same as guest. **PLUS**: Supabase `updateTrainingSession()` fires (async). | `sessionService.updateTrainingSession` |
| 6 | Session complete | Redirect to `/summary/[id]?seed=...`. Middleware passes (user authenticated). | `middleware.ts` allows |
| 7 | Summary page loads | `bootstrap()`: reads localStorage for seed/timestamps → calls `getSession(id, seed)` via API → API tries in-memory store, falls back to Supabase → response includes session + entries → `computeSessionAggregates()` → renders stats cards. | `summary/[id]/page.tsx`, `sessionClient.getSession`, `sessionHandlers.handleGetSession`, `sessionService.getSessionWithEntries` |

### Failure Points

- **Step 7**: If in-memory store was cleared (server restart, HMR), API tries Supabase fallback. If Supabase write in step 3-5 failed silently, the session doesn't exist in Supabase either → 404 → "Request failed". This is gap G4.
- **Step 7**: Even if API succeeds, the summary page tries to compute aggregates from `response.entries`. If entries is undefined (incomplete session in DB), it fails silently.

---

## Flow 3: Email/Password Signup

**Entry**: User clicks "Sign Up" in AppHeader → navigates to `/signup`

### Steps

| # | User Action | What Happens | Features Involved |
|---|------------|--------------|-------------------|
| 1 | Fills form | Display name (optional), email, password, confirm password. Client validates: password match, min 8 chars. | `signup/page.tsx` |
| 2 | Clicks "Create Account" | `supabase.auth.signUp({ email, password, options: { data: { display_name } } })`. No email verification required. | Supabase Auth |
| 3 | Account created | Supabase creates user in `auth.users`. `handle_new_user()` trigger fires → creates `profiles` row with display_name from metadata. `onAuthStateChange` fires → AuthProvider sets user. | Supabase trigger, `AuthProvider` |
| 4 | Redirect to `/` | `router.push('/')`. Dashboard renders with auth state. AppHeader shows display name + Log Out. | `signup/page.tsx`, `AppHeader` |

### Failure Points

- None reported. This flow works.

---

## Flow 4: Email/Password Login

**Entry**: User clicks "Log In" in AppHeader → navigates to `/login`

### Steps

| # | User Action | What Happens | Features Involved |
|---|------------|--------------|-------------------|
| 1 | Fills email + password | Login form renders. If `?redirect=` param exists, shown as intent. If `?error=` param exists (from OAuth failure), shown as red banner. | `login/page.tsx`, `useSearchParams()` |
| 2 | Clicks "Log In" | `supabase.auth.signInWithPassword({ email, password })`. | Supabase Auth |
| 3 | Success | `onAuthStateChange` fires → AuthProvider sets user. `router.push(redirect ?? '/')`. | `AuthProvider`, `login/page.tsx` |
| 4 | Failure | Error displayed inline (e.g., "Invalid login credentials"). | `login/page.tsx` error state |

### Failure Points

- None reported. This flow works.

---

## Flow 5: OAuth Login (Google/GitHub)

**Entry**: User clicks "Continue with Google" or "Continue with GitHub" on login or signup page

### Steps

| # | User Action | What Happens | Features Involved |
|---|------------|--------------|-------------------|
| 1 | Clicks OAuth button | `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: origin + '/auth/callback' } })`. Browser navigates away to provider. | `login/page.tsx` or `signup/page.tsx`, `OAuthButtons` |
| 2 | Authenticates with provider | User enters Google/GitHub credentials on provider's page. | External provider |
| 3 | Provider redirects back | Browser navigates to `/auth/callback?code=<pkce_code>`. | Provider redirect |
| 4 | Callback route processes | `exchangeCodeForSession(code)`. On success: cookies set, redirect to `/`. On failure: redirect to `/login?error=auth_callback_failed`. | `auth/callback/route.ts`, `server.ts` |
| 5 | App loads with session | `onAuthStateChange` fires → AuthProvider sets user. Dashboard renders with auth. | `AuthProvider` |

### Failure Points (GAP G1)

- **Step 1**: `signInWithOAuth` requires Supabase Dashboard configuration:
  - Redirect URL `http://localhost:3000/auth/callback` must be in Supabase Dashboard → Authentication → URL Configuration
  - Provider (Google/GitHub) must be enabled with client ID + secret in Supabase Dashboard → Authentication → Providers
- **Step 4**: If callback receives no `code` param, or `exchangeCodeForSession` fails, user sees `/login?error=auth_callback_failed` with generic "Authentication failed" message. **No specific error details are shown** (the error message from Supabase is not forwarded).
- **Step 4**: No `console.error` logging in the callback route — failures are invisible in server logs.

---

## Flow 6: Seed Spots to Supabase

**Entry**: Developer runs `npm run seed:spots`

### Steps

| # | Action | What Happens | Features Involved |
|---|--------|--------------|-------------------|
| 1 | Run command | `tsx scripts/seedSpots.ts` executes. Loads `.env.local` via dotenv. | `scripts/seedSpots.ts`, dotenv |
| 2 | Reads bundled pack | `loadBundledPack()` reads `public/packs/ev-dev-pack-v1.json`. | `loadBundledPack.ts` |
| 3 | Creates service role client | `createClient(url, serviceRoleKey)` — bypasses RLS. | `@supabase/supabase-js` direct |
| 4 | Upserts spots | For each spot: `convertEngineSpotToSupabaseRow()` + `generateTags()` → `supabase.from('spots').upsert()` with `onConflict: 'spot_id'`. | `spotService.ts` converters |
| 5 | Confirms count | Logs "Seeded N spots". | Terminal output |

### Failure Points (GAP G2)

- **Step 1**: `SUPABASE_SERVICE_ROLE_KEY` not in `.env.local` → script crashes with unhelpful error (no clear message telling user where to find the key).
- **Step 1**: No `.env.local.example` file exists to document required env vars.

---

## Flow 7: Viewing Stats

**Entry**: Logged-in user clicks "Stats" in AppHeader → navigates to `/stats`

### Steps

| # | User Action | What Happens | Features Involved |
|---|------------|--------------|-------------------|
| 1 | Visits `/stats` | Middleware checks auth → allows (user logged in). Stats page renders with Performance tab active. | `middleware.ts`, `stats/page.tsx` |
| 2 | FilterBar renders | Reads URL params. Default: 7-day date range, no position/scenario/street filters. | `FilterBar.tsx`, `useSearchParams()` |
| 3 | MetricCards fetch | `GET /api/stats/performance?startDate=...&endDate=...` → `getDailyStats()` → returns daily rows from `daily_stats` table. Client computes totals. | `MetricCards.tsx`, `statsService.getDailyStats` |
| 4 | PerformanceChart renders | Same endpoint. Renders Recharts line chart. Default metric: avgEVLoss. | `PerformanceChart.tsx` |
| 5 | Clicks "Positions" tab | `PositionHeatmap` fetches `GET /api/stats/positions` → `getPositionStats()` from `spot_stats`. `WeaknessBreakdown` fetches same endpoint separately. | `PositionHeatmap.tsx`, `WeaknessBreakdown.tsx` |
| 6 | Clicks "Sessions" tab | `SessionHistory` fetches `GET /api/stats/sessions?page=1&pageSize=20` → `getSessionHistory()`. Renders table. | `SessionHistory.tsx`, `statsService.getSessionHistory` |
| 7 | Sees session table | **6 columns in header** (Date, Hands, Accuracy, Avg EV Loss, Duration, Actions). **Data rows use `<td colSpan={6}>` with flex layout** — columns don't align with headers. | `SessionHistory.tsx` table bug |
| 8 | Clicks a session row | Fetches `GET /api/stats/sessions/[id]` → `getSessionDetail()`. Expanded detail shows entries table + biggest mistakes. | `SessionHistory.tsx`, `statsService.getSessionDetail` |
| 9 | Clicks "Flagged" tab | `FlaggedHandsList` fetches `GET /api/stats/flagged`. Renders proper `<table>` (no alignment issues). | `FlaggedHandsList.tsx` |

### Failure Points (GAP G5)

- **Step 7**: `<th>` column widths and `<td>` flex div widths are independent. Headers use content-based sizing; data uses `min-w-[Npx]`. They drift apart, especially on narrower viewports or when data values vary in length.

### Data Dependency

Stats require `daily_stats` and `spot_stats` table rows. These are populated by `upsertDailyStats()` and `upsertSpotStats()` — but **these functions are never called anywhere in the current codebase**. The stats pipeline writes to `training_sessions` + `session_entries` during training, but the aggregation into `daily_stats`/`spot_stats` is not wired. This means:
- PerformanceChart: shows nothing (no daily_stats rows)
- PositionHeatmap: shows nothing (no spot_stats rows)
- DrillSuggestions: shows nothing (no spot_stats rows)
- SessionHistory: works (reads directly from training_sessions)

---

## Flow 8: Session Summary After Training

**Entry**: User completes training → redirected to `/summary/[id]?seed=...`

### Steps

| # | What Happens | Features Involved |
|---|--------------|-------------------|
| 1 | Middleware checks auth | If guest → redirect to `/login` (summary is protected). If authenticated → allow. | `middleware.ts` |
| 2 | Summary page mounts | `bootstrap()` runs in useEffect. | `summary/[id]/page.tsx` |
| 3 | Read localStorage | `readSessionRecord(sessionId)` → gets seed, startedAt, existing aggregates. | `sessionStorage.ts` |
| 4 | Fetch from API | `getSession(sessionId, seed)` → `GET /api/session/[id]?seed=...`. | `sessionClient.ts` |
| 5 | API processes | Route handler: tries `handleGetSession()` (in-memory). If found → return. If 404 + authenticated → try `getSessionWithEntries()` from Supabase. | `session/[id]/route.ts`, `sessionHandlers.ts`, `sessionService.ts` |
| 6 | Compute aggregates | Client: `computeSessionAggregates(entries)` → volume, meanEvLoss, bestActionRate. `durationMs` from localStorage timestamps. | `summary/[id]/page.tsx` |
| 7 | Render | SummaryStatsCards shows 4 metrics. Review button if session complete. | `summary/[id]/page.tsx` |

### Failure Points (GAP G4)

- **Step 1**: Guests are blocked entirely by middleware redirect.
- **Step 4-5**: If in-memory store was cleared AND Supabase fire-and-forget writes failed silently during training → 404 from both sources → `SessionApiError` thrown → "Request failed" displayed.
- **Step 4-5**: If the API route handler itself throws an unhandled exception (e.g., malformed response from Supabase), it may return an HTML 500 page instead of JSON → `normalizeError` produces generic "Request failed".
- **Step 6**: If API returns session without entries (incomplete flag, or entries not yet written to Supabase), `computeSessionAggregates` gets undefined/empty entries → potential crash or zeros.

---

## Flow 9: Drill Suggestions → Targeted Training

**Entry**: User sees drill suggestion on dashboard, clicks it

### Steps

| # | User Action | What Happens | Features Involved |
|---|------------|--------------|-------------------|
| 1 | Dashboard loads drills | `DrillSuggestions` fetches `GET /api/drills/suggestions`. Service queries `spot_stats` for top 5 by avg_ev_loss (>= 10 decisions). | `DrillSuggestions.tsx`, `statsService.getDrillSuggestions` |
| 2 | Clicks a drill card | `onSelectDrill({ positions: [heroPosition], potTypes: [] })` fires. Dashboard handler builds `/training?heroPosition=X`. Navigates. | `page.tsx`, router |
| 3 | Training page reads params | `useEffect` reads `?heroPosition=X` → `updateConfig({ positions: [heroPosition] })`. Config dialog opens with position pre-filtered. | `training/page.tsx`, `useSearchParams()` |
| 4 | User starts training | Normal session start with the pre-filtered position. | Same as Flow 1/2 |

### Failure Points (GAP G6)

- **Step 1**: If `spot_stats` is empty (no rows — see Flow 7 data dependency note), API returns `[]` → "Play more hands to unlock drill suggestions".
- **Step 2**: `potTypes` is always `[]` because `spot_stats` has no `pot_type` column. No pot type pre-filtering occurs.
- **Step 3**: `villainPosition` from WeaknessBreakdown drills is passed in URL but training page ignores it (only reads `heroPosition`).

---

## Flow 10: Logout

**Entry**: User clicks "Log Out" in AppHeader

### Steps

| # | User Action | What Happens | Features Involved |
|---|------------|--------------|-------------------|
| 1 | Clicks "Log Out" | `handleLogout()`: `supabase.auth.signOut()` → clears session cookies. Then `router.push('/')`. | `AppHeader.tsx`, browser client |
| 2 | Auth state updates | `onAuthStateChange` fires `SIGNED_OUT` event → AuthProvider sets `user = null`. | `AuthProvider` |
| 3 | Dashboard re-renders | AppHeader shows Log In + Sign Up. DrillSuggestions shows "Sign in" message. | `AppHeader.tsx`, `DrillSuggestions.tsx` |

### Failure Points

- None reported. This flow works.

---

## Gap Cross-Reference

| Gap | Primary Flow | Failure Step | Root Cause |
|-----|-------------|-------------|------------|
| **G1**: OAuth doesn't work | Flow 5 | Step 1 | Supabase Dashboard not configured (redirect URLs + providers). No diagnostic logging in callback route. |
| **G2**: Seed script needs service role key | Flow 6 | Step 1 | `SUPABASE_SERVICE_ROLE_KEY` not in `.env.local`. No `.env.local.example`. No clear error message. |
| **G3**: Spots missing folded positions | Flow 1/2 | Step 6 | Pack JSON only has 2 positions (hero + villain). `spotToPlayers` doesn't mark missing positions as folded. |
| **G4**: Session summary "Request failed" | Flow 8 | Step 4-5 | Multiple causes: (a) guest blocked by middleware, (b) in-memory evicted + Supabase write failed, (c) unhandled exception → HTML 500 → generic error. No localStorage fallback. |
| **G5**: Stats sessions columns misaligned | Flow 7 | Step 7 | `SessionHistory` uses `<td colSpan={6}>` + flex instead of proper `<td>` per column. |
| **G6**: Drill suggestions untestable | Flow 9 | Step 1 | `spot_stats` table is empty because `upsertSpotStats` is never called. No data → no suggestions. |

---

## Additional Findings

### Stats Aggregation Gap (Undocumented)

`upsertDailyStats()` and `upsertSpotStats()` exist in `statsService.ts` but are **never called** from any API route or session handler. This means:
- `daily_stats` table: always empty
- `spot_stats` table: always empty
- PerformanceChart, PositionHeatmap, DrillSuggestions: all show empty/zero data
- Only `SessionHistory` works (reads from `training_sessions` + `session_entries` directly)

This may be the deeper root cause behind G6 (drill suggestions untestable) — it's not just that G2/G4 block testing, it's that the aggregation pipeline is simply not wired.

### Auth Token Strategy Inconsistency

Some stats components send `Authorization: Bearer {localStorage.access_token}` headers (legacy pattern). API routes authenticate via Supabase server-side cookie session (reads cookies, ignores Authorization header). The Bearer header is vestigial — auth works via cookies. Not a bug, but unnecessary code.

### Guest Summary Access

The summary route `/summary/[id]` is protected by middleware. Guests who complete training are redirected to `/login` instead of seeing their results. This is a UX regression from the pre-Supabase architecture where guests could always see summaries.
