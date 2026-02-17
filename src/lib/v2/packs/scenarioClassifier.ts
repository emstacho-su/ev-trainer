import type { Spot } from "../../engine/spot";

/**
 * Preflop scenario classification for targeted training.
 *
 * RFI (Raise First In): Hero is first to act preflop (history.length === 0)
 * Example: UTG open, MP open, BTN open
 *
 * FacingOpen: Hero faces a single open raise (history.length === 1)
 * Example: UTG opens, hero on BTN decides
 *
 * 3Bet: Hero faces open + 3bet before acting (history.length === 2)
 * Example: UTG opens, MP 3bets, hero on BTN decides
 *
 * BlindDefense: Hero in SB or BB facing action (most specific, takes priority)
 * Example: BTN opens, SB defends; CO opens, BB decides
 */
export type PreflopScenarioType = 'RFI' | 'FacingOpen' | '3Bet' | 'BlindDefense';

/**
 * Classifies a spot into one of four preflop scenario types.
 *
 * Returns null if the spot is not a preflop spot (street !== 'PREFLOP').
 *
 * Classification priority (most specific first):
 * 1. BlindDefense: SB or BB facing any action (history.length >= 1)
 * 2. 3Bet: Facing open + 3bet (history.length === 2)
 * 3. FacingOpen: Facing single open (history.length === 1)
 * 4. RFI: First to act (history.length === 0)
 *
 * @param spot - The spot to classify
 * @returns The scenario type, or null if not a preflop spot
 */
export function classifyPreflopScenario(spot: Spot): PreflopScenarioType | null {
  // Only classify preflop spots
  if (spot.board.length > 0) {
    return null;
  }

  const { history, heroToAct } = spot;

  // Priority 1: BlindDefense (most specific)
  // Blinds facing any action
  if ((heroToAct === 'SB' || heroToAct === 'BB') && history.length >= 1) {
    return 'BlindDefense';
  }

  // Priority 2: 3Bet scenario (open + 3bet before hero)
  if (history.length === 2) {
    return '3Bet';
  }

  // Priority 3: FacingOpen (single open raise before hero)
  if (history.length === 1) {
    return 'FacingOpen';
  }

  // Priority 4: RFI (first to act)
  if (history.length === 0) {
    return 'RFI';
  }

  // Edge case: history.length > 2 (4bet+ situations)
  // For now, return null as these are not part of the four main scenarios
  return null;
}
