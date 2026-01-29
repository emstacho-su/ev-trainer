# Steering — ev-dev-app (dev-grade)

## Purpose

* Deliver a dev-grade running app that exercises the EV-first trainer end-to-end for developers/operators.

## Non-negotiables

* **Non-copy constraint**: no GTOWizard UI/text/assets/branding/datasets/solver outputs. Original UX and data only.
* **Determinism contract**:

  * Every training call requires explicit `seed` and `sessionId`.
  * No `Date.now()` / `Math.random()` unless injected.
  * Stable ordering with explicit tie-breakers:

    * Review ordering: `evLossVsMix` desc, then `createdSeq` asc, then `recordId` asc.
    * Any other ordered lists must define deterministic secondary ordering (no real-time timestamps).
* **Engine purity**: `src/lib/engine/*` stays pure/deterministic unless a future spec explicitly changes it.
* **Scope guardrail**: this phase is spec + dev-grade UX; do not refactor core engine/runtime unless required by the active spec tasks.
* **Deferred persistence**: database/persistent storage is allowed later, but not required in this phase. Current phase uses export/import JSON as the dev-grade persistence contract.
* **No new big frameworks** unless a future spec explicitly adds them.
