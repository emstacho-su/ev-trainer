# AGENTS.md — GTO Practice Trainer

## Workflow gate
- Follow phases in `.planning/SPRINT-ROADMAP.md` in order.
- Each phase has success criteria and verification commands. Do not skip phases.
- Reference `.planning/AUDIT.md` for findings and `.planning/SOLVER-COMPARISON.md` for solver decisions.

## Non-copy constraint
- Do not copy GTOWizard proprietary UI, text, assets, datasets, solver outputs, or branding.
- Implement similar functionality with original UX and our own data structures.

## Metric priority
- EV is the primary metric everywhere:
  - grade decisions by EV (EV loss vs optimal / solver baseline)
  - track progress and review ordering by EV loss
- Secondary metrics allowed (policy divergence, “pure mistake”), but EV is the source of truth.

## Solver integration
- Use an existing open-source solver. Decide integration approach (service/WASM/hybrid) early and respect licensing.
- Cache solver outputs by canonical node hash.

## Opponent policy
- MVP: opponent acts from solver policy (sample from frequencies).
- Design must support future “playstyle transforms” (e.g., frequency reweighting) while keeping EV grading consistent.

## Engineering constraints
- Next.js (App Router) + TypeScript + Tailwind (unless explicitly changed in spec).
- Keep diffs small: one task per branch/commit when possible.
- Add unit tests for grading and sampling; prefer deterministic RNG seeds.
