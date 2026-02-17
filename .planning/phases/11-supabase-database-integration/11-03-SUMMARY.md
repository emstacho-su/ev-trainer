---
phase: 11-supabase-database-integration
plan: 03
subsystem: auth
tags: [supabase, auth, middleware, oauth, pkce, context]
depends_on: ["11-02"]
provides: ["auth-context", "supabase-middleware", "oauth-callback", "email-confirmation"]
affects: ["11-04", "11-05", "11-06"]
tech_stack:
  added: []
  patterns: ["React context for auth state", "onAuthStateChange listener", "PKCE OAuth flow", "middleware token refresh"]
key_files:
  created:
    - src/app/providers/AuthProvider.tsx
    - src/app/auth/callback/route.ts
    - src/app/auth/confirm/route.ts
  modified:
    - src/app/layout.tsx
    - src/middleware.ts
    - src/lib/supabase/middleware.ts
decisions:
  - "11-03: AuthProvider uses getSession() for initial load + onAuthStateChange for updates"
  - "11-03: Auth context provides { user, loading } -- minimal surface for consumers"
  - "11-03: Protected routes: /stats, /review, /summary -- all training routes remain guest-accessible"
  - "11-03: OAuth callback redirects to next param or / on success, /login?error on failure"
  - "11-03: Email confirmation uses verifyOtp with token_hash and type params"
metrics:
  duration: "8 min"
  completed: "2026-02-17"
---

# Phase 11 Plan 03: AuthProvider and Middleware Summary

Supabase Auth integrated into Next.js via AuthProvider context, middleware token refresh, OAuth callback, and email confirmation routes. Replaces Phase 3 custom JWT/Argon2 auth middleware.

## What Was Done

### Task 1: AuthProvider and Layout Integration (6d4c198)

Created `src/app/providers/AuthProvider.tsx` with:
- `'use client'` directive for browser-side auth state
- `AuthContext` with `{ user: User | null; loading: boolean }` shape
- Initial session load via `getSession()` to avoid flash of unauthenticated state
- `onAuthStateChange` listener for reactive updates on login/logout/token refresh
- Cleanup via `subscription.unsubscribe()` on unmount
- Exported `useAuth()` hook for any client component

Updated `src/app/layout.tsx`:
- AuthProvider slotted between AnimationProvider (outer) and ToastProvider (inner)
- All existing providers preserved: ThemeProvider > AnimationProvider > AuthProvider > ToastProvider

### Task 2: Middleware and OAuth Routes (e438a2e)

Replaced `src/middleware.ts`:
- Calls `updateSession(request)` from Supabase middleware helper
- Matcher excludes static files, images, and favicon

Updated `src/lib/supabase/middleware.ts`:
- Added route protection: `/stats`, `/review`, `/summary` redirect to `/login` if no user
- Preserves original path in `?redirect=` param for post-login redirect
- Training routes (`/train`, `/training`, `/session/*`, etc.) remain guest-accessible
- `getUser()` call validates JWT against Supabase servers (not `getSession()` -- security)

Created `src/app/auth/callback/route.ts`:
- GET handler for OAuth PKCE code exchange
- Extracts `code` and `next` from searchParams
- Calls `exchangeCodeForSession(code)` on success
- Redirects to `next` param or `/` on success, `/login?error=auth_callback_failed` on failure

Created `src/app/auth/confirm/route.ts`:
- GET handler for email confirmation (magic links, password resets)
- Extracts `token_hash` and `type` from searchParams
- Calls `verifyOtp({ token_hash, type })` with proper `EmailOtpType` typing
- Redirects to `/` on success, `/login?error=confirmation_failed` on failure

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| getSession() for initial load, onAuthStateChange for updates | getSession() is synchronous from cache, avoids waiting for network on first render |
| Minimal context shape { user, loading } | Consumers only need user identity and loading state; session details are internal |
| Protected routes limited to /stats, /review, /summary | Training is the core UX -- guests must be able to train without friction |
| OAuth error redirects to /login with error param | Login page can display error message without a separate error page |
| EmailOtpType cast for type param | Supabase SDK requires typed OTP type; URL param is string |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes with zero errors
- `npm run build` produces all routes including `/auth/callback` and `/auth/confirm`
- Middleware listed as `Proxy (Middleware)` in build output
- AuthProvider exports both `AuthProvider` and `useAuth`
- Layout wraps children in AuthProvider

## Next Phase Readiness

Plan 11-04 (login/signup pages with Supabase Auth) can proceed. The auth context, middleware token refresh, and OAuth callback are all in place. Login/signup pages will use `createClient()` directly for `signInWithPassword`, `signUp`, and `signInWithOAuth`.
