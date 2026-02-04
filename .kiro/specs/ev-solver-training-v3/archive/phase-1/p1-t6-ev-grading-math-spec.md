# P1.T6 - EV Grading Math Spec

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## Goal
Freeze EV-first grading formulas and deterministic review ordering for MVP.

## Inputs
- Solver actions: `{ actionId, frequency, ev }[]`
- User action id
- Best-action epsilon: `epsilon >= 0` (default `1e-9`)

## Formula Sheet
Let:
- `A` be the non-empty action set
- `ev_i` be EV for action `i`
- `f_i` be raw frequency for action `i`
- `p_i = f_i / sum_j(f_j)` (normalized frequencies, `sum_j(f_j) > 0`)
- `u` be the user-selected action

Then:
- `evUser = ev_u`
- `evBest = max_i(ev_i)`
- `evMix = sum_i(p_i * ev_i)`
- `evLossVsMix = max(0, evMix - evUser)`
- `evLossVsBest = max(0, evBest - evUser)`
- `isBestAction = evLossVsBest <= epsilon`
- `pureMistake = evLossVsBest > epsilon`
- `policyDivergence = clamp(1 - p_u, 0, 1)`

## Validation Rules
- Action list must be non-empty.
- All frequencies and EVs must be finite numbers.
- Frequencies must be `>= 0`.
- Sum of frequencies must be `> 0`.
- User action id must exist in action set.

## Worked Example 1 (Mixed Node)
Actions:
- CHECK: `f=0.6`, `ev=1.2`
- BET_75PCT: `f=0.4`, `ev=0.4` (user choice)

Computed:
- `evMix = 0.6*1.2 + 0.4*0.4 = 0.88`
- `evBest = 1.2`
- `evUser = 0.4`
- `evLossVsMix = 0.48`
- `evLossVsBest = 0.8`
- `isBestAction = false` (for default epsilon)

## Worked Example 2 (Near-Tie Epsilon)
Actions:
- CHECK: `f=0.5`, `ev=1.0000000000` (user choice)
- BET_75PCT: `f=0.5`, `ev=1.0000000005`

Computed:
- `evBest - evUser = 5e-10`
- with default `epsilon=1e-9`, `isBestAction = true`
- with `epsilon=1e-12`, `isBestAction = false`

## Review Ordering Tie-Breakers
1. `evLossVsMix` descending (primary)
2. `createdSeq` ascending
3. `recordId` ascending
