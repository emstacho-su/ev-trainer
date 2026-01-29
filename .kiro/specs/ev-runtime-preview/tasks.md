# Tasks — ev-runtime-preview

## Gates
- Requirements gate must pass before design/tasks are accepted:
  - `npx --yes promptfoo@latest eval -c promptfoo/requirements-gate.yaml`
- Tasks gate must pass before any implementation work:
  - `npx --yes promptfoo@latest eval -c promptfoo/tasks-gate.yaml`

## TASK A — Add Next.js runtime (minimal)
- Add Next.js + React deps and minimal config.
- Add App Router skeleton under `src/app/*`.

Definition of Done:
- `npm test` passes.
- `npm run dev` is documented as a manual step (not a required gate).

## TASK B — Runtime wiring module
- Create `src/lib/runtime/createRuntime.ts` (or similar) to build:
  - `MemoryNodeCache`
  - `MemoryDecisionStore`
  - `createTrainingApi(...)`
  - Deterministic demo `solve(...)`
  - Production `gradeDecision(...)` implementation (EV_mix, EV_best, losses)

Definition of Done:
- Unit tests for `gradeDecision` and a deterministic `spotQuiz → reviewList` flow.

## TASK C — Next API routes (thin wrappers)
- Implement App Router routes:
  - `/api/training/spot-quiz`
  - `/api/training/hand-play`
  - `/api/training/targeted-drill`
  - `/api/review/list`
  - `/api/review/detail`
- Keep handlers thin: parse input → call runtime API → return JSON.

Definition of Done:
- Unit tests call exported pure handler functions from `src/lib/runtime/http/*`.

## TASK D — Manual functional preview UI
- Implement a single page (`/train` or `/`) with tabs:
  - Spot Quiz
  - Hand Play
  - Targeted Drill
  - Review
- UI is original; EV loss feedback is prominent.
- Must allow explicit seed input and session id for reproducibility.

Definition of Done:
- Unit test verifies rendered HTML includes mode markers and EV labels.
- Manual steps documented in README or a short doc: how to run the preview.

## TASK E — Minimal integration tests (vitest)
- 2–4 tests maximum, focused:
  - determinism: same seed → same opponent sample / same selected targeted spot
  - cache behavior: solver called once for same node when cache hits

Definition of Done:
- Tests are stable and deterministic.
