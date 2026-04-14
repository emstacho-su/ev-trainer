// src/lib/engine/wasm/wasmTypes.ts
// TypeScript interfaces mirroring the postflop-solver WASM API.
// These types define the contract between our TypeScript code and the WASM module.
// Reference: https://github.com/b-inary/wasm-postflop

/**
 * WASM GameManager interface (from postflop-solver solver-st module).
 * Methods match the #[wasm_bindgen] exports in the Rust code.
 */
export interface WasmGameManager {
  /** Initialize a new game with ranges, board, and bet tree config. Returns error string or null. */
  init(
    oopRange: Float32Array,
    ipRange: Float32Array,
    board: Uint8Array,
    startingPot: number,
    effectiveStack: number,
    rakeRate: number,
    rakeCap: number,
    donkOption: boolean,
    oopFlopBet: string,
    oopFlopRaise: string,
    oopTurnBet: string,
    oopTurnRaise: string,
    oopTurnDonk: string,
    oopRiverBet: string,
    oopRiverRaise: string,
    oopRiverDonk: string,
    ipFlopBet: string,
    ipFlopRaise: string,
    ipTurnBet: string,
    ipTurnRaise: string,
    ipRiverBet: string,
    ipRiverRaise: string,
    addAllinThreshold: number,
    forceAllinThreshold: number,
    mergingThreshold: number,
    addedLines: string,
    removedLines: string,
  ): string | null;

  /** Allocate memory for solving. Must call after init(). */
  allocate_memory(enableCompression: boolean): void;

  /** Run a single CFR iteration. */
  solve_step(currentIteration: number): void;

  /** Get current exploitability in mbb/hand. */
  exploitability(): number;

  /** Normalize strategy after solving. Must call before reading results. */
  finalize(): void;

  /** Navigate game tree by applying action indices. */
  apply_history(history: Uint32Array): void;

  /** Get the current acting player: "oop" | "ip" | "terminal" | "chance". */
  current_player(): string;

  /** Number of available actions at current node. */
  num_actions(): number;

  /** Get actions available after appending indices. Returns comma-separated action string. */
  actions_after(append: Uint32Array): string;

  /** Bitmask of dealable cards at a chance node. */
  possible_cards(): bigint;

  /** Get packed results array (strategy, equity, EV) at current node. */
  get_results(): Float64Array;

  /** Get private card combos for a player (0=OOP, 1=IP). Returns packed u16 array. */
  private_cards(player: number): Uint16Array;

  /** Memory usage in bytes. */
  memory_usage(enableCompression: boolean): bigint;

  /** Get total bet amounts after appending actions. */
  total_bet_amount(append: Uint32Array): Uint32Array;
}

/**
 * WASM RangeManager interface (from postflop-solver range module).
 */
export interface WasmRangeManager {
  /** Clear all weights. */
  clear(): void;

  /** Update weight for a specific 13x13 grid cell. */
  update(row: number, col: number, weight: number): void;

  /** Parse PioSOLVER-format range string. Returns error string or null. */
  from_string(s: string): string | null;

  /** Export as PioSOLVER-format range string. */
  to_string(): string;

  /** Get 169-element weights array (13x13 grid). */
  get_weights(): Float32Array;

  /** Get 1326-element raw combo data (passed to GameManager.init). */
  raw_data(): Float32Array;
}

/**
 * Configuration for a postflop solve request.
 */
export interface PostflopSolveConfig {
  oopRange: string;
  ipRange: string;
  board: string[];
  startingPot: number;
  effectiveStack: number;
  maxIterations: number;
  targetExploitability: number;
  betSizes?: {
    oopFlopBet?: string;
    oopFlopRaise?: string;
    oopTurnBet?: string;
    oopTurnRaise?: string;
    oopRiverBet?: string;
    oopRiverRaise?: string;
    ipFlopBet?: string;
    ipFlopRaise?: string;
    ipTurnBet?: string;
    ipTurnRaise?: string;
    ipRiverBet?: string;
    ipRiverRaise?: string;
  };
}

/** Default bet sizes matching common GTO solver configurations. */
export const DEFAULT_BET_SIZES = {
  oopFlopBet: "33%,67%",
  oopFlopRaise: "60%",
  oopTurnBet: "33%,67%,100%",
  oopTurnRaise: "60%",
  oopRiverBet: "33%,67%,100%",
  oopRiverRaise: "60%",
  ipFlopBet: "33%,67%",
  ipFlopRaise: "60%",
  ipTurnBet: "33%,67%,100%",
  ipTurnRaise: "60%",
  ipRiverBet: "33%,67%,100%",
  ipRiverRaise: "60%",
} as const;

/**
 * Card encoding matching postflop-solver:
 * card_id = 4 * rank + suit
 * rank: 2=0, 3=1, ..., A=12
 * suit: c=0, d=1, h=2, s=3
 */
export function encodeCard(card: string): number {
  const rankChar = card[0].toUpperCase();
  const suitChar = card[1].toLowerCase();

  const rankMap: Record<string, number> = {
    "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6,
    "9": 7, "T": 8, "J": 9, "Q": 10, "K": 11, "A": 12,
  };
  const suitMap: Record<string, number> = { c: 0, d: 1, h: 2, s: 3 };

  const rank = rankMap[rankChar];
  const suit = suitMap[suitChar];

  if (rank === undefined || suit === undefined) {
    throw new Error(`Invalid card: ${card}`);
  }

  return 4 * rank + suit;
}

/** Encode a board (array of card strings) to Uint8Array for WASM. */
export function encodeBoard(board: string[]): Uint8Array {
  return new Uint8Array(board.map(encodeCard));
}
