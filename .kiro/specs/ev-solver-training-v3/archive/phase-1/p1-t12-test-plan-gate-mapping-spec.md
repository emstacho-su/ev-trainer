# P1.T12 - Test Plan and Gate Mapping Spec

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## 1) Objective
Define a strict Phase-1 verification plan that is directly executable in this repository and makes completion auditable for each P1 task.

The output must be implementation-ready: a contributor should be able to run commands, inspect specific evidence, and determine pass/fail without interpretation drift.

## 2) Research Summary and Best-Practice Implications
Date of review: 2026-02-04

Sources:
- Vitest coverage and thresholds (official docs): https://vitest.dev/guide/coverage.html
- TypeScript `noEmit` behavior (official TSConfig reference): https://www.typescriptlang.org/tsconfig/noEmit.html
- Next.js production build contract (official docs): https://nextjs.org/docs/app/api-reference/cli/next
- RFC 8174 requirement keywords (`MUST`, `SHOULD`, etc.): https://www.rfc-editor.org/rfc/rfc8174
- GitHub Actions workflow syntax (official docs; CI implementation target): https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions

Implications used in this spec:
1. Gate commands must be deterministic, ordered, and identical between local runs and CI.
2. Requirement language must be normative and unambiguous (RFC 8174 style).
3. Verification rows must map to concrete test files/suites to avoid "done by assumption".
4. CI implementation should be straightforward from this document (single job or staged jobs with fail-fast behavior).

## 3) Gate Policy (Normative)
For any P1 task completion claim:
1. `npm test` MUST pass.
2. `npx tsc --noEmit --pretty false` MUST pass.
3. `npm run build` MUST pass.

Execution rules:
- Gates MUST run in listed order and MUST stop on first failure.
- A failed gate MUST be rerun from a clean command invocation after fixes.
- A task is not complete until all gates pass on the same branch state.

## 4) Traceability Matrix (P1)
Each row defines minimum acceptance evidence. These are minimums; additional tests are allowed.

| Task | Requirement Focus | Minimum Verification | Command | Evidence |
|---|---|---|---|---|
| P1.T1 | Solver commercialization gate | Memo reviewed and recommendation explicit | manual + doc review | committed memo path + decision text |
| P1.T2 | Adapter contract stability | Contract tests compile and pass; normalization rules asserted | `npm test -- src/lib/engine/solverAdapterV2.test.ts` | passing suite output |
| P1.T3 | Canonical hash determinism | Equivalent payload same hash; non-equivalent payload different hash | `npm test -- src/lib/engine/canonicalHash.test.ts` | passing vectors in test output |
| P1.T4 | Cache architecture behavior | miss->store->hit behavior and invalidation semantics validated | `npm test -- src/lib/engine/nodeCache.test.ts src/lib/engine/solverResolver.test.ts` | passing cache flow assertions |
| P1.T5 | Deterministic sampling | same seed/context => same action sequence | `npm test -- src/lib/engine/opponentPolicy.test.ts` | replay/tie-break tests pass |
| P1.T6 | EV grading math | formulas + deterministic review order validated | `npm test -- src/lib/engine/grading.test.ts src/lib/engine/decisionStore.test.ts` | grading/order assertions pass |
| P1.T7 | OpenSpiel runtime path | live/provider path normalized and typed error handling validated | `npm test -- src/lib/engine/openSpielSolver.test.ts` | provider integration assertions pass |
| P1.T8 | Versioned cache + canonical hash | memory/persistent cache and version miss behavior validated | `npm test -- src/lib/runtime/createRuntime.test.ts src/lib/engine/solverResolver.test.ts` | persistent cache + version tests pass |
| P1.T9 | OpenSpiel sampling + EV grading hookup | end-to-end flow solve->sample->grade->persist validated | `npm test -- src/lib/runtime/integration.test.ts` | integration flow assertions pass |
| P1.T10 | Scenario contract | preflop/postflop validation + deal-only filtering validated | `npm test -- src/lib/engine/scenarioContract.test.ts` | schema contract assertions pass |
| P1.T11 | 13x13 matrix interaction contract | deterministic layout/tooltip/export behavior validated | `npm test -- src/lib/ui/rangeMatrix.test.ts` | matrix contract assertions pass |
| P1.T12 | Test-plan readiness | full matrix + gate map + evidence template documented | doc review + full gates | committed spec + gates pass |

## 5) Test-Type Coverage Matrix
Minimum test type expectations by concern:
- Hash canonicalization: unit tests with equivalence/non-equivalence vectors.
- Sampling determinism: unit tests with replay and tie-break controls.
- EV grading: unit tests with formula vectors and edge cases.
- Runtime wiring: integration tests validating resolver + orchestration flow.
- Contract validation: unit tests for strict reject/accept payload boundaries.
- UI contract (non-visual): deterministic serializer/model tests for matrix behavior.

## 6) PR Evidence Template (Required)
Every P1 completion PR SHOULD include:
1. Task ID(s) covered.
2. Changed artifact paths.
3. Gate outputs:
   - `npm test`: pass summary
   - `npx tsc --noEmit --pretty false`: pass/fail summary
   - `npm run build`: pass/fail summary
4. Commit SHA and run date (UTC).
5. Any known residual risk or deferred work explicitly labeled.

## 7) CI Implementation Path (Practical)
Recommended next implementation:
1. Add GitHub Actions workflow with Node version pinning.
2. Install deps via `npm ci`.
3. Run the three gates in order with fail-fast behavior.
4. Publish test output artifacts on failure for debugging.

This remains non-proprietary and fully aligned with repository constraints.

## 8) Strict DoD (End Product Requirements)
- [ ] `tasks.md` includes expanded strict DoD for T12.
- [ ] This spec is committed and includes:
  - [ ] normative gate policy
  - [ ] complete P1 traceability matrix (`P1.T1`..`P1.T12`)
  - [ ] coverage expectations by concern area
  - [ ] PR evidence template
  - [ ] concrete CI implementation path
- [ ] All gate commands are explicitly listed and match repository scripts/tools.
- [ ] Output is actionable for immediate CI wiring with no proprietary copied content.
