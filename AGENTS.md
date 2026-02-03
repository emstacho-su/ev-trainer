# AGENTS.md - GTO Practice Trainer

## Hard workflow gate
- Use cc-sdd prompts in this order: spec-init -> requirements -> design -> tasks -> implementation.
- Do not write production code until `.kiro/specs/<SPEC_ID>/tasks.md` exists AND is committed.

## Scope (revigorated for v3)
- Current active implementation baseline is v2 (`.kiro/specs/ev-dev-app-v2`).
- Current planning track is v3 (`.kiro/specs/ev-solver-training-v3`).
- Until v3 tasks are generated and approved, work is limited to v3 spec docs only.
- Keep diffs small and scoped. For planning runs, limit changes to `.kiro/specs/<SPEC_ID>/*`.

## Non-copy constraint
- Do not copy GTOWizard proprietary UI, text, assets, datasets, solver outputs, or branding.
- Implement similar functionality with original UX and our own data structures.

## Metric priority
- EV is the primary metric everywhere:
  - grade decisions by EV (EV loss vs optimal / solver baseline)
  - track progress and review ordering by EV loss
- Secondary metrics are allowed (policy divergence, "pure mistake"), but EV is the source of truth.

## Solver integration
- MVP must integrate an existing open-source solver.
- Decide integration approach (service/WASM/hybrid) early and respect licensing.
- Cache solver outputs by canonical node hash.
- Any from-scratch solver R&D is future work unless explicitly approved in spec design/tasks.

## Opponent policy
- MVP: opponent acts from solver policy (sample from frequencies).
- Design must support future playstyle transforms (frequency reweighting) while keeping EV grading consistent.

## Engineering constraints
- Next.js (App Router) + TypeScript + Tailwind (unless explicitly changed in spec).
- Keep diffs small: one task per branch/commit when possible.
- Add unit tests for grading and sampling; prefer deterministic RNG seeds.
