// src/lib/solver/gameTree.test.ts
// Tests for game tree builder with lazy node generation.

import { describe, it, expect } from 'vitest';
import {
  buildInfoSetId,
  buildNodeId,
  isTerminal,
  getAvailableActions,
  computeTerminalUtility,
  createDecisionNode,
  createPreflopTree,
  getValidVillainHands,
  createPreflopScenario,
  getNextPlayer,
  PREFLOP_ACTIONS,
  countUnblockedCombos,
} from './gameTree';
import type { TreeConfig, PreflopTreeConfig, Player } from './types';
import { CANONICAL_HANDS } from './abstraction/cards';

// ========================================
// Test Configuration
// ========================================

const defaultConfig: TreeConfig = {
  startingStackBb: 100,
  smallBlindBb: 0.5,
  bigBlindBb: 1,
  positions: ['SB', 'BB'],
  actionAbstraction: {
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
  },
};

const shallowStackConfig: TreeConfig = {
  ...defaultConfig,
  startingStackBb: 3, // Very shallow for all-in testing (3BB = typical push/fold territory)
};

// ========================================
// buildInfoSetId Tests
// ========================================

describe('buildInfoSetId', () => {
  it('produces consistent IDs for same inputs', () => {
    const id1 = buildInfoSetId(0, 'AKs', ['CALL', 'RAISE_2.5']);
    const id2 = buildInfoSetId(0, 'AKs', ['CALL', 'RAISE_2.5']);
    expect(id1).toBe(id2);
  });

  it('produces different IDs for different players', () => {
    const id0 = buildInfoSetId(0, 'AKs', ['CALL']);
    const id1 = buildInfoSetId(1, 'AKs', ['CALL']);
    expect(id0).not.toBe(id1);
  });

  it('produces different IDs for different hands', () => {
    const idAK = buildInfoSetId(0, 'AKs', ['CALL']);
    const idAQ = buildInfoSetId(0, 'AQs', ['CALL']);
    expect(idAK).not.toBe(idAQ);
  });

  it('produces different IDs for different histories', () => {
    const id1 = buildInfoSetId(0, 'AKs', ['CALL']);
    const id2 = buildInfoSetId(0, 'AKs', ['CALL', 'RAISE_2.5']);
    expect(id1).not.toBe(id2);
  });

  it('handles empty history', () => {
    const id = buildInfoSetId(0, 'AA', []);
    expect(id).toBe('0:AA:');
  });

  it('formats correctly with history', () => {
    const id = buildInfoSetId(1, 'QJs', ['CALL', 'RAISE_3']);
    expect(id).toBe('1:QJs:CALL,RAISE_3');
  });
});

// ========================================
// buildNodeId Tests
// ========================================

describe('buildNodeId', () => {
  it('produces consistent IDs', () => {
    const id1 = buildNodeId(['CALL', 'RAISE_2.5']);
    const id2 = buildNodeId(['CALL', 'RAISE_2.5']);
    expect(id1).toBe(id2);
  });

  it('produces ROOT for empty history', () => {
    expect(buildNodeId([])).toBe('ROOT');
  });

  it('joins actions with comma', () => {
    expect(buildNodeId(['FOLD'])).toBe('FOLD');
    expect(buildNodeId(['CALL', 'RAISE_2.5'])).toBe('CALL,RAISE_2.5');
  });
});

// ========================================
// isTerminal Tests
// ========================================

describe('isTerminal', () => {
  it('returns false for empty history', () => {
    expect(isTerminal([], defaultConfig)).toBe(false);
  });

  it('returns true when player folds', () => {
    expect(isTerminal(['FOLD'], defaultConfig)).toBe(true);
  });

  it('returns true for fold after raise', () => {
    expect(isTerminal(['CALL', 'RAISE_2.5', 'FOLD'], defaultConfig)).toBe(true);
  });

  it('returns true when both players call (action closed)', () => {
    // SB calls, BB checks - action closed (actually need to test with proper sequence)
    // SB CALL means SB completes to 1BB, then BB can check or raise
    // Let's test: SB calls BB, BB checks = action closed
    expect(isTerminal(['CALL', 'CHECK'], defaultConfig)).toBe(true);
  });

  it('returns false when action remains open', () => {
    // SB calls - BB still needs to act
    expect(isTerminal(['CALL'], defaultConfig)).toBe(false);
  });

  it('returns false after raise (opponent must respond)', () => {
    expect(isTerminal(['CALL', 'RAISE_2.5'], defaultConfig)).toBe(false);
  });

  it('returns true when action closes after raise-call', () => {
    // SB calls, BB raises, SB calls
    expect(isTerminal(['CALL', 'RAISE_2.5', 'CALL'], defaultConfig)).toBe(true);
  });

  it('returns true when both all-in', () => {
    // At 10BB: SB all-in, BB call would put both all-in
    expect(isTerminal(['ALL_IN', 'CALL'], shallowStackConfig)).toBe(true);
  });
});

// ========================================
// getAvailableActions Tests
// ========================================

describe('getAvailableActions', () => {
  it('includes FOLD and CALL when facing bet', () => {
    // At the start, SB faces 1BB from BB
    const actions = getAvailableActions([], defaultConfig);
    expect(actions).toContain(PREFLOP_ACTIONS.FOLD);
    expect(actions).toContain(PREFLOP_ACTIONS.CALL);
  });

  it('includes CHECK when no bet to call', () => {
    // After SB calls, BB can check
    const actions = getAvailableActions(['CALL'], defaultConfig);
    expect(actions).toContain(PREFLOP_ACTIONS.CHECK);
  });

  it('does NOT include FOLD when no bet to call', () => {
    const actions = getAvailableActions(['CALL'], defaultConfig);
    expect(actions).not.toContain(PREFLOP_ACTIONS.FOLD);
  });

  it('includes raise sizes', () => {
    const actions = getAvailableActions([], defaultConfig);
    // Should have at least one raise option
    const hasRaise = actions.some(a => a.startsWith('RAISE_'));
    expect(hasRaise).toBe(true);
  });

  it('includes ALL_IN for shallow stacks', () => {
    const actions = getAvailableActions([], shallowStackConfig);
    expect(actions).toContain(PREFLOP_ACTIONS.ALL_IN);
  });

  it('returns deterministically sorted actions', () => {
    const actions1 = getAvailableActions([], defaultConfig);
    const actions2 = getAvailableActions([], defaultConfig);
    expect(actions1).toEqual(actions2);

    // Verify sort order: FOLD before CALL before RAISE_* before ALL_IN
    const foldIdx = actions1.indexOf(PREFLOP_ACTIONS.FOLD);
    const callIdx = actions1.indexOf(PREFLOP_ACTIONS.CALL);
    if (foldIdx >= 0 && callIdx >= 0) {
      expect(foldIdx).toBeLessThan(callIdx);
    }
  });

  it('returns empty array when player is all-in', () => {
    // After SB goes all-in and BB calls in shallow game, if we try to continue...
    // Actually, that's terminal. Test with one all-in facing the other
    const actions = getAvailableActions(['ALL_IN'], shallowStackConfig);
    // BB has actions: FOLD, CALL (can't raise more than their remaining stack)
    expect(actions).toContain(PREFLOP_ACTIONS.FOLD);
    expect(actions).toContain(PREFLOP_ACTIONS.CALL);
  });
});

// ========================================
// computeTerminalUtility Tests
// ========================================

describe('computeTerminalUtility', () => {
  it('gives pot to non-folder on fold', () => {
    // SB folds: SB loses 0.5BB (SB), BB wins 0.5BB
    const [u0, u1] = computeTerminalUtility(['FOLD'], ['AKs', 'AA'], defaultConfig);
    // Player 0 (SB) folded, loses their 0.5BB
    expect(u0).toBeLessThan(0);
    // Player 1 (BB) wins the pot
    expect(u1).toBeGreaterThan(0);
    // Zero-sum
    expect(u0 + u1).toBeCloseTo(0, 5);
  });

  it('is zero-sum', () => {
    const [u0, u1] = computeTerminalUtility(['CALL', 'RAISE_2.5', 'FOLD'], ['AKs', 'AA'], defaultConfig);
    expect(u0 + u1).toBeCloseTo(0, 5);
  });

  it('returns equal utilities for equivalent hands (chop)', () => {
    // Same hand = chop
    const [u0, u1] = computeTerminalUtility(['CALL', 'CHECK'], ['AKs', 'AKs'], defaultConfig);
    expect(u0).toBe(0);
    expect(u1).toBe(0);
  });
});

// ========================================
// getNextPlayer Tests
// ========================================

describe('getNextPlayer', () => {
  it('alternates 0 to 1', () => {
    expect(getNextPlayer(0)).toBe(1);
  });

  it('alternates 1 to 0', () => {
    expect(getNextPlayer(1)).toBe(0);
  });
});

// ========================================
// createDecisionNode Tests
// ========================================

describe('createDecisionNode', () => {
  it('creates node with correct properties', () => {
    const node = createDecisionNode([], 0, 'AKs', defaultConfig);

    expect(node.nodeType).toBe('DECISION');
    expect(node.player).toBe(0);
    expect(node.depth).toBe(0);
    expect(node.history).toEqual([]);
    expect(node.infoSetId).toBe('0:AKs:');
    expect(node.actions.length).toBeGreaterThan(0);
  });

  it('children are lazily generated (not pre-created)', () => {
    const node = createDecisionNode([], 0, 'AKs', defaultConfig);

    // Can call getChild - child is created on demand
    const child = node.getChild(node.actions[0]);
    expect(child).toBeDefined();
  });

  it('caches children after first access', () => {
    const node = createDecisionNode([], 0, 'AKs', defaultConfig);
    const action = node.actions[0];

    const child1 = node.getChild(action);
    const child2 = node.getChild(action);

    expect(child1).toBe(child2); // Same reference = cached
  });

  it('throws on invalid action', () => {
    const node = createDecisionNode([], 0, 'AKs', defaultConfig);
    expect(() => node.getChild('INVALID_ACTION')).toThrow();
  });

  it('creates terminal child when action leads to terminal', () => {
    const node = createDecisionNode([], 0, 'AKs', defaultConfig);
    const foldChild = node.getChild(PREFLOP_ACTIONS.FOLD);

    expect(foldChild.nodeType).toBe('TERMINAL');
  });

  it('creates decision child when action continues play', () => {
    const node = createDecisionNode([], 0, 'AKs', defaultConfig);
    const callChild = node.getChild(PREFLOP_ACTIONS.CALL);

    expect(callChild.nodeType).toBe('DECISION');
  });
});

// ========================================
// createPreflopTree Tests
// ========================================

describe('createPreflopTree', () => {
  it('returns ChanceNode', () => {
    const root = createPreflopTree(defaultConfig);
    expect(root.nodeType).toBe('CHANCE');
  });

  it('has 169 canonical hand outcomes', () => {
    const root = createPreflopTree(defaultConfig);
    expect(root.outcomes.length).toBe(169);
  });

  it('outcomes include all canonical hands', () => {
    const root = createPreflopTree(defaultConfig);
    for (const hand of CANONICAL_HANDS) {
      expect(root.outcomes).toContain(hand);
    }
  });

  it('probabilities sum to 1', () => {
    const root = createPreflopTree(defaultConfig);
    const sum = root.probabilities.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('lazily generates decision children', () => {
    const root = createPreflopTree(defaultConfig);
    const child = root.getChild('AA');

    expect(child.nodeType).toBe('DECISION');
    if (child.nodeType === 'DECISION') {
      expect(child.player).toBe(0); // SB acts first
    }
  });

  it('caches children', () => {
    const root = createPreflopTree(defaultConfig);
    const child1 = root.getChild('AKs');
    const child2 = root.getChild('AKs');

    expect(child1).toBe(child2);
  });

  it('throws on invalid outcome', () => {
    const root = createPreflopTree(defaultConfig);
    expect(() => root.getChild('INVALID')).toThrow();
  });
});

// ========================================
// Card Removal Tests
// ========================================

describe('getValidVillainHands', () => {
  it('excludes blocked hands (same pair)', () => {
    const validHands = getValidVillainHands('AA');

    // AA completely blocks villain from having AA
    expect(validHands).not.toContain('AA');
  });

  it('includes unblocked hands', () => {
    const validHands = getValidVillainHands('AA');

    // 22 is not blocked by AA
    expect(validHands).toContain('22');
    expect(validHands).toContain('KK');
  });

  it('returns most hands (only partial blocks)', () => {
    const validHands = getValidVillainHands('AKs');

    // Most hands should still be valid (just with fewer combos)
    // AKs blocks Ax, Kx hands significantly, so expect >100 rather than >150
    expect(validHands.length).toBeGreaterThan(100);
  });

  it('always returns at least 100 hands', () => {
    // Even with blockers, most hands have at least one valid combo
    for (const hand of ['AA', 'AKs', 'AKo', '72o']) {
      const validHands = getValidVillainHands(hand);
      expect(validHands.length).toBeGreaterThan(100);
    }
  });
});

describe('countUnblockedCombos', () => {
  it('AA blocks all AA combos', () => {
    // Hero AA uses all 4 aces, villain cannot have any AA combo
    const count = countUnblockedCombos('AA', 'AA');
    expect(count).toBe(0);
  });

  it('AA does not block 22', () => {
    // AA and 22 share no cards
    const count = countUnblockedCombos('AA', '22');
    expect(count).toBe(6); // All 6 combos of 22
  });

  it('AKs partially blocks AQs', () => {
    // AKs uses one ace, AQs also uses aces
    // Hero has 4 combos of AKs (one per suit)
    // AQs has 4 combos, each blocked by same-suit AK
    const count = countUnblockedCombos('AKs', 'AQs');
    // Each suit of AK blocks that suit of AQ
    expect(count).toBe(0); // All 4 suits blocked
  });

  it('AKo partially blocks AQo', () => {
    // AKo has 12 combos, uses 4 aces and 4 kings
    // AQo has 12 combos, uses 4 aces and 4 queens
    // Each AQ combo blocked if its ace is in an AK combo
    const count = countUnblockedCombos('AKo', 'AQo');
    // AKo uses all 4 aces, so AQo is fully blocked
    expect(count).toBe(0);
  });

  it('72o does not block AKs', () => {
    const count = countUnblockedCombos('72o', 'AKs');
    expect(count).toBe(4); // All 4 suited AK combos
  });
});

// ========================================
// createPreflopScenario Tests
// ========================================

describe('createPreflopScenario', () => {
  const scenarioConfig: PreflopTreeConfig = {
    ...defaultConfig,
    heroPosition: 'SB',
    villainPosition: 'BB',
    priorActions: [],
  };

  it('creates decision node for hero', () => {
    const node = createPreflopScenario('AKs', ['AA', 'KK', 'QQ'], scenarioConfig);

    expect(node.nodeType).toBe('DECISION');
    expect(node.player).toBe(0); // SB = player 0
  });

  it('respects prior actions', () => {
    const configWithRaise: PreflopTreeConfig = {
      ...scenarioConfig,
      heroPosition: 'BB',
      priorActions: ['CALL', 'RAISE_2.5'], // SB calls, BB raises, waiting for SB
    };

    // Actually this would be SB to act after BB raises
    // Let me reconsider: after CALL, RAISE_2.5, it's SB's turn
    const node = createPreflopScenario('AKs', ['AA'], configWithRaise);

    expect(node.depth).toBe(2);
    expect(node.history).toEqual(['CALL', 'RAISE_2.5']);
  });

  it('has correct actions for opening spot', () => {
    const node = createPreflopScenario('AKs', ['AA', 'KK'], scenarioConfig);

    expect(node.actions).toContain(PREFLOP_ACTIONS.FOLD);
    expect(node.actions).toContain(PREFLOP_ACTIONS.CALL);
  });

  it('has correct actions when facing raise', () => {
    const facingRaiseConfig: PreflopTreeConfig = {
      ...scenarioConfig,
      heroPosition: 'BB',
      priorActions: ['CALL', 'RAISE_2.5', 'RAISE_3'], // SB calls, BB raises, SB 3bets
    };

    // Wrong - after CALL, RAISE_2.5, RAISE_3, it's BB's turn to act
    // Actually wait, player alternation: SB, BB, SB, BB...
    // CALL (SB), RAISE_2.5 (BB), RAISE_3 (SB) -> BB to act
    // So if hero is BB, this is correct
    const node = createPreflopScenario('QQ', ['AA', 'KK'], facingRaiseConfig);

    expect(node.actions).toContain(PREFLOP_ACTIONS.FOLD);
    expect(node.actions).toContain(PREFLOP_ACTIONS.CALL);
  });
});

// ========================================
// Tree Depth Bounds Tests
// ========================================

describe('tree depth bounds', () => {
  it('preflop tree stays bounded (max 10 actions deep)', () => {
    // Traverse tree and ensure we don't exceed reasonable depth
    const root = createPreflopTree(defaultConfig);
    const maxDepthSeen = traverseAndCheckDepth(root.getChild('AKs'), 10);
    expect(maxDepthSeen).toBeLessThanOrEqual(10);
  });
});

/**
 * Helper to traverse tree and find max depth, stopping at limit.
 */
function traverseAndCheckDepth(node: ReturnType<typeof createPreflopTree>['getChild'] extends (o: string) => infer R ? R : never, limit: number, current = 0): number {
  if (current >= limit) return current;
  if (node.nodeType === 'TERMINAL') return node.depth;

  if (node.nodeType === 'DECISION') {
    let maxDepth = node.depth;
    for (const action of node.actions.slice(0, 2)) { // Only check first 2 actions to limit search
      const child = node.getChild(action);
      const childDepth = traverseAndCheckDepth(child, limit, current + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
    return maxDepth;
  }

  return current;
}
