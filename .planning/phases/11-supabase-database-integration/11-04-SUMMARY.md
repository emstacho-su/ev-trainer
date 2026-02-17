---
phase: 11-supabase-database-integration
plan: 04
subsystem: auth-ui
tags: [supabase, auth, login, signup, oauth, appheader]
completed: 2026-02-17
duration: 7 min
dependency-graph:
  requires: [11-03]
  provides: [login-page, signup-page, auth-error-page, auth-aware-header]
  affects: [11-05, 11-06]
tech-stack:
  added: []
  patterns: [supabase-client-auth, oauth-pkce-flow, auth-context-consumption]
key-files:
  created:
    - src/app/auth/error/page.tsx
  modified:
    - src/app/login/page.tsx
    - src/app/signup/page.tsx
    - src/components/AppHeader.tsx
decisions:
  - Login/signup use green accent for primary actions (poker theme consistency)
  - OAuth buttons use dark stone-800 background with provider logos (Google color, GitHub white)
  - Divider with "or" between OAuth and email/password sections
  - Error display uses red-900/30 background with red-400 text for visibility on dark theme
  - Auth error page wrapped in Suspense for useSearchParams SSR compatibility
  - AppHeader shows separator (vertical line) between nav links and auth section
  - Display name truncated at 20 chars with ellipsis for compact layout
  - Display name hidden on mobile (sm:inline), only Log Out button visible
  - Sign Up button uses green-600 bg (call-to-action style), Log In is text-only
---

# Phase 11 Plan 04: Login/Signup Pages and AppHeader Auth Summary

Supabase Auth UI with email/password + Google/GitHub OAuth login/signup, auth-aware AppHeader with user state display and logout.

## Task Results

### Task 1: Rebuild login and signup pages with Supabase Auth
**Commit:** 7777f7a

Rebuilt login and signup pages to use Supabase Auth directly instead of custom API routes:

- **Login page**: `signInWithPassword` for email/password, `signInWithOAuth` for Google and GitHub. Handles `?redirect` param and `?error=auth_callback_failed` from OAuth callback.
- **Signup page**: `signUp` with `data: { display_name }` metadata. Password confirmation and 8-char minimum validation. No email verification required (account active immediately per CONTEXT.md).
- **Auth error page**: New page at `/auth/error` displaying error message from `?message` search param with link back to login.
- **OAuth buttons**: Extracted as reusable `OAuthButtons` component within each page (Google with colored logo SVG, GitHub with white logo). Both redirect to `/auth/callback` for PKCE code exchange.
- **Styling**: Dark poker theme with green-600 primary buttons, stone-800/50 card containers, stone-900 inputs, consistent with existing app aesthetic.

### Task 2: Update AppHeader with auth-aware navigation
**Commit:** 6b73696

Updated AppHeader to reflect authentication state:

- **Not logged in**: Shows "Log In" (text style) and "Sign Up" (green button) links
- **Logged in**: Shows truncated display name or email + "Log Out" button that calls `supabase.auth.signOut()` then redirects to `/`
- **Loading**: Shows skeleton placeholder (animated pulse bar) to prevent button flash
- **Responsive**: Display name hidden on mobile via `sm:inline`, only logout button visible on small screens
- All existing navigation links (Dashboard, Training, Stats) and header functionality preserved

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run build` passes with all pages compiling successfully
- Login page renders with email/password form and Google/GitHub OAuth buttons
- Signup page renders with display name, email/password form, and OAuth buttons
- Auth error page renders with message and login link
- AppHeader imports and uses `useAuth` for user state
- Header shows login/signup when no user, user info + logout when authenticated
- All existing header navigation preserved

## Performance

- Duration: 7 minutes
- Tasks: 2/2 complete
- Build: clean pass
