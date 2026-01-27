# ev-drill-trainer — Implementation Tasks

**Gate requirement:** Tasks must be ordered, small, and each includes a Definition of Done.

## Task 1: Define core domain models, filters, and action abstraction rules

**Requirements:** 0.1, 0.2, 0.3, 6

### Work items
- [ ] Specify SpotFilters, action identifiers, and decision grade structures used across UI and API
- [ ] Implement deterministic size-mapping for non-abstract user bet/raise sizes with tie-break rule
- [ ] Establish tree restriction defaults (bet sizes, raise sizes, max raises) and config validation

### Definition of Done
- [ ] Implementation complete and reviewed for correctness.
- [ ] Unit tests added/updated where applicable.
- [ ] Determinism preserved (seeded RNG or stable hashing) if this task touches sampling/hashing.
- [ ] Documentation/comments updated if interfaces changed.

## Task 2: Build solver adapter contract and canonical node hashing

**Requirements:** 4, 4.1, 4.2, 5

### Work items
- [ ] Define adapter request/response types and validation for solver outputs (frequency sums, unit consistency)
- [ ] Implement canonical node hash builder with versioned inputs and stable serialization
- [ ] Provide mock solver adapter for local development and tests

### Definition of Done
- [ ] Implementation complete and reviewed for correctness.
- [ ] Unit tests added/updated where applicable.
- [ ] Determinism preserved (seeded RNG or stable hashing) if this task touches sampling/hashing.
- [ ] Documentation/comments updated if interfaces changed.

## Task 3: Implement caching layers for solver outputs

**Requirements:** 5, 10

### Work items
- [ ] Add memory cache (LRU) keyed by canonical node hash and version tuple
- [ ] Add persistent cache storage and retrieval with versioned keys
- [ ] Emit cache hit/miss telemetry for repeated node requests

### Definition of Done
- [ ] Implementation complete and reviewed for correctness.
- [ ] Unit tests added/updated where applicable.
- [ ] Determinism preserved (seeded RNG or stable hashing) if this task touches sampling/hashing.
- [ ] Documentation/comments updated if interfaces changed.

## Task 4: Add deterministic RNG and opponent policy sampling

**Requirements:** 3, 3.1, 3.2

### Work items
- [ ] Implement seeded RNG utility shared by server logic and tests
- [ ] Implement opponent policy sampling from solver mixed frequencies with reproducible seeding
- [ ] Add transform pipeline structure for future playstyle reweighting without changing EV grading

### Definition of Done
- [ ] Implementation complete and reviewed for correctness.
- [ ] Unit tests added/updated where applicable.
- [ ] Determinism preserved (seeded RNG or stable hashing) if this task touches sampling/hashing.
- [ ] Documentation/comments updated if interfaces changed.

## Task 5: Implement EV grading and decision recording pipeline

**Requirements:** 2.1, 2.2, 2.3, 2.4, 7

### Work items
- [ ] Compute EV_mix, EV_best, EV_user, EV_loss_vs_mix, EV_loss_vs_best for each decision
- [ ] Persist decision records with config snapshot, seed, and timestamps
- [ ] Ensure EV_loss_vs_mix is the primary metric for ordering and summaries

### Definition of Done
- [ ] Implementation complete and reviewed for correctness.
- [ ] Unit tests added/updated where applicable.
- [ ] Determinism preserved (seeded RNG or stable hashing) if this task touches sampling/hashing.
- [ ] Documentation/comments updated if interfaces changed.

## Task 6: Implement training orchestration flows and spot selection

**Requirements:** 0.4, 1, 6, 10

### Work items
- [ ] Spot Quiz flow: fetch node, grade one action, store decision
- [ ] Hand Play flow: advance through multiple nodes with opponent sampling and grading
- [ ] Targeted Drill spot selection honoring streets, board buckets, and tree restrictions

### Definition of Done
- [ ] Implementation complete and reviewed for correctness.
- [ ] Unit tests added/updated where applicable.
- [ ] Determinism preserved (seeded RNG or stable hashing) if this task touches sampling/hashing.
- [ ] Documentation/comments updated if interfaces changed.

## Task 7: Build API routes for training modes and review

**Requirements:** 1, 7, 10

### Work items
- [ ] API endpoints for spot quiz, hand play steps, targeted drill, and review list/details
- [ ] Return solver actions, grading output, and decision metadata to the UI
- [ ] Ensure review ordering is EV_loss_vs_mix descending by default

### Definition of Done
- [ ] Implementation complete and reviewed for correctness.
- [ ] Unit tests added/updated where applicable.
- [ ] Determinism preserved (seeded RNG or stable hashing) if this task touches sampling/hashing.
- [ ] Documentation/comments updated if interfaces changed.

## Task 8: Create original UI for all modes and toggles

**Requirements:** 1, 6, 7, 8, 9, 10

### Work items
- [ ] Spot Quiz UI with action choices and EV-focused feedback
- [ ] Hand Play UI with action log and stepper progression
- [ ] Review/Mistakes UI ordered by EV_loss_vs_mix with details view
- [ ] Targeted Drill UI with filter controls (streets, board buckets, tree restrictions, verbosity)
- [ ] Responsive layout and original copy/visuals to avoid GTOWizard similarity

### Definition of Done
- [ ] Implementation complete and reviewed for correctness.
- [ ] Unit tests added/updated where applicable.
- [ ] Determinism preserved (seeded RNG or stable hashing) if this task touches sampling/hashing.
- [ ] Documentation/comments updated if interfaces changed.

## Task 9: Add unit tests for grading, sampling, and caching

**Requirements:** 2.1, 2.2, 2.3, 3.1, 5, 10

### Work items
- [ ] Golden EV tests covering EV_mix/best/loss calculations
- [ ] Deterministic RNG and opponent sampling tests with fixed seeds
- [ ] Cache hit/miss tests using mock solver adapter

### Definition of Done
- [ ] Implementation complete and reviewed for correctness.
- [ ] Unit tests added/updated where applicable.
- [ ] Determinism preserved (seeded RNG or stable hashing) if this task touches sampling/hashing.
- [ ] Documentation/comments updated if interfaces changed.

