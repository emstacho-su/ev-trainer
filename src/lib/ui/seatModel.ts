import type { PokerTableSeatInput, PokerTableSize } from "./pokerTableLayout";
import { getPositionAt, getPositionOrder, type SeatPosition } from "./seatPositions";
import { parseSeatState, type SeatState } from "./seatState";

export interface SeatRenderModel {
  id: string;
  label: string;
  seatIndex: number;
  position: SeatPosition;
  state: SeatState;
}

export interface BuildSeatRenderModelInput {
  tableSize: PokerTableSize;
  seats: PokerTableSeatInput[];
  seatStates?: Record<string, SeatState>;
}

const DEFAULT_STATE: SeatState = { kind: "empty", role: "neutral" };

export function buildSeatRenderModel(input: BuildSeatRenderModelInput): SeatRenderModel[] {
  const expectedSeatCount = getPositionOrder(input.tableSize).length;
  if (input.seats.length !== expectedSeatCount) {
    throw new Error(
      `seat count mismatch for ${input.tableSize}: expected ${expectedSeatCount}, got ${input.seats.length}`
    );
  }

  return input.seats.map((seat, seatIndex) => ({
    id: seat.id,
    label: seat.label,
    seatIndex,
    position: getPositionAt(input.tableSize, seatIndex),
    state: input.seatStates?.[seat.id]
      ? parseSeatState(input.seatStates[seat.id])
      : DEFAULT_STATE,
  }));
}

