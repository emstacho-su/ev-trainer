# Software Requirements Specification (SRS)
## EV Trainer — Runtime Preview (High-Level)

### 1. Purpose
This document provides a high-level Software Requirements Specification (SRS) for the EV Trainer codebase. The system is a deterministic training runtime for poker decision practice, with EV-first grading and review workflows. It includes a minimal Next.js runtime preview UI and thin API routes that exercise the deterministic engine.

### 2. Scope
The system supports:
- Deterministic training flows driven by explicit seeds and session IDs.
- Training modes: Spot Quiz, Hand Play, Targeted Drill, and Review.
- EV-first grading and review ordering (EV loss vs mix as primary).
- In-memory runtime only (no persistence, no auth, no external solver integration).

Out of scope:
- Database, authentication, payments, analytics, or telemetry.
- Production solver integration or licensing workflows.
- UI cloning of GTOWizard or other proprietary tooling.

### 3. Context and Constraints
- **Technology**: Next.js (App Router) + TypeScript + Tailwind.
- **Determinism**: All randomness must be driven by explicit seeds; timestamps and IDs are deterministic when injected.
- **EV-first**: Grading and review ordering use EV loss vs mix as primary metric.
- **Non-copy constraint**: Original UX/copy; no proprietary UI/text/assets/datasets.

### 4. Stakeholders and Users
- **Developers/Researchers**: Validate training engine behavior and determinism.
- **Trainers/Operators**: Manually run training flows end-to-end in a preview UI.

### 5. System Overview
The system consists of:
- **Engine (pure deterministic)**: Training orchestration, grading utilities, RNG, solver adapter contract, caching, and spot selection.
- **Runtime layer**: In-memory caches/stores and a deterministic demo solver wired into training APIs.
- **HTTP layer**: Thin Next.js API handlers that delegate to runtime.
- **UI layer**: Minimal runtime preview UI to manually drive training flows.

### 6. Functional Requirements
#### 6.1 Training API (runtime)
- Provide training endpoints for:
  - Spot Quiz (graded decision for a node).
  - Hand Play (advance a step with user action and optional opponent sampling).
  - Targeted Drill (deterministically select a spot from candidates and grade).
  - Review list (EV-first ordering, session scoped).
  - Review detail (retrieve a record and optional solver output).
- Require explicit `seed` and `sessionId` for determinism in runtime.
- Return EV grading metrics: `evUser`, `evMix`, `evBest`, `evLossVsMix`, `evLossVsBest`.

#### 6.2 Deterministic Behavior
- Same seed + sessionId + input payload yields stable outputs.
- Opponent action sampling must be deterministic.
- Targeted spot selection must be deterministic (seed + sequence index).
- Cache by canonical node hash; repeated requests should reuse cached solver output.

#### 6.3 Review and Progress
- Decision records stored in-memory per runtime/session.
- Review list sorted by EV loss vs mix (descending), then timestamp/id tie-break.

#### 6.4 Preview UI
- Minimal preview page (e.g., `/train`) to exercise all training flows.
- Explicit user inputs for seed and sessionId.
- Display EV-first metrics prominently.
- Provide review list → detail flow.

### 7. Non-Functional Requirements
- **Determinism**: Explicit seed/session for all training requests.
- **Performance**: In-memory cache should avoid redundant solver calls.
- **Testability**: Vitest-only tests (no running Next server required).
- **Maintainability**: Small, modular files; thin route handlers; minimal dependencies.

### 8. Assumptions and Dependencies
- Deterministic demo solver or mock solver provides consistent outputs.
- No external persistence; state is in-memory and resettable by runtime lifecycle.

### 9. Data Model (High-Level)
- **CanonicalNode**: Defines game state, history, action abstraction, and solver versions.
- **SolverNodeOutput**: Actions with frequencies and EVs (units in bb).
- **DecisionRecord**: Stored graded decision metadata with EV metrics and timestamps.

### 10. Interfaces
#### 10.1 HTTP Routes (training)
- `POST /api/training/spot-quiz`
- `POST /api/training/hand-play`
- `POST /api/training/targeted-drill`
- `POST /api/training/review/list`
- `POST /api/training/review/detail`

All endpoints expect explicit `seed` and `sessionId` in the request body.

#### 10.2 UI Entry
- `/train` page for manual runtime preview.

### 11. Quality and Testing
- Unit tests for grading, RNG determinism, solver caching, and training flows.
- Integration-style tests verifying determinism and cache hits without a running server.

### 12. Known Limitations
- In-memory only; data is not persisted across server restarts.
- Demo solver does not represent production solver behavior.
- UI is minimal and not production-grade.
