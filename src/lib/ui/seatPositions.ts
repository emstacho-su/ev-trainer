import type { PokerTableSize } from "./pokerTableLayout";

export type SeatPosition =
  | "BTN"
  | "SB"
  | "BB"
  | "UTG"
  | "UTG+1"
  | "MP"
  | "LJ"
  | "HJ"
  | "CO";

const POSITION_ORDER: Record<PokerTableSize, SeatPosition[]> = {
  "heads-up": ["BTN", "BB"],
  "6-max": ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  "9-max": ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "LJ", "HJ", "CO"],
};

export function getPositionOrder(tableSize: PokerTableSize): readonly SeatPosition[] {
  return POSITION_ORDER[tableSize];
}

export function getPositionAt(tableSize: PokerTableSize, index: number): SeatPosition {
  const order = POSITION_ORDER[tableSize];
  if (!Number.isInteger(index) || index < 0 || index >= order.length) {
    throw new Error(`position index out of bounds for ${tableSize}`);
  }
  return order[index];
}

