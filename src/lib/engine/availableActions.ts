// src/lib/engine/availableActions.ts
// Produces the training-UI action menu for a spot, filtered by rule-engine legality.
//
// The UI uses pot-percent and multiplier action IDs (BET_33PCT, RAISE_3.0X) to
// match the solver output vocabulary. This module takes those static size buckets
// and drops any that exceed stack depth or fall below the minimum legal size,
// so short-stack spots never show a sizing the player can't actually make.

import type { ActionId } from "./types";
import type { Spot } from "./spot";
import { createInitialGameState, computeLegalActions, type GameState } from "./gameState";

export interface AvailableAction {
  readonly actionId: ActionId;
  readonly label: string;
}

/** Bet-size buckets, expressed as fraction of pot. */
const BET_BUCKETS: readonly { id: ActionId; label: string; frac: number }[] = [
  { id: "BET_33PCT", label: "Bet 33%", frac: 0.33 },
  { id: "BET_50PCT", label: "Bet 50%", frac: 0.5 },
  { id: "BET_75PCT", label: "Bet 75%", frac: 0.75 },
  { id: "BET_100PCT", label: "Bet 100%", frac: 1.0 },
];

/** Raise-size buckets, expressed as multiplier of the current high bet. */
const RAISE_BUCKETS: readonly { id: ActionId; label: string; mult: number }[] = [
  { id: "RAISE_2.2X", label: "Raise 2.2x", mult: 2.2 },
  { id: "RAISE_2.5X", label: "Raise 2.5x", mult: 2.5 },
  { id: "RAISE_3.0X", label: "Raise 3x", mult: 3.0 },
];

function totalPotBb(gs: GameState): number {
  let betsTotal = 0;
  for (const pos of gs.positions) betsTotal += gs.bets[pos] ?? 0;
  return gs.pot + betsTotal;
}

function highBetBb(gs: GameState): number {
  let high = 0;
  for (const pos of gs.positions) {
    const b = gs.bets[pos] ?? 0;
    if (b > high) high = b;
  }
  return high;
}

/**
 * Get the trainer-UI action menu for a spot. Falls back to a safe default
 * on any error so the UI always has something to render.
 */
export function getAvailableActions(spot: Spot): AvailableAction[] {
  try {
    const gs = createInitialGameState(spot);
    const legal = computeLegalActions(gs);

    const actions: AvailableAction[] = [];

    if (legal.canFold) actions.push({ actionId: "FOLD", label: "Fold" });
    if (legal.canCheck) actions.push({ actionId: "CHECK", label: "Check" });
    if (legal.canCall) actions.push({ actionId: "CALL", label: "Call" });

    if (legal.canRaise) {
      const currentHigh = highBetBb(gs);
      for (const { id, label, mult } of RAISE_BUCKETS) {
        const total = currentHigh * mult;
        if (total >= legal.minRaise - 1e-9 && total <= legal.maxRaise + 1e-9) {
          actions.push({ actionId: id, label });
        }
      }
      // Ensure at least one raise option exists (min-raise fallback) + all-in
      if (!actions.some((a) => a.actionId.startsWith("RAISE_"))) {
        actions.push({ actionId: "RAISE_MIN", label: `Raise to ${round1(legal.minRaise)}bb` });
      }
      actions.push({ actionId: "ALL_IN", label: "All-in" });
    }

    if (legal.canBet) {
      const pot = totalPotBb(gs);
      for (const { id, label, frac } of BET_BUCKETS) {
        const sizeBb = pot * frac;
        if (sizeBb >= legal.minBet - 1e-9 && sizeBb <= legal.maxBet + 1e-9) {
          actions.push({ actionId: id, label });
        }
      }
      if (!actions.some((a) => a.actionId.startsWith("BET_"))) {
        actions.push({ actionId: "BET_MIN", label: `Bet ${round1(legal.minBet)}bb` });
      }
      actions.push({ actionId: "ALL_IN", label: "All-in" });
    }

    if (actions.length === 0) {
      return [
        { actionId: "FOLD", label: "Fold" },
        { actionId: "CALL", label: "Call" },
      ];
    }

    return actions;
  } catch {
    return [
      { actionId: "FOLD", label: "Fold" },
      { actionId: "CALL", label: "Call" },
      { actionId: "RAISE_3.0X", label: "Raise 3x" },
    ];
  }
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}
