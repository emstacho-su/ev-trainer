# Steering — ev-drill-trainer (EV-first)

## Non-negotiables
- **Spec-driven workflow**: no production code until `.kiro/specs/ev-drill-trainer/tasks.md` exists **and is committed**.
- **Promptfoo gates**:
  - Requirements gate must pass before design/tasks work is accepted:
    - `npx --yes promptfoo@latest eval -c promptfoo/requirements-gate.yaml`
  - Tasks gate must pass before any implementation is accepted:
    - `npx --yes promptfoo@latest eval -c promptfoo/tasks-gate.yaml`
- **EV is the north star**:
  - Primary metric: `EV_loss_vs_mix = EV_mix(node) - EV_user`
  - Store (at least internally): `EV_user`, `EV_mix`, `EV_best`, `EV_loss_vs_mix`, `EV_loss_vs_best`
  - Review ordering and progress analytics are EV-first (`EV_loss_vs_mix`).
- **Solver integration**:
  - Use an **open-source solver** (license respected).
  - Must define a **solver adapter contract** (inputs/outputs) and keep the trainer engine solver-agnostic.
  - **Caching** keyed by **canonical node hash**, versioned by (game family, abstraction, solver config/version).
- **Determinism**:
  - Deterministic RNG seeding for opponent sampling and reproducible tests.
- **Opponent policy extensibility**:
  - Base: sample from solver mixed policy.
  - Future: transforms as reweighting over base frequencies: `p'(a) = Normalize(p(a) * w(a, context, params))`
  - MVP grading remains solver-anchored (EV_best / EV_mix).
- **Non-copy constraint**:
  - No GTOWizard UI/text/assets/branding/datasets/solver outputs. Original UX and structures only.

## Early testing requirements
- Provide a **mock solver** adapter for unit tests.
- Include **golden EV tests** for grading and deterministic sampling.
