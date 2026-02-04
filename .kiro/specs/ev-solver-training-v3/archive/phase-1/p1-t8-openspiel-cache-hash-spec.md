# P1.T8 - OpenSpiel Cache + Hash Spec

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## Goal
Implement versioned cache behavior for OpenSpiel responses keyed by canonical node hash.

## Cache Key
- Key dimensions:
  - `solverVersion`
  - `abstractionVersion`
  - `nodeHash` (canonical hash of normalized OpenSpiel request payload)
- Effective key format remains runtime cache id:
  - `<gameVersion>|<abstractionVersion>|<solverVersion>|<nodeHash>`

## Hashing Rule
- Build OpenSpiel request payload from canonical node.
- Normalize payload shape before hashing:
  - stable object key ordering
  - sorted board cards
  - deterministic action-history mapping
- Compute `sha256(stableStringify(normalizedPayload))`.

## Layered Cache Behavior
- Primary: in-memory LRU cache.
- Secondary: persistent file cache.
- Read path:
  1. memory lookup
  2. persistent lookup
  3. solve on miss
- On persistent hit, backfill memory.
- Write path: write-through to both layers.

## Version Invalidation Rule
- Any change in `solverVersion` or `abstractionVersion` yields a different key.
- Different version key must miss and recompute.

## Observable Metadata
- Cache hit returns solver output with:
  - `meta.source = cache`
  - `meta.nodeHash`
  - provider metadata when available
