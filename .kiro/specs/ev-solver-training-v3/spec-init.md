# ev-solver-training-v3 — Spec Init (v3)

## Status
- Stage: tasks (phase-2)
- Spec ID: ev-solver-training-v3
- Version: v3 (new track; v2 remains the active implementation baseline)
- Updated: 2026-02-04
- Transition State: Phase 1 deliverables are complete and archived; this spec now prepares Phase 2 planning and implementation.

## Background (from v2 snapshot)
The repo currently contains a working Next.js App Router “runtime preview” with:
- Seed-driven deterministic sessions/decisions
- Training vs Practice modes, with Practice review gating until completion
- Summary + Review flows (per-decision grading + session aggregates)
- Thin API handlers over a pure deterministic engine (`src/lib/engine/*`)
- Client-side persistence via a safe storage wrapper and session records

This v3 spec introduces a solver-centric training direction while preserving key constraints:
- No cloning or reuse of third-party UI/text/assets/datasets/solver outputs/branding
- EV is the primary evaluation metric
- Determinism remains a core property (seeded generation + stable solver inputs/results)
- Future solver integration must support canonical node hashing + caching

## Problem Statement
The current engine-driven training loop supports deterministic drills and grading, but it does not define a solver-backed strategy model, nor a stable caching strategy for solver nodes/solutions. The new direction requires a solver-backed training platform (preflop and postflop) with range visualization and solver result caching.

## Goals (v3)
1. Define requirements for a solver-backed training platform (local-first MVP).
2. Define requirements for canonical node hashing and cacheability of solver results.
3. Define requirements for training modes (preflop/postflop) and range visualization UI primitives (13x13 matrix).
4. Preserve the repo’s deterministic workflow principles and testing/gate discipline.

## Non-Goals (v3, unless explicitly pulled in later)
- Production-grade solver implementation in this phase (this spec cycle is requirements-only for now).
- Shipping or embedding proprietary solver outputs or third-party datasets.
- Building a full paid SaaS stack (auth/payments/cloud deployment) as part of the initial v3 MVP scope unless later approved in design/tasks.

## Primary Users
- Poker learners who want repeated decision practice with EV-based grading.
- Advanced users who want drill filters and review of mistakes by spot type.

## Success Metrics (definition-level)
- Training decisions are graded primarily by EV loss versus solver-recommended strategy.
- Solver queries are cacheable via canonical node hashes and repeatable across sessions.
- Range visualization communicates action frequencies clearly and supports inspection (hover/tooltips) and export.

## Key Constraints
- Non-copy constraints: no GTOWizard cloning (no UI/text/assets/datasets/solver outputs/branding).
- EV is primary metric; other metrics are secondary.
- Keep solver integration path + canonical node hash caching in mind.
- Maintain small diffs scoped to `.kiro/specs/ev-solver-training-v3/*` for this run.

## References
- v2 spec path: `.kiro/specs/ev-dev-app-v2/`
- Current implemented flows: Home → Setup → Session → Summary → Review (gated for Practice)
- Existing runtime principles: seeded determinism, thin API layer, unit-tested core modules
- Phase 1 archive path: `.kiro/specs/ev-solver-training-v3/archive/phase-1/`

## Phase 2 Preparation Summary
1. Use archived Phase 1 specs/contracts as immutable baseline inputs for Phase 2 planning.
2. Preserve binding constraints:
   - EV-first grading remains primary
   - deterministic replay/hash/cache behavior remains required
   - non-copy policy remains required
3. Start Phase 2 by generating a new requirements/design/tasks sequence focused on:
   - operational hardening of OpenSpiel runtime path
   - CI gate automation with local/CI parity
   - UX/productization of preflop/postflop flows
