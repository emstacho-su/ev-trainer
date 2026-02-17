---
phase: 05-preflop-training
plan: 01
subsystem: training-filters
tags: [preflop, scenario-classification, filtering, spot-selection]

requires:
  - 04-table-ui-foundation

provides:
  - Preflop scenario classification (RFI, FacingOpen, 3Bet, BlindDefense)
  - Scenario type metadata on spot packs
  - Scenario type filtering capability

affects:
  - 05-02 (UI will use scenario filters)
  - 05-03 (Range visualization may use scenario types)
  - 06-trainer-configuration (Setup UI will expose scenario filters)

tech-stack:
  added: []
  patterns:
    - Deterministic classification at pack load time (not render time)
    - Priority-based scenario matching (BlindDefense > 3Bet > FacingOpen > RFI)

key-files:
  created:
    - src/lib/v2/packs/scenarioClassifier.ts
    - src/lib/v2/packs/scenarioClassifier.test.ts
  modified:
    - src/lib/v2/packs/spotPack.ts
    - src/lib/v2/filters/spotFilters.ts
    - src/lib/v2/packs/spotPack.test.ts
    - src/lib/v2/filters/spotFilters.test.ts

decisions:
  - id: scenario-priority
    choice: BlindDefense takes priority over other classifications
    rationale: When BB faces open, it's both FacingOpen and BlindDefense - BlindDefense is more specific
  - id: classification-timing
    choice: Classify at pack load time, not render time
    rationale: Deterministic, performance (once per pack vs every filter)
  - id: scenario-count
    choice: Four scenarios (RFI, FacingOpen, 3Bet, BlindDefense)
    rationale: Based on RESEARCH.md Pattern 1 - covers core preflop decision points

metrics:
  duration: 7 min
  completed: 2026-02-17
---

# Phase 5 Plan 1: Scenario Classification Summary

**One-liner:** Preflop scenario classification (RFI/FacingOpen/3Bet/BlindDefense) with pack-time enrichment and filtering support

## What Was Built

Added preflop scenario classification to enable targeted training modes. Spots are classified into four scenario types at pack load time, enabling users to drill specific preflop decision points (RFI, facing an open, 3bet pots, or blind defense).

**Key components:**

1. **Scenario Classifier Module** (`scenarioClassifier.ts`)
   - Four scenario types: RFI, FacingOpen, 3Bet, BlindDefense
   - Priority-based classification (BlindDefense most specific)
   - Returns null for non-preflop spots

2. **SpotMeta Extension** (`spotPack.ts`)
   - Added optional `scenarioType` field to SpotMeta
   - Enrichment at pack load via `enrichSpotWithScenario()`
   - Only preflop spots get scenario type metadata

3. **Filter Extension** (`spotFilters.ts`)
   - Added `scenarioType` filter to SpotFilterInput
   - Supports filtering by specific scenario or 'ANY'
   - Excludes non-preflop spots when scenario filter active

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create scenario classifier with four preflop types | ccf3d17 | scenarioClassifier.ts, scenarioClassifier.test.ts |
| 2 | Extend SpotMeta and SpotFilterInput with scenario type | ce1910a | spotPack.ts, spotFilters.ts, test files |

## Verification Results

**All tests pass:**
- ✅ 17 scenario classifier tests (all scenarios correctly classified)
- ✅ 8 spot filter tests (scenario filtering works correctly)
- ✅ 4 spot pack tests (enrichment at load time verified)
- ✅ Total: 29/29 tests passing

**Verification criteria met:**
- ✅ Scenario classification is deterministic (same spot → same type)
- ✅ Non-preflop spots do not get scenarioType metadata
- ✅ Filtering by scenarioType='RFI' returns only RFI spots
- ✅ Full test suite passes (574/576 - 2 pre-existing auth failures)

## Decisions Made

### 1. Scenario Priority Rules
**Decision:** BlindDefense takes priority when hero is in SB/BB facing action

**Context:** Some spots match multiple scenarios (e.g., BB facing open is both FacingOpen and BlindDefense)

**Rationale:** BlindDefense is more specific - it represents a unique strategic context (defending from forced positions with positional disadvantage)

**Alternatives considered:**
- Assign multiple tags (complexity, harder to filter)
- Use position + history combo (redundant with existing filters)

### 2. Classification Timing
**Decision:** Classify at pack load time, store in metadata

**Context:** Could classify on-demand during filtering or at pack load

**Rationale:**
- Deterministic (same pack always has same classifications)
- Performance (once per pack vs every filter call)
- Explicit metadata makes debugging easier

**Alternatives considered:**
- On-demand classification (performance cost, less explicit)
- Pre-classify in pack JSON (requires pack rebuild for changes)

### 3. Four-Scenario Model
**Decision:** RFI, FacingOpen, 3Bet, BlindDefense (no 4bet+)

**Context:** RESEARCH.md Pattern 1 identified these as core preflop scenarios

**Rationale:**
- Covers 90%+ of preflop training volume
- Keeps UI simple (4 clear categories)
- Can extend to 4bet+ later if needed

**Impact:** Future phases can add more scenarios without breaking existing code

## Deviations from Plan

None - plan executed exactly as written.

## Test Coverage

**New test files:**
- `scenarioClassifier.test.ts` - 17 tests covering:
  - All four scenario types with sample spots
  - Non-preflop spots return null
  - Edge cases (SB/BB priority, empty history)

**Extended test files:**
- `spotFilters.test.ts` - Added 4 tests for scenario filtering
- `spotPack.test.ts` - Added 2 tests for pack enrichment

**Coverage areas:**
- ✅ Classification logic for all scenario types
- ✅ Priority rules (BlindDefense > others)
- ✅ Non-preflop exclusion
- ✅ Pack load enrichment
- ✅ Filter matching with scenarioType
- ✅ Filter matching with scenarioType='ANY'

## Integration Points

**Upstream dependencies:**
- Uses `Spot` type from engine/spot.ts
- Uses `SpotEntry` and `SpotMeta` from packs/spotPack.ts

**Downstream consumers:**
- Phase 05-02: UI will use scenario filters for targeted training
- Phase 05-03: Range visualization may display scenario-specific ranges
- Phase 06: Setup UI will expose scenario type selector

**Data flow:**
1. Pack JSON loaded → `parseSpotPack()`
2. Each spot entry → `enrichSpotWithScenario()`
3. Preflop spots classified → `scenarioType` added to meta
4. Filter applied → `matchesSpotFilters()` checks scenario type
5. Filtered spots → training session

## Performance Characteristics

**Classification cost:**
- O(1) per spot (simple history length + position check)
- Runs once per pack load (not per filter)
- Negligible impact on pack load time

**Filtering cost:**
- Added one conditional check to filter matching
- No noticeable performance impact

**Memory:**
- ~12 bytes per preflop spot (optional string field)
- ~0 bytes per postflop spot (field undefined)

## Next Phase Readiness

**Phase 05-02 (UI Feedback Enhancement):**
- ✅ Scenario filters ready for UI integration
- ✅ SpotFilterInput supports scenarioType parameter
- Ready to add scenario selector to training setup

**Phase 05-03 (Range Visualization):**
- ✅ Scenario metadata available on all preflop spots
- ✅ Can display scenario-specific ranges if needed

**Phase 06 (Trainer Configuration):**
- ✅ Filter schema supports scenario selection
- Ready to expose in configuration UI

**No blockers identified.**

## Lessons Learned

### What Went Well
- Priority-based classification handles overlapping scenarios cleanly
- Pack-time enrichment keeps filtering fast
- Comprehensive test coverage caught edge cases early

### What Could Be Improved
- None - straightforward implementation

### Reusable Patterns
- **Load-time enrichment pattern:** Classify/enrich data at load time for deterministic filtering
- **Priority-based matching:** When multiple categories apply, use explicit priority rules
- **Optional metadata fields:** Extend existing types with optional fields for backward compatibility

## Knowledge Capture

**Key invariants:**
- Scenario type only exists on preflop spots (board.length === 0)
- BlindDefense always wins when SB/BB faces action
- Classification is deterministic (pure function of spot data)

**Testing patterns:**
- Helper functions for creating test spots (`createPreflopSpot()`)
- Test all scenario types individually
- Test priority rules explicitly
- Test non-qualifying cases (postflop, 4bet+)

**Future considerations:**
- May want to add 4bet/5bet scenarios for advanced training
- Could extend to postflop "scenario types" (cbet, check-raise, etc.)
- Performance: Classification is cheap, could run on-demand if needed
