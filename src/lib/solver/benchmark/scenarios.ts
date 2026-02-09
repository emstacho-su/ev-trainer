// src/lib/solver/benchmark/scenarios.ts
// Benchmark scenario definitions for validating solver accuracy against PioSolver.

import type { PreflopTreeConfig, ActionAbstractionConfig, CanonicalHand } from '../types';
import { CANONICAL_HANDS } from '../abstraction/cards';

// ========================================
// Types
// ========================================

/**
 * Scenario type discriminator.
 * - preflop: Preflop-only scenarios (RFI, 3bet, etc.)
 * - postflop: Postflop continuation scenarios
 */
export type ScenarioType = 'preflop' | 'postflop';

/**
 * Postflop-specific configuration (placeholder for future implementation).
 * Will be extended when postflop solver is implemented.
 */
export interface PostflopConfig {
  /** Starting pot size in BB */
  readonly potBb: number;
  /** Effective stack size in BB */
  readonly stackBb: number;
  /** Board cards (e.g., ['Ah', 'Kc', '2d']) */
  readonly board: readonly string[];
  /** Hero's relative position */
  readonly heroPosition: 'IP' | 'OOP';
  /** Prior action context (e.g., 'SRP' for single-raised pot) */
  readonly priorContext: string;
  /** Action abstraction for postflop */
  readonly actionAbstraction: ActionAbstractionConfig;
}

/**
 * Benchmark scenario definition.
 * Each scenario represents a specific game situation to validate against reference data.
 */
export interface BenchmarkScenario {
  /** Unique identifier (e.g., "preflop-rfi-btn") */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Scenario type discriminator */
  readonly type: ScenarioType;
  /** Game configuration (varies by type) */
  readonly config: PreflopTreeConfig | PostflopConfig;
  /** Description of what this scenario tests */
  readonly description: string;
  /** Specific hands to check closely (for focused validation) */
  readonly criticalHands?: readonly CanonicalHand[];
}

// ========================================
// Default Action Abstraction
// ========================================

/**
 * Standard action abstraction for benchmark scenarios.
 * Matches common PioSolver configurations for accurate comparison.
 */
const STANDARD_ACTION_ABSTRACTION: ActionAbstractionConfig = {
  betSizes: {
    PREFLOP: [1.0],
    FLOP: [0.33, 0.5, 0.75, 1.0],
    TURN: [0.33, 0.5, 0.75, 1.0],
    RIVER: [0.33, 0.5, 0.75, 1.0],
  },
  raiseSizes: {
    PREFLOP: [2.2, 2.5, 3.0],
    FLOP: [2.2, 2.5, 3.0],
    TURN: [2.2, 2.5, 3.0],
    RIVER: [2.2, 2.5, 3.0],
  },
  includeAllIn: true,
  allInThreshold: 2.0,
};

// ========================================
// Preflop Benchmark Scenarios
// ========================================

/**
 * BTN RFI (Raise First In from Button)
 * Tests: Opening ranges, raise sizing selection
 */
const PREFLOP_RFI_BTN: BenchmarkScenario = {
  id: 'preflop-rfi-btn',
  name: 'BTN RFI',
  type: 'preflop',
  config: {
    startingStackBb: 100,
    smallBlindBb: 0.5,
    bigBlindBb: 1,
    positions: ['BTN', 'SB', 'BB'],
    actionAbstraction: STANDARD_ACTION_ABSTRACTION,
    heroPosition: 'BTN',
    villainPosition: 'BB',
    priorActions: [], // First to act (after folds)
  } as PreflopTreeConfig,
  description: 'Button raise first in. Tests open-raising ranges and sizing selection from late position.',
  criticalHands: ['AA', 'AKs', 'AKo', 'KQs', 'JTs', '76s', '22', 'A5s', 'K9o'],
};

/**
 * BB vs BTN Open
 * Tests: Defense frequencies, 3bet ranges, call ranges
 */
const PREFLOP_BB_VS_BTN: BenchmarkScenario = {
  id: 'preflop-bb-vs-btn',
  name: 'BB vs BTN Open',
  type: 'preflop',
  config: {
    startingStackBb: 100,
    smallBlindBb: 0.5,
    bigBlindBb: 1,
    positions: ['BTN', 'SB', 'BB'],
    actionAbstraction: STANDARD_ACTION_ABSTRACTION,
    heroPosition: 'BB',
    villainPosition: 'BTN',
    priorActions: ['RAISE_2.5'], // BTN opened 2.5x
  } as PreflopTreeConfig,
  description: 'BB facing BTN 2.5x open. Tests defense frequencies and 3bet construction.',
  criticalHands: ['AA', 'KK', 'QQ', 'AKs', 'AKo', 'JTs', 'A5s', '87s', 'K8o', '72o'],
};

/**
 * SB vs BB (Heads-up Blinds)
 * Tests: Steal frequencies, limp strategies
 */
const PREFLOP_SB_VS_BB: BenchmarkScenario = {
  id: 'preflop-sb-vs-bb',
  name: 'SB vs BB',
  type: 'preflop',
  config: {
    startingStackBb: 100,
    smallBlindBb: 0.5,
    bigBlindBb: 1,
    positions: ['SB', 'BB'],
    actionAbstraction: STANDARD_ACTION_ABSTRACTION,
    heroPosition: 'SB',
    villainPosition: 'BB',
    priorActions: [], // SB acts first
  } as PreflopTreeConfig,
  description: 'SB vs BB heads-up. Tests steal frequencies and complete/limp strategies.',
  criticalHands: ['AA', 'KK', 'A2s', 'K5o', '54s', '32o', 'J7s', 'Q9o'],
};

/**
 * BTN vs CO 3bet
 * Tests: 3bet defense ranges, 4bet frequencies
 */
const PREFLOP_BTN_VS_CO_3BET: BenchmarkScenario = {
  id: 'preflop-btn-vs-co-3bet',
  name: 'BTN vs CO 3bet',
  type: 'preflop',
  config: {
    startingStackBb: 100,
    smallBlindBb: 0.5,
    bigBlindBb: 1,
    positions: ['CO', 'BTN', 'SB', 'BB'],
    actionAbstraction: STANDARD_ACTION_ABSTRACTION,
    heroPosition: 'BTN',
    villainPosition: 'CO',
    priorActions: ['RAISE_2.5', 'RAISE_3'], // CO opened, BTN 3bet
  } as PreflopTreeConfig,
  description: 'BTN facing CO 3bet after opening. Tests 3bet defense and 4bet ranges.',
  criticalHands: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo', 'AQs', 'KQs', 'TT', '99'],
};

/**
 * BB Squeeze (vs Raise and Call)
 * Tests: Squeeze frequencies, value/bluff balance
 */
const PREFLOP_BB_SQUEEZE: BenchmarkScenario = {
  id: 'preflop-bb-squeeze',
  name: 'BB Squeeze',
  type: 'preflop',
  config: {
    startingStackBb: 100,
    smallBlindBb: 0.5,
    bigBlindBb: 1,
    positions: ['CO', 'BTN', 'SB', 'BB'],
    actionAbstraction: STANDARD_ACTION_ABSTRACTION,
    heroPosition: 'BB',
    villainPosition: 'CO', // Primary villain is opener
    priorActions: ['RAISE_2.5', 'CALL'], // CO opened, BTN called
  } as PreflopTreeConfig,
  description: 'BB squeeze spot vs CO open and BTN call. Tests squeeze frequencies and bluff selection.',
  criticalHands: ['AA', 'KK', 'AKs', 'AQo', 'A5s', 'KJs', 'T9s', '65s', 'Q8s'],
};

/**
 * All preflop benchmark scenarios.
 */
export const PREFLOP_BENCHMARK_SCENARIOS: readonly BenchmarkScenario[] = [
  PREFLOP_RFI_BTN,
  PREFLOP_BB_VS_BTN,
  PREFLOP_SB_VS_BB,
  PREFLOP_BTN_VS_CO_3BET,
  PREFLOP_BB_SQUEEZE,
];

// ========================================
// Postflop Benchmark Scenarios
// ========================================

/**
 * IP C-bet on AKx dry flop
 * Tests: Value betting frequencies, check-back frequencies
 */
const POSTFLOP_CBET_AKX_IP: BenchmarkScenario = {
  id: 'postflop-cbet-akx-ip',
  name: 'IP C-bet AKx',
  type: 'postflop',
  config: {
    potBb: 6.5, // 2.5x open + BB call + SB fold
    stackBb: 97.5,
    board: ['Ah', 'Kc', '2d'],
    heroPosition: 'IP',
    priorContext: 'SRP', // Single-raised pot
    actionAbstraction: STANDARD_ACTION_ABSTRACTION,
  } as PostflopConfig,
  description: 'IP c-bet decision on AK2 rainbow. Tests c-bet frequencies on favorable texture.',
  criticalHands: ['AA', 'KK', 'AK', 'AQ', 'KQ', 'JJ', 'TT', '99', '88', '77', '66'],
};

/**
 * Connected low board (876r)
 * Tests: Range advantage considerations, draw handling
 */
const POSTFLOP_CBET_876_IP: BenchmarkScenario = {
  id: 'postflop-cbet-876-ip',
  name: 'IP C-bet 876r',
  type: 'postflop',
  config: {
    potBb: 6.5,
    stackBb: 97.5,
    board: ['8h', '7c', '6d'],
    heroPosition: 'IP',
    priorContext: 'SRP',
    actionAbstraction: STANDARD_ACTION_ABSTRACTION,
  } as PostflopConfig,
  description: 'IP c-bet decision on 876 rainbow. Tests strategy on connected board.',
  criticalHands: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'T9s', '54s'],
};

/**
 * Paired board (KK2)
 * Tests: Trips value betting, bluff catcher frequencies
 */
const POSTFLOP_CBET_KK2_IP: BenchmarkScenario = {
  id: 'postflop-cbet-kk2-ip',
  name: 'IP C-bet KK2',
  type: 'postflop',
  config: {
    potBb: 6.5,
    stackBb: 97.5,
    board: ['Kh', 'Kc', '2d'],
    heroPosition: 'IP',
    priorContext: 'SRP',
    actionAbstraction: STANDARD_ACTION_ABSTRACTION,
  } as PostflopConfig,
  description: 'IP c-bet decision on KK2 paired board. Tests value/bluff balance with trips.',
  criticalHands: ['AA', 'KK', 'AK', 'KQ', 'KJ', 'QQ', 'JJ', 'TT', '22', 'AQ'],
};

/**
 * All postflop benchmark scenarios.
 */
export const POSTFLOP_BENCHMARK_SCENARIOS: readonly BenchmarkScenario[] = [
  POSTFLOP_CBET_AKX_IP,
  POSTFLOP_CBET_876_IP,
  POSTFLOP_CBET_KK2_IP,
];

// ========================================
// Combined Export
// ========================================

/**
 * All benchmark scenarios (preflop + postflop).
 */
export const BENCHMARK_SCENARIOS: readonly BenchmarkScenario[] = [
  ...PREFLOP_BENCHMARK_SCENARIOS,
  ...POSTFLOP_BENCHMARK_SCENARIOS,
];

// ========================================
// Factory Functions
// ========================================

/**
 * Creates a custom benchmark scenario with validation.
 *
 * @param type - Scenario type (preflop or postflop)
 * @param config - Scenario configuration
 * @param options - Additional scenario options
 * @returns Validated BenchmarkScenario
 * @throws Error if config doesn't match type
 */
export function createBenchmarkScenario(
  type: ScenarioType,
  config: PreflopTreeConfig | PostflopConfig,
  options: {
    id: string;
    name: string;
    description: string;
    criticalHands?: readonly CanonicalHand[];
  }
): BenchmarkScenario {
  // Validate config matches type
  if (type === 'preflop') {
    if (!isPreflopConfig(config)) {
      throw new Error('Preflop scenario requires PreflopTreeConfig with heroPosition and priorActions');
    }
  } else if (type === 'postflop') {
    if (!isPostflopConfig(config)) {
      throw new Error('Postflop scenario requires PostflopConfig with board and heroPosition');
    }
  }

  // Validate ID is unique
  const existingIds = BENCHMARK_SCENARIOS.map(s => s.id);
  if (existingIds.includes(options.id)) {
    throw new Error(`Scenario ID '${options.id}' already exists`);
  }

  // Validate critical hands are valid
  if (options.criticalHands) {
    for (const hand of options.criticalHands) {
      if (!CANONICAL_HANDS.includes(hand)) {
        throw new Error(`Invalid critical hand: ${hand}`);
      }
    }
  }

  return {
    id: options.id,
    name: options.name,
    type,
    config,
    description: options.description,
    criticalHands: options.criticalHands,
  };
}

/**
 * Type guard for PreflopTreeConfig.
 */
function isPreflopConfig(config: PreflopTreeConfig | PostflopConfig): config is PreflopTreeConfig {
  return 'heroPosition' in config && 'priorActions' in config && 'startingStackBb' in config;
}

/**
 * Type guard for PostflopConfig.
 */
function isPostflopConfig(config: PreflopTreeConfig | PostflopConfig): config is PostflopConfig {
  return 'board' in config && 'potBb' in config;
}

/**
 * Gets a scenario by ID.
 *
 * @param id - Scenario ID to find
 * @returns BenchmarkScenario or undefined
 */
export function getScenarioById(id: string): BenchmarkScenario | undefined {
  return BENCHMARK_SCENARIOS.find(s => s.id === id);
}

/**
 * Gets all scenarios of a specific type.
 *
 * @param type - Scenario type to filter by
 * @returns Array of matching scenarios
 */
export function getScenariosByType(type: ScenarioType): readonly BenchmarkScenario[] {
  return BENCHMARK_SCENARIOS.filter(s => s.type === type);
}
