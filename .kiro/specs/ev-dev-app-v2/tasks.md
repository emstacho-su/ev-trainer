# Tasks — ev-dev-app-v2

## Overview
Phase 1 delivers a minimal but complete Training/Practice loop in the browser using a single bundled SpotPack, Spot-first API routes, deterministic session selection, and localStorage persistence. Tasks are incremental and testable, with small vertical slices and explicit DoD. App-layer modules live under `src/lib/v2/*` and reuse existing engine types.

---

## T1 — SpotPack loader + minimal pack + filter matching

**Scope**
- Define minimal SpotPack JSON schema (per design).
- Add a single bundled pack under `public/packs/`.
- Implement pack loader (fetch + parse + validate minimal fields).
- Implement filter matching (AND-only, single-select street, bucketed stack sizes, potType ANY/SRP/3BP).
- Use engine types (Spot, SpotSource) and add v2 app-layer helpers under `src/lib/v2/`.
- Wire a SpotSource-backed helper that returns filtered candidate spots.

**Out of scope**
- Runtime session registry.
- API routes.
- UI flows.

**Files likely to change**
- `public/packs/ev-dev-pack-v1.json` (new)
- `src/lib/v2/packs/*` (loader/validator)
- `src/lib/v2/filters/*` (filter matching)
- `src/lib/v2/spot-source/*` (candidate selection helpers)

**Definition of Done**
- A minimal SpotPack loads from `public/packs/`.
- Filter matching returns expected spots for each filter value.
- SpotSource-backed helper returns filtered candidate spots.
- No GTOWizard data or assets are used.

**Tests to add/run**
- Unit tests for pack loader validation.
- Unit tests for filter matching (street, positions, stack buckets, potType ANY).
- Run: `npm test`

---

## T2 — Runtime session registry + deterministic spot selection

**Scope**
- Implement in-memory session registry keyed by `sessionId` + `seed`.
- Add deterministic spot selection using `{seed, sessionId, decisionIndex}` from filtered candidates.
- Add deterministic ordering for candidates (stable sort by `spotId`).
- Ensure no `Math.random()` or `Date.now()` used for selection.
- Define session end condition (e.g., `decisionsPerSession` default 10, configurable).

**Out of scope**
- API routes.
- UI.

**Files likely to change**
- `src/lib/runtime/*` (session registry, selection logic)
- `src/lib/determinism/*` (seeded RNG utility)
- `src/lib/v2/spot-source/*` (integration with selection)

**Definition of Done**
- Given the same seed + pack + filters, the sequence of selected spots is identical across runs.
- Session registry supports create/load/advance with `decisionIndex`.
- Session end condition is explicit and enforced.
- In-memory registry is documented as non-durable (dev-only; not serverless-safe).

**Tests to add/run**
- Unit tests for deterministic selection (same inputs -> same sequence).
- Run: `npm test`

---

## T3 — API routes for session lifecycle (Spot-first)

**Scope**
- Implement Next.js API routes:
  - `POST /api/session/start`
  - `POST /api/session/submit`
  - `POST /api/session/next`
  - `GET /api/session/:id`
- Use Spot-first payloads; avoid CanonicalNode unless required by existing tests.
- Training vs Practice response shapes per design.
- Validate inputs and return structured errors.
- Use App Router route layout:
  - `src/app/api/session/start/route.ts`
  - `src/app/api/session/submit/route.ts`
  - `src/app/api/session/next/route.ts`
  - `src/app/api/session/[id]/route.ts`

**Out of scope**
- UI wiring.
- localStorage persistence.

**Files likely to change**
- `src/app/api/session/*` (route handlers)
- `src/lib/runtime/*` (session registry integration)
- `src/lib/evaluator/*` (stub evaluator)
- `src/lib/errors/*` (error schema/helpers)

**Definition of Done**
- API routes respond with correct shapes for Training and Practice.
- Spot-first payload enforced on new endpoints.
- Error responses use stable schema.
- In-memory registry caveat documented (dev-only).

**Tests to add/run**
- API contract tests for start/submit/next and session/:id (Training vs Practice).
- Run: `npm test`

---

## T4 — localStorage persistence helpers + session index controls

**Scope**
- Implement localStorage helpers for:
  - session index (`ev-trainer:sessions:index`)
  - per-session record (`ev-trainer:session:<id>`)
- Add delete session + clear all sessions controls.
- Ensure persistence round-trip for session records.
- Handle quota errors gracefully.
- Place app-layer helpers under `src/lib/v2/storage/*`.

**Out of scope**
- Export/import.
- Global stats.

**Files likely to change**
- `src/lib/v2/storage/*` (localStorage helpers)
- `src/components/*` (delete/clear controls)
- `src/lib/types/*` (session metadata)

**Definition of Done**
- Sessions persist and can be restored on reload.
- Delete and clear controls work without corrupting index.
- Quota errors show a non-blocking warning state.

**Tests to add/run**
- Unit tests for storage round-trip (index + session).
- Run: `npm test`

---

## T5 — Core UI loop: Home + Setup + In-Session

**Scope**
- Home screen: Training/Practice entry points + recent sessions list.
- Session Setup: mode prefilled, filters, pack selection (single pack), start.
- In-Session: spot display + action input.
- Training: inline feedback panel (right side on desktop, modal on small screens).
- Practice: “Recorded” status area only.
- “Next decision” button to advance (no auto-advance).
- Session ends when `decisionsPerSession` reached; routes to Summary.

**Out of scope**
- Summary and Review.
- Global stats.

**Files likely to change**
- `src/app/*` (Home/Setup/In-Session routes)
- `src/components/*` (mode selector, forms, spot view, action input)
- `src/lib/v2/api-client/*` (client API calls)

**Definition of Done**
- User can start Training or Practice, submit an action, see appropriate feedback state, and advance.
- No EV metrics shown mid-session in Practice.

**Tests to add/run**
- UI smoke test: start session and submit action.
- Run: `npm test`

---

## T6 — Summary + Review screens with Practice gating

**Scope**
- End-of-session Summary with aggregates (mean EV loss, best-action rate, volume) and duration.
- Review Session list + decision drilldown with per-decision grading.
- Practice gating: review only after session ends.
- Persist aggregates in session record.

**Out of scope**
- Global stats.

**Files likely to change**
- `src/app/*` (Summary/Review routes)
- `src/components/*` (summary cards, review list, detail panel)
- `src/lib/aggregates/*` (session aggregates)

**Definition of Done**
- Summary appears at session end with aggregates and “Review session” button.
- Review list shows per-decision grading for both Training and Practice (after end).
- Practice sessions cannot view review before end.

**Tests to add/run**
- Unit tests for aggregate computation (mean EV loss, best-action rate).
- Run: `npm test`

---

## T7 — Global Stats endpoint + page

**Scope**
- `GET /api/stats` endpoint aggregating persisted sessions.
- Global Stats page with:
  - mean EV loss
  - best-action rate
  - volume (# decisions, # sessions)
  - basic breakdowns by filter buckets (street, potType, stack bucket).
- Data sourced from localStorage-derived records.

**Out of scope**
- Advanced analytics.
- Export/import.

**Files likely to change**
- `src/app/api/stats/route.ts`
- `src/app/stats/page.tsx`
- `src/lib/aggregates/*`

**Definition of Done**
- Stats page loads and displays top 3 metrics + breakdowns.
- Results match persisted session data.

**Tests to add/run**
- Unit tests for global aggregates + breakdowns.
- Run: `npm test`

---

## T8 — Test hardening: determinism + API + storage + UI

**Scope**
- Determinism replay test: Training vs Practice produce identical decision sequences given same seed + pack + filters.
- API contract tests for all session endpoints.
- Storage round-trip tests for session index + records.
- UI smoke test for core loop.

**Out of scope**
- Performance testing.
- E2E browser automation beyond smoke tests.

**Files likely to change**
- `src/__tests__/*`
- `src/lib/*` (test helpers/mocks)

**Definition of Done**
- Determinism replay test passes.
- API contract tests pass.
- Storage round-trip tests pass.
- UI smoke test passes.

**Tests to add/run**
- Run: `npm test`
