// src/lib/solver/benchmark/comparator.test.ts
import { describe, it, expect } from 'vitest';
import {
  loadPioReference,
  compareSolutions,
  calculateEvDelta,
  validateReferenceSolution,
  listReferenceScenarios,
  getExpectedHandCount,
  type SolverSolution,
  type ReferenceSolution,
} from './comparator';
import { CANONICAL_HANDS } from '../abstraction/cards';

describe('loadPioReference', () => {
  it('loads preflop-rfi-btn scenario', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    expect(ref.scenarioId).toBe('preflop-rfi-btn');
    expect(ref.strategies.size).toBeGreaterThan(0);
    expect(ref.evs.size).toBeGreaterThan(0);
  });

  it('loads preflop-bb-vs-btn scenario', () => {
    const ref = loadPioReference('preflop-bb-vs-btn');

    expect(ref.scenarioId).toBe('preflop-bb-vs-btn');
    expect(ref.strategies.size).toBe(169);
    expect(ref.evs.size).toBe(169);
  });

  it('loads preflop-sb-vs-bb scenario', () => {
    const ref = loadPioReference('preflop-sb-vs-bb');

    expect(ref.scenarioId).toBe('preflop-sb-vs-bb');
    expect(ref.strategies.size).toBe(169);
  });

  it('throws on missing scenario', () => {
    expect(() => loadPioReference('non-existent-scenario')).toThrow(
      'Reference scenario not found: non-existent-scenario'
    );
  });

  it('parses strategy maps correctly', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    const aaStrategy = ref.strategies.get('AA');
    expect(aaStrategy).toBeDefined();
    expect(aaStrategy!.get('RAISE_2.5')).toBe(1.0);
    expect(aaStrategy!.get('FOLD')).toBe(0);
    expect(aaStrategy!.get('CALL')).toBe(0);
  });

  it('parses EV values correctly', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    expect(ref.evs.get('AA')).toBe(0.35);
    expect(ref.evs.get('KK')).toBe(0.28);
    expect(ref.evs.get('72o')).toBe(-0.01);
  });
});

describe('listReferenceScenarios', () => {
  it('returns all available scenario IDs', () => {
    const scenarios = listReferenceScenarios();

    expect(scenarios).toContain('preflop-rfi-btn');
    expect(scenarios).toContain('preflop-bb-vs-btn');
    expect(scenarios).toContain('preflop-sb-vs-bb');
    expect(scenarios.length).toBeGreaterThanOrEqual(3);
  });
});

describe('compareSolutions', () => {
  it('identifies matching solutions (delta = 0)', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    // Create solver solution that matches reference exactly
    const solver: SolverSolution = {
      strategies: ref.strategies,
      evs: ref.evs,
    };

    const result = compareSolutions(solver, ref);

    expect(result.passed).toBe(true);
    expect(result.maxEvDelta).toBe(0);
    expect(result.avgEvDelta).toBe(0);
    expect(result.scenarioId).toBe('preflop-rfi-btn');
  });

  it('identifies divergent solutions (delta > 0)', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    // Create solver solution with slight differences
    const solverStrategies = new Map(ref.strategies);
    const solverEvs = new Map<string, number>();

    for (const [hand, ev] of ref.evs) {
      // Add small delta to EVs
      solverEvs.set(hand, ev + 0.0005);
    }

    const solver: SolverSolution = {
      strategies: solverStrategies,
      evs: solverEvs,
    };

    const result = compareSolutions(solver, ref);

    expect(result.passed).toBe(true); // Within tolerance
    expect(result.maxEvDelta).toBeCloseTo(0.0005, 5);
    expect(result.avgEvDelta).toBeCloseTo(0.0005, 5);
  });

  it('fails when delta exceeds tolerance', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    // Create solver solution with large differences
    const solverStrategies = new Map(ref.strategies);
    const solverEvs = new Map<string, number>();

    for (const [hand, ev] of ref.evs) {
      solverEvs.set(hand, ev + 0.01); // 1% EV difference
    }

    const solver: SolverSolution = {
      strategies: solverStrategies,
      evs: solverEvs,
    };

    const result = compareSolutions(solver, ref, 0.001);

    expect(result.passed).toBe(false);
    expect(result.maxEvDelta).toBeGreaterThan(0.001);
  });

  it('ComparisonResult.passed is true when all deltas < 0.001', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    const solverStrategies = new Map(ref.strategies);
    const solverEvs = new Map<string, number>();

    for (const [hand, ev] of ref.evs) {
      solverEvs.set(hand, ev + 0.0009); // Just under tolerance
    }

    const solver: SolverSolution = {
      strategies: solverStrategies,
      evs: solverEvs,
    };

    const result = compareSolutions(solver, ref, 0.001);

    expect(result.passed).toBe(true);
  });

  it('handles missing solver data for a hand', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    // Empty solver solution
    const solver: SolverSolution = {
      strategies: new Map(),
      evs: new Map(),
    };

    const result = compareSolutions(solver, ref);

    expect(result.passed).toBe(false);
    expect(result.handResults.size).toBe(ref.evs.size);
  });

  it('tracks worst hand correctly', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    const solverStrategies = new Map(ref.strategies);
    const solverEvs = new Map<string, number>();

    // Make all EVs match except AA
    for (const [hand, ev] of ref.evs) {
      if (hand === 'AA') {
        solverEvs.set(hand, ev + 0.1); // Large delta for AA
      } else {
        solverEvs.set(hand, ev);
      }
    }

    const solver: SolverSolution = {
      strategies: solverStrategies,
      evs: solverEvs,
    };

    const result = compareSolutions(solver, ref);

    expect(result.worstHand).toBe('AA');
    expect(result.maxEvDelta).toBeCloseTo(0.1, 5);
  });

  it('respects custom tolerance parameter', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    const solverStrategies = new Map(ref.strategies);
    const solverEvs = new Map<string, number>();

    for (const [hand, ev] of ref.evs) {
      solverEvs.set(hand, ev + 0.05); // 5% delta
    }

    const solver: SolverSolution = {
      strategies: solverStrategies,
      evs: solverEvs,
    };

    // Fails with default tolerance
    const strictResult = compareSolutions(solver, ref, 0.001);
    expect(strictResult.passed).toBe(false);

    // Passes with relaxed tolerance
    const relaxedResult = compareSolutions(solver, ref, 0.1);
    expect(relaxedResult.passed).toBe(true);
  });
});

describe('calculateEvDelta', () => {
  it('returns absolute difference for normal values', () => {
    expect(calculateEvDelta(0.35, 0.35)).toBe(0);
    expect(calculateEvDelta(0.35, 0.30)).toBeCloseTo(0.05, 5);
    expect(calculateEvDelta(-0.01, 0.01)).toBeCloseTo(0.02, 5);
  });

  it('handles NaN values', () => {
    expect(calculateEvDelta(NaN, 0.35)).toBe(Number.MAX_VALUE);
    expect(calculateEvDelta(0.35, NaN)).toBe(Number.MAX_VALUE);
    expect(calculateEvDelta(NaN, NaN)).toBe(Number.MAX_VALUE);
  });

  it('handles Infinity values', () => {
    expect(calculateEvDelta(Infinity, 0.35)).toBe(Number.MAX_VALUE);
    expect(calculateEvDelta(0.35, -Infinity)).toBe(Number.MAX_VALUE);
    expect(calculateEvDelta(Infinity, Infinity)).toBe(Number.MAX_VALUE);
  });

  it('handles zero values', () => {
    expect(calculateEvDelta(0, 0)).toBe(0);
    expect(calculateEvDelta(0, 0.01)).toBeCloseTo(0.01, 5);
    expect(calculateEvDelta(-0.01, 0)).toBeCloseTo(0.01, 5);
  });

  it('handles negative values', () => {
    expect(calculateEvDelta(-0.05, -0.05)).toBe(0);
    expect(calculateEvDelta(-0.05, -0.10)).toBeCloseTo(0.05, 5);
    expect(calculateEvDelta(-0.05, 0.05)).toBeCloseTo(0.10, 5);
  });
});

describe('validateReferenceSolution', () => {
  it('validates well-formed reference solution', () => {
    const ref = loadPioReference('preflop-rfi-btn');
    const errors = validateReferenceSolution(ref);

    expect(errors).toEqual([]);
  });

  it('detects frequencies not summing to 1.0', () => {
    const ref: ReferenceSolution = {
      scenarioId: 'test',
      strategies: new Map([
        ['AA', new Map([['RAISE', 0.5], ['CALL', 0.3]])], // Sum = 0.8
      ]),
      evs: new Map([['AA', 0.35]]),
    };

    const errors = validateReferenceSolution(ref);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('AA');
    expect(errors[0]).toContain('frequencies sum to');
  });

  it('detects missing EV values', () => {
    const ref: ReferenceSolution = {
      scenarioId: 'test',
      strategies: new Map([
        ['AA', new Map([['RAISE', 1.0]])],
      ]),
      evs: new Map(), // Missing EV
    };

    const errors = validateReferenceSolution(ref);

    expect(errors.some(e => e.includes('missing EV'))).toBe(true);
  });

  it('detects EVs outside reasonable range', () => {
    const ref: ReferenceSolution = {
      scenarioId: 'test',
      strategies: new Map([
        ['AA', new Map([['RAISE', 1.0]])],
      ]),
      evs: new Map([['AA', 50]]), // Unreasonably high
    };

    const errors = validateReferenceSolution(ref);

    expect(errors.some(e => e.includes('outside reasonable range'))).toBe(true);
  });
});

describe('getExpectedHandCount', () => {
  it('returns 169 for preflop scenarios', () => {
    expect(getExpectedHandCount('preflop-rfi-btn')).toBe(169);
    expect(getExpectedHandCount('preflop-bb-vs-btn')).toBe(169);
    expect(getExpectedHandCount('preflop-sb-vs-bb')).toBe(169);
  });

  it('returns 0 for postflop scenarios (variable)', () => {
    expect(getExpectedHandCount('postflop-cbet-akx-ip')).toBe(0);
  });
});

describe('Reference data integrity', () => {
  it('preflop-rfi-btn covers all 169 hands', () => {
    const ref = loadPioReference('preflop-rfi-btn');

    expect(ref.strategies.size).toBe(169);
    expect(ref.evs.size).toBe(169);

    // Verify all canonical hands are present
    for (const hand of CANONICAL_HANDS) {
      expect(ref.strategies.has(hand)).toBe(true);
      expect(ref.evs.has(hand)).toBe(true);
    }
  });

  it('preflop-bb-vs-btn covers all 169 hands', () => {
    const ref = loadPioReference('preflop-bb-vs-btn');

    expect(ref.strategies.size).toBe(169);
    expect(ref.evs.size).toBe(169);
  });

  it('preflop-sb-vs-bb covers all 169 hands', () => {
    const ref = loadPioReference('preflop-sb-vs-bb');

    expect(ref.strategies.size).toBe(169);
    expect(ref.evs.size).toBe(169);
  });

  it('all reference strategies sum to 1.0', () => {
    const scenarios = ['preflop-rfi-btn', 'preflop-bb-vs-btn', 'preflop-sb-vs-bb'];

    for (const scenarioId of scenarios) {
      const ref = loadPioReference(scenarioId);
      const errors = validateReferenceSolution(ref);
      expect(errors).toEqual([]);
    }
  });

  it('all reference EVs are in reasonable range', () => {
    const scenarios = ['preflop-rfi-btn', 'preflop-bb-vs-btn', 'preflop-sb-vs-bb'];

    for (const scenarioId of scenarios) {
      const ref = loadPioReference(scenarioId);

      for (const [hand, ev] of ref.evs) {
        expect(ev).toBeGreaterThanOrEqual(-1.0);
        expect(ev).toBeLessThanOrEqual(5.0);
      }
    }
  });
});
