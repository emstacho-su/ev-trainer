# Spec Init - ev-dev-app-v3

## Summary
Start the v3 spec cycle for EV-Trainer as a solver-backed training evolution of v2, while preserving EV-first grading, deterministic behavior, and the current Next.js App Router foundation. This phase defines the v3 problem and requirements only (no design/tasks/implementation).

## Baseline
Use `.kiro/specs/ev-dev-app-v2` and current runtime/API/UI modules as the baseline implementation reference.

## Scope highlights
- Add v3 requirements for preflop + postflop training experiences under one trainer surface.
- Keep EV as the primary metric for grading, review ordering, and progress reporting.
- Require open-source solver integration via adapter and canonical node hash caching.
- Keep opponent actions sampled from solver policy with deterministic seeded RNG.
- Enforce original UX/content; no GTOWizard-proprietary assets, copy, datasets, solver outputs, or branding.

## Non-goals (for this spec-init + requirements phase)
- No design doc, task breakdown, or production code changes.
- No irreversible infrastructure migration decisions without design-phase evaluation.
- No auth/payments or full production deployment implementation.
