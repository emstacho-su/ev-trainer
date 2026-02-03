# External Integrations

**Analysis Date:** 2026-02-03

## APIs & External Services

**Third-Party APIs:**
- None detected

**Internal APIs:**
- Session management endpoints (self-hosted via Next.js)
  - `POST /api/session/start` - Start or resume a training session
  - `POST /api/session/submit` - Submit action and receive grading
  - `POST /api/session/next` - Get next decision spot
  - `GET /api/session/[id]` - Retrieve session details
  - Location: `src/app/api/session/` routes
  - Client: `src/lib/v2/api-client/sessionClient.ts`

**Training-specific Endpoints:**
- `POST /api/training/spot-quiz` - Spot quiz mode handler
- `POST /api/training/hand-play` - Hand play mode handler
- `POST /api/training/targeted-drill` - Targeted drill mode handler
- `GET /api/training/review/list` - List review sessions
- `GET /api/training/review/detail` - Get detailed review for session
- Location: `src/app/api/training/`

**Analytics Endpoints:**
- `GET /api/stats` - Compute global statistics from encoded session records
  - Transport: Base64-encoded records in `x-ev-trainer-sessions` header
  - Location: `src/app/api/stats/route.ts`

## Data Storage

**Databases:**
- None (no external database)

**Local Storage:**
- Browser localStorage (client-side only)
  - Session index: key `ev-trainer:sessions:index`
  - Session records: key pattern `ev-trainer:session:[sessionId]`
  - Implementation: `src/lib/v2/storage/sessionStorage.ts`
  - Fallback: Graceful degradation if storage unavailable (private mode, quota exceeded)
  - Durable across page reloads within same browser

**In-Memory Storage:**
- Session Store: `src/lib/v2/sessionStore.ts`
  - Per-request session state (current spot, entries, metrics)
  - Pluggable backend (InMemorySessionStoreBackend default)
  - Runtime-scoped (cleared on server restart)

**File-Based Data:**
- Bundled pack: `public/packs/ev-dev-pack-v1.json`
  - Loaded server-side at startup
  - Cached in memory: `cachedPack` in `src/lib/v2/packs/loadBundledPack.ts`
  - Schema version 1, contains poker spot definitions with metadata
  - No dynamic file upload/storage

## Authentication & Identity

**Auth Provider:**
- None (application is public, no authentication)

**User Identification:**
- Seed parameter: User-provided string for deterministic session replay
  - Location: Session start request in `src/lib/v2/api-client/sessionClient.ts`
  - Used for deterministic random seeding in `src/lib/engine/`
- Session ID: Application-generated per session
  - Generated at session start, paired with seed for recovery

**Access Control:**
- None (all API endpoints are public)
- No authorization checks
- No rate limiting detected

## Monitoring & Observability

**Error Tracking:**
- None detected
- Custom error class: `SessionApiError` in `src/lib/v2/api-client/sessionClient.ts`
  - Wraps HTTP errors with code and message normalization
  - Status codes: 400 (invalid argument), 5xx (server errors)

**Logs:**
- Console logging only (development)
- No log aggregation service
- No structured logging framework

**Performance Monitoring:**
- None detected
- Test coverage includes performance assertions (determinism checks in `src/__tests__/`)

## CI/CD & Deployment

**Hosting:**
- Not specified in codebase
- Compatible with: Vercel (Next.js native), Node.js servers, Docker containers

**CI Pipeline:**
- None detected in codebase
- Test command: `npm test` (runs vitest)
- Build command: `npm run build` (Next.js build)

**Secrets Management:**
- No secrets required for basic operation
- No .env files in repository
- Environment configuration: application defaults (no external service keys)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Client-Server Communication

**HTTP Methods Used:**
- POST - Session creation, action submission, decision requests
- GET - Session retrieval, statistics fetching

**Content Type:**
- `application/json` - All request/response bodies
- Fetch API used (browser native): `src/lib/v2/api-client/sessionClient.ts`
- NextRequest/NextResponse for server routes

**Error Response Format:**
- Standardized error envelope:
  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human readable message"
    }
  }
  ```
- Location: `src/app/api/session/start/route.ts` example

**Session Transport:**
- Seed + SessionId in request bodies for deterministic replay
- Session state encoded in localStorage for persistence
- Base64 encoding for header transport (stats API)

## Data Encoding & Serialization

**Session Serialization:**
- Custom serialization via `src/lib/engine/sessionRecord.ts`
- Functions: `serializeSession()`, `deserializeSession()`
- Schema version: v1 (included in serialized data)
- Supports roundtrip serialization for storage and recovery

**Spot Validation:**
- Custom validator: `validateSpot()` in `src/lib/engine/spot.ts`
- Uses schema version 1
- Validates poker game state (positions, stacks, board, action history)

**Pack Format:**
- Custom parser: `parseSpotPack()` in `src/lib/v2/packs/spotPack.ts`
- JSON format with metadata: packId, name, version, createdAt
- SpotEntry structure: spot (game state) + meta (filter metadata)

---

*Integration audit: 2026-02-03*
