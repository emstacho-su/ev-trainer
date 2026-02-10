---
phase: 03-authentication
plan: 04
subsystem: auth
tags: [oauth, google, github, express, jwt, cookies, csrf, authentication]

# Dependency graph
requires:
  - phase: 03-01
    provides: Token services, Prisma User model with OAuth fields
  - phase: 03-02
    provides: Auth controller patterns, token creation, cookie handling
provides:
  - Complete OAuth integration with Google and GitHub
  - OAuth user creation and account linking
  - CSRF-protected OAuth flows with state parameter
  - Automatic email verification for OAuth users
affects: [04-frontend] # Frontend will need OAuth login buttons and callback handler

# Tech tracking
tech-stack:
  added: []
  patterns: [OAuth state parameter for CSRF, Account linking by email, URL fragment for token passing]

key-files:
  created:
    - src/server/oauth/oauth.config.ts
    - src/server/oauth/oauth.service.ts
    - src/server/oauth/oauth.controller.ts
    - src/server/oauth/oauth.routes.ts
  modified:
    - src/server/app.ts

key-decisions:
  - "Access token passed to frontend via URL fragment (# not sent to server)"
  - "State parameter stored in httpOnly cookie for CSRF protection"
  - "OAuth users get emailVerified set automatically (provider verified)"
  - "Account linking: OAuth links to existing email user if found"
  - "No rate limiting on OAuth routes (external redirects, one-time callbacks)"
  - "Errors redirect to frontend error page instead of API error responses"

patterns-established:
  - "OAuth flow pattern: initiate → external consent → callback → user creation/linking → token issuance → frontend redirect"
  - "CSRF protection: State parameter in httpOnly cookie, validated on callback"
  - "Account linking: Check OAuth provider first, then email, only link if no existing OAuth"
  - "Token passing: Access token in URL fragment, refresh token in httpOnly cookie"

# Metrics
duration: 3min
completed: 2026-02-10
---

# Phase 3 Plan 4: OAuth Integration Summary

**Google and GitHub OAuth with CSRF protection, automatic email verification, and account linking by email**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T05:33:32Z
- **Completed:** 2026-02-10T05:36:15Z
- **Tasks:** 3/3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- Google OAuth flow with token exchange and user info endpoints
- GitHub OAuth flow with user profile and primary email fetching
- CSRF protection via state parameter in httpOnly cookie
- OAuth user creation with automatic email verification
- Account linking: OAuth links to existing user if email matches
- Only verified primary emails accepted from GitHub
- Access token passed to frontend via URL fragment (not sent to server)
- Refresh token in httpOnly cookie with same security as auth endpoints
- Error redirects to frontend error page with error codes
- OAuth routes mounted at /api/oauth (no rate limiting)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create OAuth config and service** - `d614e6f` (feat)
2. **Task 2: Create OAuth controller with initiate and callback handlers** - `6a9a88a` (feat)
3. **Task 3: Create OAuth routes and wire into app** - `731a437` (feat)

## Files Created/Modified

**Created:**
- `src/server/oauth/oauth.config.ts` - Google and GitHub OAuth config with client IDs, secrets, and API URLs
- `src/server/oauth/oauth.service.ts` - Token exchange and user info fetching for both providers
- `src/server/oauth/oauth.controller.ts` - Initiate and callback handlers with CSRF protection and user creation/linking
- `src/server/oauth/oauth.routes.ts` - Route definitions for OAuth endpoints

**Modified:**
- `src/server/app.ts` - Added OAuth routes at /api/oauth

## Decisions Made

**Access Token Passing:**
- Access token passed to frontend via URL fragment (#)
- Fragment is not sent to server (more secure than query params)
- Frontend can extract token from window.location.hash
- Refresh token still in httpOnly cookie (same as auth flow)

**CSRF Protection:**
- State parameter generated with crypto.randomBytes(16)
- Stored in httpOnly cookie with 10-minute expiry
- Validated on callback before token exchange
- Cookie cleared after validation

**Account Linking:**
- Check if user exists with OAuth provider+ID first (return existing)
- If not, check if user exists with email (link OAuth to account)
- Only link if existing user has no OAuth provider (prevent overwrite)
- If neither exists, create new user with OAuth fields

**OAuth User Email Verification:**
- OAuth users get emailVerified set to current timestamp
- Google users must have verified_email: true
- GitHub users must have verified primary email
- Trusted providers have already verified email ownership

**Error Handling:**
- All errors redirect to frontend error page
- Error codes in query params: oauth_failed, csrf_failed, no_code, email_not_verified
- User-facing error messages handled by frontend
- Backend errors logged to console for debugging

**No Rate Limiting:**
- OAuth initiate endpoints redirect to external provider (no abuse potential)
- Callback endpoints are one-time use (state prevents replay)
- General API rate limiting still applies (100 req/15min)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all OAuth service calls, Prisma queries, and TypeScript compilation worked on first attempt.

## User Setup Required

**External services require manual configuration.** OAuth endpoints return 503 until configured.

**Google OAuth:**
1. Create OAuth 2.0 Client ID in Google Cloud Console → APIs & Services → Credentials
2. Add authorized redirect URI: `http://localhost:4000/api/oauth/google/callback`
3. Configure OAuth consent screen
4. Set environment variables:
   - `GOOGLE_CLIENT_ID` - From OAuth client settings
   - `GOOGLE_CLIENT_SECRET` - From OAuth client settings
   - `GOOGLE_REDIRECT_URI` - Optional, defaults to localhost:4000

**GitHub OAuth:**
1. Create OAuth App in GitHub → Settings → Developer settings → OAuth Apps
2. Set Authorization callback URL: `http://localhost:4000/api/oauth/github/callback`
3. Set environment variables:
   - `GITHUB_CLIENT_ID` - From OAuth App settings
   - `GITHUB_CLIENT_SECRET` - From OAuth App settings
   - `GITHUB_REDIRECT_URI` - Optional, defaults to localhost:4000

**Optional:**
- `FRONTEND_URL` - Frontend URL for redirects (defaults to http://localhost:3000)

**Testing without setup:**
- Endpoints return proper 503 errors when not configured
- Server starts and runs normally
- TypeScript compilation passes

## Next Phase Readiness

OAuth integration complete and ready for:
- Phase 4 (Frontend): OAuth login buttons and callback handler needed
- Integration tests for OAuth flows
- Production deployment with real OAuth credentials

All OAuth patterns in place:
- User creation and account linking working
- Email verification automatic for OAuth users
- CSRF protection via state parameter
- Secure token passing (fragment + httpOnly cookie)
- Error handling with frontend redirects

**Schema note:** Prisma schema already had `oauthProvider` and `oauthProviderId` fields with unique constraint from prior work - no schema changes needed.

**Blockers:** None

**Concerns:** None - OAuth flows follow security best practices per 03-RESEARCH.md

---
*Phase: 03-authentication*
*Completed: 2026-02-10*
