// src/lib/solver/benchmark/scenarios.test.ts
import { describe, it, expect } from 'vitest';
import {
  BENCHMARK_SCENARIOS,
  PREFLOP_BENCHMARK_SCENARIOS,
  POSTFLOP_BENCHMARK_SCENARIOS,
  BenchmarkScenario,
  createBenchmarkScenario,
  getScenarioById,
  getScenariosByType,
  PostflopConfig,
} from './scenarios';
import type { PreflopTreeConfig } from '../types';
import { CANONICAL_HANDS } from '../abstraction/cards';

describe('BENCHMARK_SCENARIOS', () => {
  it('contains all preflop and postflop scenarios', () => {
    const totalExpected =
      PREFLOP_BENCHMARK_SCENARIOS.length + POSTFLOP_BENCHMARK_SCENARIOS.length;
    expect(BENCHMARK_SCENARIOS.length).toBe(totalExpected);
  });

  it('has at least 5 preflop scenarios', () => {
    expect(PREFLOP_BENCHMARK_SCENARIOS.length).toBeGreaterThanOrEqual(5);
  });

  it('has at least 3 postflop scenarios', () => {
    expect(POSTFLOP_BENCHMARK_SCENARIOS.length).toBeGreaterThanOrEqual(3);
  });

  it('all scenarios have unique IDs', () => {
    const ids = BENCHMARK_SCENARIOS.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all scenarios have non-empty names', () => {
    for (const scenario of BENCHMARK_SCENARIOS) {
      expect(scenario.name.length).toBeGreaterThan(0);
    }
  });

  it('all scenarios have non-empty descriptions', () => {
    for (const scenario of BENCHMARK_SCENARIOS) {
      expect(scenario.description.length).toBeGreaterThan(0);
    }
  });

  it('all scenario IDs follow naming convention', () => {
    for (const scenario of BENCHMARK_SCENARIOS) {
      // ID should be lowercase with hyphens
      expect(scenario.id).toMatch(/^[a-z0-9-]+$/);
      // ID should start with type
      expect(scenario.id).toMatch(/^(preflop|postflop)-/);
    }
  });
});

describe('PREFLOP_BENCHMARK_SCENARIOS', () => {
  it('all have type "preflop"', () => {
    for (const scenario of PREFLOP_BENCHMARK_SCENARIOS) {
      expect(scenario.type).toBe('preflop');
    }
  });

  it('all have valid PreflopTreeConfig', () => {
    for (const scenario of PREFLOP_BENCHMARK_SCENARIOS) {
      const config = scenario.config as PreflopTreeConfig;

      expect(config.startingStackBb).toBeGreaterThan(0);
      expect(config.smallBlindBb).toBe(0.5);
      expect(config.bigBlindBb).toBe(1);
      expect(config.positions.length).toBeGreaterThanOrEqual(2);
      expect(['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']).toContain(config.heroPosition);
      expect(['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']).toContain(config.villainPosition);
      expect(Array.isArray(config.priorActions)).toBe(true);
    }
  });

  it('includes BTN RFI scenario', () => {
    const btnRfi = PREFLOP_BENCHMARK_SCENARIOS.find(s => s.id === 'preflop-rfi-btn');
    expect(btnRfi).toBeDefined();
    expect(btnRfi?.name).toBe('BTN RFI');
  });

  it('includes BB vs BTN scenario', () => {
    const bbVsBtn = PREFLOP_BENCHMARK_SCENARIOS.find(s => s.id === 'preflop-bb-vs-btn');
    expect(bbVsBtn).toBeDefined();
    const config = bbVsBtn?.config as PreflopTreeConfig;
    expect(config.priorActions).toContain('RAISE_2.5');
  });

  it('includes SB vs BB scenario', () => {
    const sbVsBb = PREFLOP_BENCHMARK_SCENARIOS.find(s => s.id === 'preflop-sb-vs-bb');
    expect(sbVsBb).toBeDefined();
    const config = sbVsBb?.config as PreflopTreeConfig;
    expect(config.heroPosition).toBe('SB');
    expect(config.villainPosition).toBe('BB');
  });

  it('includes BTN vs CO 3bet scenario', () => {
    const scenario = PREFLOP_BENCHMARK_SCENARIOS.find(s => s.id === 'preflop-btn-vs-co-3bet');
    expect(scenario).toBeDefined();
    const config = scenario?.config as PreflopTreeConfig;
    expect(config.priorActions.length).toBeGreaterThan(0);
  });

  it('includes squeeze scenario', () => {
    const scenario = PREFLOP_BENCHMARK_SCENARIOS.find(s => s.id === 'preflop-bb-squeeze');
    expect(scenario).toBeDefined();
    const config = scenario?.config as PreflopTreeConfig;
    expect(config.priorActions).toContain('CALL');
  });

  it('critical hands are valid canonical hands', () => {
    for (const scenario of PREFLOP_BENCHMARK_SCENARIOS) {
      if (scenario.criticalHands) {
        for (const hand of scenario.criticalHands) {
          expect(CANONICAL_HANDS).toContain(hand);
        }
      }
    }
  });
});

describe('POSTFLOP_BENCHMARK_SCENARIOS', () => {
  it('all have type "postflop"', () => {
    for (const scenario of POSTFLOP_BENCHMARK_SCENARIOS) {
      expect(scenario.type).toBe('postflop');
    }
  });

  it('all have valid PostflopConfig', () => {
    for (const scenario of POSTFLOP_BENCHMARK_SCENARIOS) {
      const config = scenario.config as PostflopConfig;

      expect(config.potBb).toBeGreaterThan(0);
      expect(config.stackBb).toBeGreaterThan(0);
      expect(config.board.length).toBe(3); // Flop
      expect(['IP', 'OOP']).toContain(config.heroPosition);
      expect(config.priorContext.length).toBeGreaterThan(0);
    }
  });

  it('includes AKx flop scenario', () => {
    const scenario = POSTFLOP_BENCHMARK_SCENARIOS.find(s => s.id === 'postflop-cbet-akx-ip');
    expect(scenario).toBeDefined();
    const config = scenario?.config as PostflopConfig;
    expect(config.board).toContain('Ah');
    expect(config.board).toContain('Kc');
  });

  it('includes 876 connected board scenario', () => {
    const scenario = POSTFLOP_BENCHMARK_SCENARIOS.find(s => s.id === 'postflop-cbet-876-ip');
    expect(scenario).toBeDefined();
  });

  it('includes KK2 paired board scenario', () => {
    const scenario = POSTFLOP_BENCHMARK_SCENARIOS.find(s => s.id === 'postflop-cbet-kk2-ip');
    expect(scenario).toBeDefined();
  });

  it('board cards are unique within each scenario', () => {
    for (const scenario of POSTFLOP_BENCHMARK_SCENARIOS) {
      const config = scenario.config as PostflopConfig;
      const uniqueCards = new Set(config.board);
      // Note: KK2 board has K twice by rank but with different suits, so check full card strings
      expect(uniqueCards.size).toBe(config.board.length);
    }
  });
});

describe('createBenchmarkScenario', () => {
  it('creates valid preflop scenario', () => {
    const config: PreflopTreeConfig = {
      startingStackBb: 100,
      smallBlindBb: 0.5,
      bigBlindBb: 1,
      positions: ['BTN', 'SB', 'BB'],
      actionAbstraction: {
        betSizes: { PREFLOP: [1.0], FLOP: [], TURN: [], RIVER: [] },
        raiseSizes: { PREFLOP: [2.5], FLOP: [], TURN: [], RIVER: [] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
      heroPosition: 'BTN',
      villainPosition: 'BB',
      priorActions: [],
    };

    const scenario = createBenchmarkScenario('preflop', config, {
      id: 'custom-preflop-test',
      name: 'Custom Test',
      description: 'Test scenario',
    });

    expect(scenario.id).toBe('custom-preflop-test');
    expect(scenario.type).toBe('preflop');
  });

  it('creates valid postflop scenario', () => {
    const config: PostflopConfig = {
      potBb: 10,
      stackBb: 90,
      board: ['Ah', 'Kc', '2d'],
      heroPosition: 'IP',
      priorContext: 'SRP',
      actionAbstraction: {
        betSizes: { PREFLOP: [], FLOP: [0.5], TURN: [], RIVER: [] },
        raiseSizes: { PREFLOP: [], FLOP: [2.5], TURN: [], RIVER: [] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
    };

    const scenario = createBenchmarkScenario('postflop', config, {
      id: 'custom-postflop-test',
      name: 'Custom Postflop',
      description: 'Test postflop scenario',
    });

    expect(scenario.id).toBe('custom-postflop-test');
    expect(scenario.type).toBe('postflop');
  });

  it('throws on mismatched config type (preflop with postflop config)', () => {
    const postflopConfig: PostflopConfig = {
      potBb: 10,
      stackBb: 90,
      board: ['Ah', 'Kc', '2d'],
      heroPosition: 'IP',
      priorContext: 'SRP',
      actionAbstraction: {
        betSizes: { PREFLOP: [], FLOP: [0.5], TURN: [], RIVER: [] },
        raiseSizes: { PREFLOP: [], FLOP: [2.5], TURN: [], RIVER: [] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
    };

    expect(() =>
      createBenchmarkScenario('preflop', postflopConfig, {
        id: 'bad-scenario',
        name: 'Bad',
        description: 'Should fail',
      })
    ).toThrow('Preflop scenario requires PreflopTreeConfig');
  });

  it('throws on duplicate ID', () => {
    const config: PreflopTreeConfig = {
      startingStackBb: 100,
      smallBlindBb: 0.5,
      bigBlindBb: 1,
      positions: ['BTN', 'SB', 'BB'],
      actionAbstraction: {
        betSizes: { PREFLOP: [1.0], FLOP: [], TURN: [], RIVER: [] },
        raiseSizes: { PREFLOP: [2.5], FLOP: [], TURN: [], RIVER: [] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
      heroPosition: 'BTN',
      villainPosition: 'BB',
      priorActions: [],
    };

    // Use existing ID
    expect(() =>
      createBenchmarkScenario('preflop', config, {
        id: 'preflop-rfi-btn', // Already exists
        name: 'Duplicate',
        description: 'Should fail',
      })
    ).toThrow("Scenario ID 'preflop-rfi-btn' already exists");
  });

  it('throws on invalid critical hand', () => {
    const config: PreflopTreeConfig = {
      startingStackBb: 100,
      smallBlindBb: 0.5,
      bigBlindBb: 1,
      positions: ['BTN', 'SB', 'BB'],
      actionAbstraction: {
        betSizes: { PREFLOP: [1.0], FLOP: [], TURN: [], RIVER: [] },
        raiseSizes: { PREFLOP: [2.5], FLOP: [], TURN: [], RIVER: [] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
      heroPosition: 'BTN',
      villainPosition: 'BB',
      priorActions: [],
    };

    expect(() =>
      createBenchmarkScenario('preflop', config, {
        id: 'test-invalid-hand',
        name: 'Test',
        description: 'Test',
        criticalHands: ['XX'], // Invalid hand
      })
    ).toThrow('Invalid critical hand: XX');
  });

  it('accepts valid critical hands', () => {
    const config: PreflopTreeConfig = {
      startingStackBb: 100,
      smallBlindBb: 0.5,
      bigBlindBb: 1,
      positions: ['BTN', 'SB', 'BB'],
      actionAbstraction: {
        betSizes: { PREFLOP: [1.0], FLOP: [], TURN: [], RIVER: [] },
        raiseSizes: { PREFLOP: [2.5], FLOP: [], TURN: [], RIVER: [] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
      heroPosition: 'BTN',
      villainPosition: 'BB',
      priorActions: [],
    };

    const scenario = createBenchmarkScenario('preflop', config, {
      id: 'test-valid-hands',
      name: 'Test',
      description: 'Test',
      criticalHands: ['AA', 'KK', 'AKs'],
    });

    expect(scenario.criticalHands).toEqual(['AA', 'KK', 'AKs']);
  });
});

describe('getScenarioById', () => {
  it('finds existing scenario', () => {
    const scenario = getScenarioById('preflop-rfi-btn');
    expect(scenario).toBeDefined();
    expect(scenario?.name).toBe('BTN RFI');
  });

  it('returns undefined for non-existent ID', () => {
    const scenario = getScenarioById('non-existent-id');
    expect(scenario).toBeUndefined();
  });
});

describe('getScenariosByType', () => {
  it('returns only preflop scenarios', () => {
    const scenarios = getScenariosByType('preflop');
    expect(scenarios.length).toBe(PREFLOP_BENCHMARK_SCENARIOS.length);
    expect(scenarios.every(s => s.type === 'preflop')).toBe(true);
  });

  it('returns only postflop scenarios', () => {
    const scenarios = getScenariosByType('postflop');
    expect(scenarios.length).toBe(POSTFLOP_BENCHMARK_SCENARIOS.length);
    expect(scenarios.every(s => s.type === 'postflop')).toBe(true);
  });
});
