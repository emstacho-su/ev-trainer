# Task Research Methodology (Phase 2+)

Purpose: define a repeatable, strict workflow for executing one task at a time with evidence-backed decisions.

## 1) Start a New Task Branch
- Create one branch per task: `p<phase>-t<id>-<slug>`.
- Confirm only expected carry-over changes exist (ignore `tsconfig.tsbuildinfo` if unchanged behavior).

## 2) Research Sprint (Task-Specific)
- Scope research to the active task only.
- Collect at least:
  - official framework/docs guidance
  - accessibility standards relevant to the task
  - 2-3 implementation patterns (tradeoffs)
  - examples/reference implementations (non-proprietary)
- Capture findings in a task doc:
  - `.kiro/specs/ev-solver-training-v3/p<phase>-t<id>-<topic>-research.md`

## 3) Requirements Refinement
- Update only the active task block in:
  - `.kiro/specs/ev-solver-training-v3/tasks.md`
- Convert generic scope into strict, testable requirements:
  - explicit artifacts (file paths)
  - measurable acceptance criteria
  - constraints and non-goals
  - validation evidence required

## 4) Strict End Products Definition
- For each task, define:
  - exact docs to produce
  - exact code modules/components/contracts to add or modify
  - exact tests to add
  - exact surfaces to integrate
- Add fail-fast criteria for invalid states/configs where relevant.

## 5) Implementation Plan Before Coding
- Write a short plan:
  - files to change
  - risks/regressions
  - how determinism + EV-first constraints are preserved
- Keep scope to one task only.

## 6) Implement
- Build the smallest complete slice that satisfies the refined DoD.
- Keep runtime/engine API contracts stable unless task explicitly allows contract changes.
- Maintain non-copy policy (original visuals/labels/assets).

## 7) Verification Gates (Required)
1. `npm test`
2. `npx tsc --noEmit --pretty false`
3. `npm run build`

- Also include task-specific checks (e.g., geometry determinism tests, a11y checks).

## 8) Evidence and Traceability
- In task doc or commit notes, include:
  - what was implemented
  - which DoD bullets are satisfied
  - command results for the three required gates
  - residual follow-ups (if any), mapped to next tasks

## 9) Commit + Push
- Commit message format:
  - `Implement P<phase>.T<id> <task summary>`
- Push branch and create PR.

## 10) Transition to Next Task
- Create next task branch from current baseline.
- Repeat steps 2-9.

---

## Per-Task Checklist Template

Use this checklist at task kickoff:

- [ ] Task branch created
- [ ] Task-specific research doc created
- [ ] `tasks.md` task block updated with strict DoD
- [ ] End-product artifacts explicitly listed
- [ ] Implementation plan written
- [ ] Code + tests implemented
- [ ] `npm test` passed
- [ ] `npx tsc --noEmit --pretty false` passed
- [ ] `npm run build` passed
- [ ] Commit + push completed

