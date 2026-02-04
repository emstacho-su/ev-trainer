# P2.T3 Poker Table Layout Spec

Date: 2026-02-04
Task: P2.T3
Spec: `ev-solver-training-v3`

## 1. Coordinate System
- All table geometry uses normalized coordinates in `[0, 1]`.
- Seat anchors use normalized points: `{ x, y }`.
- Zone placements use normalized rectangles: `{ x, y, width, height }`.
- All required zones MUST remain inside bounds and collision-safe with seat boxes.

## 2. Deterministic Seat Ordering
Seat order is index-based and deterministic by table size:

- `heads-up` (2 seats): `[0, 1]`
- `6-max` (6 seats): `[0, 1, 2, 3, 4, 5]`
- `9-max` (9 seats): `[0, 1, 2, 3, 4, 5, 6, 7, 8]`

Given identical props, seat anchor assignment is identical.

## 3. Canonical Seat Anchors
### 3.1 heads-up
- Seat 0: `(0.50, 0.84)`
- Seat 1: `(0.50, 0.14)`

### 3.2 6-max
- Seat 0: `(0.50, 0.86)`
- Seat 1: `(0.18, 0.70)`
- Seat 2: `(0.18, 0.30)`
- Seat 3: `(0.50, 0.12)`
- Seat 4: `(0.82, 0.30)`
- Seat 5: `(0.82, 0.70)`

### 3.3 9-max
- Seat 0: `(0.50, 0.88)`
- Seat 1: `(0.26, 0.79)`
- Seat 2: `(0.10, 0.61)`
- Seat 3: `(0.10, 0.39)`
- Seat 4: `(0.26, 0.21)`
- Seat 5: `(0.50, 0.10)`
- Seat 6: `(0.74, 0.21)`
- Seat 7: `(0.90, 0.39)`
- Seat 8: `(0.90, 0.61)`

## 4. Zone Rules and Constraints
Canonical required zones:
- `pot`: `{ x: 0.43, y: 0.42, width: 0.14, height: 0.08 }`
- `community`: `{ x: 0.31, y: 0.50, width: 0.38, height: 0.12 }`
- `hero-cards`: `{ x: 0.44, y: 0.69, width: 0.12, height: 0.08 }`
- `villain-cards`: `{ x: 0.44, y: 0.20, width: 0.12, height: 0.08 }`

Collision rule:
- Required center zones (`pot`, `community`) MUST NOT overlap any seat box.
- Seat box envelope for collision checks: width `0.14`, height `0.10`, centered on seat anchor.

## 5. Responsive Frame Rules
- Desktop/wide container (`>= 640px`): aspect ratio `16 / 10`.
- Narrow/mobile container (`< 640px`): aspect ratio `4 / 3`.
- Frame height is deterministic from width and ratio.
- Layout MUST stay readable without horizontal scroll traps.

## 6. Component Contract
`PokerTableProps` includes:
- `tableSize`: `heads-up | 6-max | 9-max`
- `seats`: typed seat list (`id`, `label`)
- `zones`: typed zone list (`id`, `label`)
- `overlays?`: optional overlay layer for later seat-state/highlight work (P2.T4)
- `className?`: optional container override

## 7. Validation and Error Behavior
The layout model MUST fail fast with stable messages for:
- unsupported table size
- seat count exceeding table capacity
- empty seat/zone ids or labels
- out-of-bounds/invalid zone rect data
- required zone overlap with any seat box

## 8. Non-Copy Constraint
- Visual language is original.
- No copied proprietary table skins, labels, or third-party branded assets.

