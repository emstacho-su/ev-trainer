# P1.T1 Solver Commercial Licensing Memo

Date: 2026-02-03
Owner: EV-Trainer v3 (P1.T1)
Status: Provisional recommendation (engineering/legal review required)

## Decision Summary
- Recommended primary path: use an existing open-source solver with a permissive license, subject to full dependency audit.
- Current recommendation: **provisionally approve OpenSpiel (Apache-2.0)** as first candidate for integration experiments.
- Fallback trigger: if dependency/license audit fails commercialization policy, switch to in-house solver track while preserving adapter interface.

## Why this memo exists
We need a solver strategy that supports future commercial sale/distribution of the product. Per v3 requirements, solver selection must pass a commercialization licensing gate before MVP integration.

## Candidates reviewed
1. **OpenSpiel** (`google-deepmind/open_spiel`) - License shown as Apache-2.0.
2. **openCFR** (`stockhamrexa/openCFR`) - License shown as MIT.
3. **poker-cfr** (`b-inary/poker-cfr`) - License shown as BSD-2-Clause.

## Commercial compatibility assessment (engineering view, not legal advice)
### OpenSpiel (Apache-2.0)
- Commercial-use posture: generally permissive for commercial use/distribution.
- Obligations to plan for: preserve license/notice requirements and attribution where required.
- Risk notes:
  - Mixed language stack (C++/Python) may increase packaging complexity.
  - Must validate transitive dependencies before final approval.

### openCFR (MIT)
- Commercial-use posture: generally permissive for commercial use/distribution.
- Obligations to plan for: include copyright/license notice.
- Risk notes:
  - Pure Python implementation; performance for large NLHE trees may be insufficient for product UX goals.
  - More likely useful for prototyping than production-scale solve workloads.

### poker-cfr (BSD-2-Clause)
- Commercial-use posture: generally permissive for commercial use/distribution.
- Obligations to plan for: retain license text and attribution.
- Risk notes:
  - Rust codebase; integration complexity depends on service/WASM strategy.
  - Must validate project maturity and maintenance fit.

## Recommendation
- **Proceed with OpenSpiel as default candidate** for design/implementation planning, contingent on passing the full dependency scan and legal review checklist.
- Keep `openCFR` and `poker-cfr` as backup candidates.
- Preserve provider adapter boundary so fallback to in-house solver does not change trainer-facing grading/runtime contracts.

## Required checklist before final legal sign-off
1. Produce SBOM for chosen integration package.
2. Run automated dependency license scan and capture report artifact.
3. Confirm no copyleft obligations are introduced via transitive dependencies for the distributed product model.
4. Capture NOTICE/attribution files required for shipping artifacts.
5. Legal review + written approval recorded.

## Explicit DoD status for P1.T1
- [x] Candidate solver licenses reviewed and documented.
- [x] Pass/fail logic with fallback trigger defined.
- [x] Recommendation provided (approved candidate vs fallback).
- [x] Legal/attribution obligations listed.
- [ ] Final legal sign-off (deferred to legal review step).

## Sources
- OpenSpiel repository: https://github.com/google-deepmind/open_spiel
- OpenCFR repository: https://github.com/stockhamrexa/openCFR
- poker-cfr repository: https://github.com/b-inary/poker-cfr
