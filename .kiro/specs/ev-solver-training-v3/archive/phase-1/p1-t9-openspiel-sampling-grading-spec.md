# P1.T9 - OpenSpiel Sampling + EV Grading Hookup

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## Goal
Wire OpenSpiel solver outputs into deterministic opponent sampling and EV-first grading.

## Flow
1. Resolve node via solver adapter (`openSpielSolve`) and normalize actions.
2. Sample opponent action from normalized frequencies with deterministic seed context:
   - `seed`, `nodeHash`, `sequenceIndex`
3. Grade user decision with EV-first formulas:
   - `evUser`, `evMix`, `evBest`, `evLossVsMix`, `evLossVsBest`
4. Persist record and metrics for review sorting.

## Determinism Contract
- Same request context must produce same sampled sequence and same EV grading outputs.
- Sampling must be stable under canonical action ordering.

## Provenance
- Graded solver outputs keep OpenSpiel metadata:
  - `provider`
  - `source`
  - `nodeHash`
