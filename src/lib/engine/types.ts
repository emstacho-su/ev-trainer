// src/lib/engine/types.ts

export const Streets = ["PREFLOP", "FLOP", "TURN", "RIVER"] as const;
export type Street = (typeof Streets)[number];

export const Positions = ["SB", "BB", "UTG", "HJ", "CO", "BTN"] as const;
export type Position = (typeof Positions)[number];

export const ActionTypes = ["FOLD", "CHECK", "CALL", "BET", "RAISE", "ALL_IN"] as const;
export type ActionType = (typeof ActionTypes)[number];

/**
 * ActionId is a stable string identifier for an action at a node.
 * For now it's a string; later we can formalize a canonical scheme (e.g. "BET_2.5", "RAISE_10").
 */
export type ActionId = string;
