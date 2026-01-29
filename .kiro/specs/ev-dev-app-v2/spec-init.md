# Spec Init — ev-dev-app-v2

## Summary

Build v2 dev app UX that cleanly separates Training (per-decision grading + end-of-session summary) from Practice (no metrics during run; review unlocked at end), with EV-first metrics, a minimum viable filter set (street, hero/villain position, effective stack bucket, pot type), localStorage persistence for session records, a Spot-first runtime API boundary, and an Evaluator-preserving path toward server-side solver integration.

## Baseline

Use `.kiro/specs/ev-dev-app` as the prior spec reference; v2 is a new spec for clarity and iteration.

## Scope highlights

- Training vs Practice interaction patterns (no separate preflop/postflop modes).
- EV-first grading and reporting, with a minimal global stats set.
- Minimum viable filtering for spot selection.
- Local-only persistence for sessions (localStorage).
- Spot-first API boundary in runtime routes.
- Server-side solver integration path that preserves the Evaluator boundary.

## Non-goals (for this spec-init)

- Board texture buckets beyond the minimum filters.
- Final persistence/export workflow.
- Changing core engine determinism constraints.
