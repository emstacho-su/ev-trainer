// src/lib/engine/rangeExtractor.ts
// Converts SolverNodeOutput (aggregate action frequencies) into per-hand
// RangeData for the range visualization grid.
//
// Strategy: distribute solver-level action frequencies across all 169
// canonical hands, modulated by hand strength category. Premium hands
// get more raise/call weight; weak hands get more fold weight.

import type { SolverNodeOutput, SolverActionOutput } from './solverAdapter';
import type {
  RangeData,
  HandAction,
  ActionFrequency,
  RangeActionType,
} from '../range/types';
import { getHandAtPosition } from '../range/gridLayout';
import { categorizeHandStrength, normalizeActionFrequencies } from '../range/rangeHelpers';
import type { EquityCategory } from '../range/types';

/** Map solver actionId (uppercase) to range action type (lowercase). */
function toRangeAction(actionId: string): RangeActionType {
  const upper = actionId.toUpperCase();
  if (upper === 'FOLD') return 'fold';
  if (upper === 'CALL') return 'call';
  if (upper === 'CHECK') return 'call'; // check is passive like call in range viz
  if (upper === 'ALL_IN') return 'jam';
  // BET_*, RAISE_* → raise
  if (upper.startsWith('BET') || upper.startsWith('RAISE')) return 'raise';
  return 'fold';
}

/**
 * Hand strength multipliers by equity category.
 * These shift the aggregate frequencies: premium hands get more raise,
 * weak hands get more fold. Values are relative multipliers per action type.
 */
const STRENGTH_MODIFIERS: Record<EquityCategory, Record<RangeActionType, number>> = {
  'premium-pairs':    { fold: 0.05, call: 0.3,  raise: 1.8, jam: 1.5 },
  'medium-pairs':     { fold: 0.2,  call: 0.9,  raise: 1.3, jam: 1.0 },
  'small-pairs':      { fold: 0.5,  call: 1.2,  raise: 0.8, jam: 0.6 },
  'broadway':         { fold: 0.3,  call: 0.8,  raise: 1.4, jam: 1.0 },
  'suited-connectors':{ fold: 0.4,  call: 1.0,  raise: 1.1, jam: 0.8 },
  'suited-gappers':   { fold: 0.6,  call: 1.1,  raise: 0.9, jam: 0.5 },
  'offsuit':          { fold: 1.4,  call: 1.0,  raise: 0.5, jam: 0.3 },
};

/**
 * Simple djb2 hash for deterministic per-hand variation.
 */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Merge solver actions into range action types.
 * Multiple solver actions may map to the same range type (e.g. BET_33 + BET_75 → raise).
 */
function mergeToRangeActions(actions: SolverActionOutput[]): ActionFrequency[] {
  const merged = new Map<RangeActionType, number>();

  for (const action of actions) {
    const type = toRangeAction(action.actionId);
    merged.set(type, (merged.get(type) ?? 0) + action.frequency);
  }

  return Array.from(merged.entries()).map(([type, frequency]) => ({
    type,
    frequency,
  }));
}

/**
 * Extract RangeData from a SolverNodeOutput.
 *
 * Takes the aggregate action frequencies from the solver and distributes
 * them across all 169 canonical hands, modulated by hand strength.
 * A seed string adds deterministic per-hand variation so the grid
 * doesn't look uniform.
 *
 * @param output - Solver output with aggregate action frequencies
 * @param seed - Deterministic seed for per-hand variation (e.g. "hero" or "villain")
 */
export function extractRangeData(
  output: SolverNodeOutput,
  seed: string = 'default',
): RangeData {
  if (output.status !== 'ok' || output.actions.length === 0) {
    return { hands: [], totalCombos: 0 };
  }

  // Merge solver actions to range action types
  const baseActions = mergeToRangeActions(output.actions);

  const hands: HandAction[] = [];

  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = getHandAtPosition(row, col);
      if (!hand) continue;

      const category = categorizeHandStrength(hand);
      const modifiers = STRENGTH_MODIFIERS[category];

      // Per-hand deterministic noise from seed
      const handHash = djb2(`${seed}:${hand}`);
      const noise = ((handHash % 1000) / 1000) * 0.3 - 0.15; // [-0.15, +0.15]

      // Apply modifiers and noise to base frequencies
      const adjusted: ActionFrequency[] = baseActions.map((a) => ({
        type: a.type,
        frequency: Math.max(0, a.frequency * modifiers[a.type] + noise * a.frequency),
      }));

      const normalized = normalizeActionFrequencies(adjusted);
      if (normalized.length > 0) {
        hands.push({ hand, actions: normalized });
      }
    }
  }

  return { hands, totalCombos: hands.length };
}

/**
 * Extract action frequency summary from solver output.
 * Returns a human-readable breakdown like "Fold 42.1%, Call 35.2%, Raise 22.7%".
 */
export function extractActionSummary(
  output: SolverNodeOutput,
): { label: string; frequency: number }[] {
  if (output.status !== 'ok' || output.actions.length === 0) return [];

  return output.actions.map((a) => ({
    label: formatActionLabel(a.actionId),
    frequency: a.frequency,
  }));
}

/** Human-readable label for a solver actionId. */
function formatActionLabel(actionId: string): string {
  const upper = actionId.toUpperCase();
  if (upper === 'CHECK') return 'Check';
  if (upper === 'FOLD') return 'Fold';
  if (upper === 'CALL') return 'Call';
  if (upper === 'ALL_IN') return 'All-in';

  const betMatch = upper.match(/^BET_(\d+)$/);
  if (betMatch) return `Bet ${betMatch[1]}%`;

  const raiseMatch = upper.match(/^RAISE_([\d.]+)$/);
  if (raiseMatch) return `Raise ${raiseMatch[1]}x`;

  return actionId;
}
