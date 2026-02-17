/**
 * Overview: TrainerConfig type definitions for lobby and session configuration.
 * Interacts with: validation schemas, localStorage persistence, server sync.
 * Importance: Single source of truth for all trainer configuration shape and values.
 */

/**
 * Valid 6-max positions for trainer configuration.
 * Uses the same Position type as engine but exported separately for config context.
 */
export const ConfigPositions = ["UTG", "HJ", "CO", "BTN", "SB", "BB"] as const;
export type ConfigPosition = (typeof ConfigPositions)[number];

/**
 * Pot type classifications for filtering training spots.
 */
export const ConfigPotTypes = ["SRP", "3BP"] as const;
export type ConfigPotType = (typeof ConfigPotTypes)[number];

/**
 * Training mode determines the street and complexity of spots.
 */
export type TrainerMode = "PREFLOP" | "FLOP";

/**
 * Game type for the training session.
 */
export type GameType = "CASH" | "HU";

/**
 * Table size configuration.
 */
export type TableSize = "6max" | "9max";

/**
 * Effective stack depth for preflop scenarios.
 */
export type StackDepth = "50bb" | "100bb" | "200bb";

/**
 * Complete trainer configuration interface.
 *
 * Fields are categorized as:
 * - **Lobby-only**: Can only be changed from the lobby/setup screen before a session starts.
 *   Changing these mid-session would invalidate the spot pool.
 * - **Mid-session changeable**: Can be adjusted during an active training session
 *   via the sidebar without restarting.
 */
export interface TrainerConfig {
  /** Training mode - PREFLOP or FLOP. Lobby-only. */
  mode: TrainerMode;

  /** Game type - CASH or heads-up. Lobby-only. */
  gameType: GameType;

  /** Table size - 6max or 9max. Lobby-only. */
  tableSize: TableSize;

  /** Effective stack depth. Lobby-only. */
  stackDepth: StackDepth;

  /**
   * When true, forces villain to always raise for aggressive practice scenarios.
   * Lobby-only. Default: false.
   */
  villainAlwaysRaise: boolean;

  /**
   * Selected positions to practice. At least one required.
   * Mid-session changeable - filters the spot pool without restarting.
   */
  positions: ConfigPosition[];

  /**
   * Selected pot types to practice. At least one required.
   * Mid-session changeable - filters the spot pool without restarting.
   */
  potTypes: ConfigPotType[];

  /**
   * Optional target number of hands for the session.
   * Mid-session changeable. Range: 1-1000 if provided.
   */
  handCountTarget?: number;
}
