# P2.T4 Position Layout and Seat-State Spec

Date: 2026-02-04
Task: P2.T4
Spec: `ev-solver-training-v3`

## 1. Canonical Position Sets

### 1.1 heads-up
- Ordered positions: `BTN`, `BB`

### 1.2 6-max
- Ordered positions: `BTN`, `SB`, `BB`, `UTG`, `HJ`, `CO`

### 1.3 9-max
- Ordered positions: `BTN`, `SB`, `BB`, `UTG`, `UTG+1`, `MP`, `LJ`, `HJ`, `CO`

Position order is canonical and deterministic by table size.

## 2. Seat-State Contract

Seat state is modeled as a discriminated union:
- `{ kind: "empty"; role: "neutral" }`
- `{ kind: "active"; role: "hero" | "villain" | "neutral" }`
- `{ kind: "acted"; role: "hero" | "villain" | "neutral" }`
- `{ kind: "folded"; role: "hero" | "villain" | "neutral" }`

Rules:
- `empty` state MUST use `neutral` role.
- role marker (`hero` / `villain` / `neutral`) is orthogonal to non-empty occupancy states.

## 3. Allowed State Transitions

Canonical transition map:
- `empty -> active`
- `active -> acted | folded`
- `acted -> active | folded`
- `folded -> active`

Any other transition is invalid and MUST fail with a stable error message.

## 4. Deterministic Render Mapping

Input:
- `tableSize`
- `seats[]` (`id`, `label`)
- optional `seatStates` map by seat id

Output:
- ordered seat render model with:
  - `seatIndex`
  - canonical `position`
  - resolved `state`

Determinism constraints:
- same input model -> identical ordered output
- stable React key contract uses `seat.id`

## 5. PokerTable Integration Contract

`PokerTable` consumes:
- table geometry model from P2.T3
- seat render model from P2.T4 mapper

Render behavior:
- seat labels include canonical position tag
- visual style derives from state and role markers
- no inline ad-hoc seat ordering in component render path

## 6. Guardrails

- No runtime/engine API contract changes.
- No proprietary copied labels/assets.
- Non-interactive seat rendering remains semantic (no fake widget roles).

