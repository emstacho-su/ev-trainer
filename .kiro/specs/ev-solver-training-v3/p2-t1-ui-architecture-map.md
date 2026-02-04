# P2.T1 UI Architecture Map - Next.js Setup Alignment

Date: 2026-02-04
Task: P2.T1
Spec: `ev-solver-training-v3`

## 1. Objective
Establish a stable UI architecture baseline for Phase 2 without changing deterministic runtime/engine contracts.

## 2. Current Surface Map

### 2.1 Setup Surface
- Route: `/setup/[mode]`
- Entry: `src/app/setup/[mode]/page.tsx`
- Major components:
  - `src/components/SessionSetupForm.tsx`
- Data/API boundary:
  - `src/lib/v2/api-client/sessionClient.ts` -> `/api/session/start`
  - `src/lib/v2/storage/sessionStorage.ts` for local persistence

### 2.2 Session Surface
- Route: `/session/[id]`
- Entry: `src/app/session/[id]/page.tsx`
- Major components:
  - `src/components/SpotView.tsx`
  - `src/components/ActionInput.tsx`
  - `src/components/TrainingFeedbackPanel.tsx`
  - `src/components/PracticeRecordedStatus.tsx`
- Data/API boundary:
  - `src/lib/v2/api-client/sessionClient.ts` -> `/api/session/submit`, `/api/session/next`, `/api/session/[id]`
  - `src/lib/v2/storage/sessionStorage.ts`

### 2.3 Summary Surface
- Route: `/summary/[id]`
- Entry: `src/app/summary/[id]/page.tsx`
- Major components:
  - `src/components/SummaryStatsCards.tsx`
- Data/API boundary:
  - `src/lib/v2/api-client/sessionClient.ts` -> `/api/session/[id]`
  - `src/lib/aggregates/sessionAggregates.ts`
  - `src/lib/v2/storage/sessionStorage.ts`

### 2.4 Review Surface
- Route: `/review/[id]`
- Entry: `src/app/review/[id]/page.tsx`
- Major components:
  - `src/components/ReviewDecisionList.tsx`
  - `src/components/ReviewDecisionDetail.tsx`
- Data/API boundary:
  - `src/lib/v2/api-client/sessionClient.ts` -> `/api/session/[id]`

### 2.5 Train Surface (Runtime Preview)
- Route: `/train`
- Entry: `src/app/train/trainingPreview.tsx`
- Major components:
  - local preview composition in page file
- Data/API boundary:
  - runtime handlers in `src/lib/runtime/http/handlers.ts`
  - endpoints under `src/app/api/training/*`

## 3. Ownership Matrix (Authoritative)
- `src/app`
  - Owns route composition, page-level data wiring, and navigation.
  - MUST NOT contain grading, solver, or deterministic sampling logic.
- `src/components`
  - Owns reusable presentational and interaction components.
  - SHOULD receive typed props and avoid direct engine imports.
- `src/lib/ui`
  - Owns pure UI models/formatters/export helpers used by components.
  - MUST remain side-effect free.
- `src/lib/v2`
  - Owns v2 session flow business logic and browser persistence contracts.
- `src/lib/runtime`
  - Owns runtime construction, request handlers, and boundary adaptation.
- `src/lib/engine`
  - Owns deterministic core logic: hashing, cache, solver adapter, grading, policy sampling.

## 4. P2 Folder + Naming Conventions (Normative)
1. New route files MUST stay under `src/app/**/page.tsx` or `src/app/**/route.ts` using Next.js file conventions only.
2. Shared visual primitives MUST live under `src/components/ui/*`.
3. Feature-scoped components SHOULD live under `src/components/features/<surface>/*`.
4. Component filenames MUST use PascalCase (`PokerTable.tsx`, `SeatBadge.tsx`).
5. Non-component helper modules MUST use camelCase (`seatLayout.ts`, `tableTokens.ts`).
6. Client components MUST include `"use client"` only when interactivity/state/browser APIs are required.
7. Server/client boundaries MUST preserve App Router defaults: server-first composition, client logic pushed down-tree.
8. UI layers MUST consume typed contracts from `src/lib/*` and MUST NOT re-implement grading/sampling logic.
9. Accessibility: interactive composites MUST define keyboard behavior consistent with APG pattern guidance (tab stop entry + arrow-key intra-widget movement where applicable).
10. Determinism protection: UI changes MUST NOT alter runtime request semantics (`seed`, `sessionId`, sequence inputs) for existing endpoints.

## 5. Setup Alignment Changes Applied in P2.T1
- Fixed Tailwind content scanning drift:
  - `tailwind.config.js` now scans `src/components/**/*.{ts,tsx}` in addition to existing app/lib paths.
- Rationale:
  - component classes were at risk of being omitted from generated CSS in production builds if files under `src/components` were not scanned.

## 6. Migration Debt Register
- High: runtime preview tabs in `src/app/train/trainingPreview.tsx` should migrate to an explicit accessible tabs/toolbar pattern in P2.T9.
- Medium: `src/components/RangeMatrix.tsx` is not yet wired into route surfaces; integrate in P2.T8.
- Medium: mixed v2 and runtime-preview API surfaces should remain isolated until explicit consolidation task is created.

## 7. Best-Practice References Used
- Next.js App Router overview and server/client component model.
- Next.js project structure, colocation, and route groups conventions.
- Next.js route handler conventions (`route.ts` in `app`).
- Tailwind content scanning requirements.
- WAI-ARIA APG keyboard interface and tabs pattern guidance.
- WCAG 2.2 focus and interaction baseline guidance.
