# P1.T3 Canonical Node Hash Spec

Date: 2026-02-03
Task: P1.T3
Status: Complete draft

## 1) Canonical payload schema (frozen)
The node hash is computed from this canonical payload only:

```ts
interface CanonicalHashPayload {
  abstractionVersion: string;
  gameVersion: string;
  solverVersion: string;
  abstraction: {
    betSizesBb: number[];          // sorted asc after normalization
    maxRaisesPerStreet: number;    // integer >= 0
    raiseSizesBb: number[];        // sorted asc after normalization
  };
  history: {
    actions: string[];             // order-preserving
  };
  publicState: {
    board: string[];               // normalized to [Rank][suit], sorted lexicographically
    effectiveStackBb: number;
    potBb: number;
    street: string;
    toAct: string;
  };
}
```

## 2) Canonical key order (exact)
`stableStringify` sorts object keys lexicographically at every level.
Top-level canonical key order is therefore:
1. `abstraction`
2. `abstractionVersion`
3. `gameVersion`
4. `history`
5. `publicState`
6. `solverVersion`

## 3) Normalization table (frozen)
| Field | Rule |
|---|---|
| numbers | finite only; `-0 => 0`; `abs(x) < 1e-12 => 0` |
| `betSizesBb[]`, `raiseSizesBb[]` | normalize each number, then sort ascending |
| `maxRaisesPerStreet` | integer and `>= 0` required |
| board cards | normalize `10x` to `Tx`; rank uppercase, suit lowercase; validate rank/suit |
| `board[]` | normalize each card, then sort lexicographically |
| `history.actions[]` | non-empty strings; preserve original order |
| strings | no trim/mutation except card normalization |

## 4) Hash algorithm and output (frozen)
- Algorithm: `SHA-256`
- Input: canonical JSON emitted by `stableStringify`
- Output: lowercase hex digest (`64` chars)

## 5) Versioned cache key format (frozen)
`<solverVersion>|<abstractionVersion>|<nodeHash>`

## 6) Change-impact rules
MUST change hash when changed:
- `solverVersion`
- `abstractionVersion`
- `gameVersion`
- any semantic `publicState` value (`street`, `toAct`, `potBb`, `effectiveStackBb`, board membership)
- `history.actions` sequence/order
- abstraction values (`betSizesBb`, `raiseSizesBb`, `maxRaisesPerStreet`)

MUST NOT change hash when only changed:
- object key order
- board card order/case (same set)
- abstraction size array order (same numeric set)
- numeric negative zero representation (`-0` vs `0`)

## 7) Example vectors (11 total)
Base input assumptions:
- `gameVersion=HU-NLHE`
- `abstractionVersion=v1`
- `solverVersion=openspiel:1.0.0`
- `street=FLOP`, `potBb=4.5`, `effectiveStackBb=100`, `board=[Ah,7d,2c]`, `toAct=BTN`
- `history.actions=[BET_2.5,CALL]`
- `betSizesBb=[2.5,5]`, `raiseSizesBb=[7.5,20]`, `maxRaisesPerStreet=2`

| Vector | Variation | Expected | Hash |
|---|---|---|---|
| V1 | baseline | unique | `35918441bf1ae05fbcbdc94acce5326a712b0dab614a5cdc933e8633f3873aff` |
| V2 | reorder keys + board case/order + abstraction array order | same as V1 | `35918441bf1ae05fbcbdc94acce5326a712b0dab614a5cdc933e8633f3873aff` |
| V3 | board order only changed | same as V1 | `35918441bf1ae05fbcbdc94acce5326a712b0dab614a5cdc933e8633f3873aff` |
| V4 | history order changed to `[CALL,BET_2.5]` | different | `e412eec1f13a698be5ec6f92f1ffa8f1002ce473ee69dd5eb4fcc6cc13206db6` |
| V5 | `potBb=5.0` | different | `8720b975b7735d03fb483c0b7333a7263cbac110736667c5f55ade14b638d687` |
| V6 | `solverVersion=openspiel:1.0.1` | different | `8e2cccb8ed2a7e9f9079c86f976d8c2e041237f282dd7d6088f329ca4084e919` |
| V7 | `abstractionVersion=v2` | different | `03cc31e1df373e68bce856b8faa1a8beaadb51effd441c4d0563b9cef22e0fde` |
| V8 | `street=TURN` | different | `a208d0a6836ae5216bfa686a0aee699e34c8fc09c82f0434aeaffc762d49749c` |
| V9 | `toAct=BB` | different | `677ac823bb5806167b5440ba9bbc79b18a405d7c9dad19d6af86b974bed89c56` |
| V10 | add abstraction bet size (`betSizesBb=[2.5,5,8]`) | different | `0faa590cc06febfd2d2c78c1a2b34f19ac092ac4ec923f7f61b0f0dbb65855aa` |
| V11 | board set changed (`3c` replaces `2c`) | different | `a0c096c330211987cf1e59ce96c4ab27d07597594092b8a74cdb1a9d77598c6c` |

## 8) Completion checklist
- [x] canonical input schema frozen
- [x] field-order and normalization table documented
- [x] hash algorithm/output format frozen
- [x] versioned cache key format frozen
- [x] >=10 vectors documented with equivalence/non-equivalence coverage
- [x] change-impact rules documented
