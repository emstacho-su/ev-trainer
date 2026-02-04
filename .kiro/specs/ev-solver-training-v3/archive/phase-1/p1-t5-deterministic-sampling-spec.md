# P1.T5 - Deterministic Sampling Design

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## Goal
Produce reproducible opponent action sampling from mixed strategy frequencies.

## Seeded RNG Policy
- Derive one sampling seed per decision:
  - `samplingSeed = combine(seed, nodeHash, sequenceIndex)`
- Use a fixed deterministic PRNG implementation.
- For a fixed `samplingSeed`, the first draw must be stable across runs.

## Cumulative Frequency Traversal
Pseudocode:

```text
input:
  actions: [{ actionId, frequency, ev }, ...]
  seedContext: { seed, nodeHash, sequenceIndex }
  transforms?: [fn(action, context) -> multiplier]

algorithm:
  assert actions is non-empty
  for each action:
    weight = action.frequency
    for transform in transforms:
      weight = weight * transform(action, seedContext)
    assert weight is finite and >= 0
  assert sum(weights) > 0
  probabilities = normalize(weights)

  // canonical tie-break: independent of provider array order
  buckets = zip(actions, probabilities)
  sort buckets by actionId ascending (ASCII lexical)

  rng = createSeededRng(combine(seed, nodeHash, sequenceIndex))
  roll = rng.next()  // [0, 1)
  cumulative = 0
  for each bucket in buckets:
    cumulative += bucket.probability
    if roll < cumulative:
      return bucket.action
  return last bucket.action
```

## Invariants
- Determinism: same `(seed, nodeHash, sequenceIndex, actions, transforms)` yields same sampled action.
- Order independence: same weighted policy yields same sampled action even if action array order differs.
- Probability safety: all transformed weights must be finite and non-negative.
- Exclusion: zero-weight actions are never sampled unless all weights are zero (invalid input).

## Edge-case Rules
- Empty action list: throw.
- Invalid transformed weight (NaN, Infinity, negative): throw.
- Total transformed weight <= 0: throw.
- Boundary roll handling: use `roll < cumulative`, fallback to last action for numeric drift safety.
