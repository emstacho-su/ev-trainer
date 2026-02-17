// src/lib/solver/benchmark/validation.ts
// Validation suite runner for comparing solver output against PioSolver references.

import type { CanonicalHand, PreflopTreeConfig } from '../types';
import {
  BENCHMARK_SCENARIOS,
  type BenchmarkScenario,
  type PostflopConfig,
  getScenarioById,
} from './scenarios';
import {
  loadPioReference,
  compareSolutions,
  listReferenceScenarios,
  type ComparisonResult,
  type SolverSolution,
  type ReferenceSolution,
} from './comparator';

// ========================================
// Types
// ========================================

/**
 * Configuration for running benchmark validation.
 */
export interface ValidationConfig {
  /** Specific scenarios to run (default: all with reference data) */
  readonly scenarios?: readonly string[];
  /** EV tolerance in BB (default: 0.001 = 0.1%) */
  readonly tolerance: number;
  /** Print per-hand results (default: false) */
  readonly verbose: boolean;
  /** Stop at first failure (default: false) */
  readonly stopOnFailure: boolean;
}

/**
 * Result of validating a single scenario.
 */
export interface ValidationResult {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly passed: boolean;
  readonly comparison: ComparisonResult;
  readonly solverTimeMs: number;
  readonly iterations: number;
  readonly exploitability: number;
  readonly error?: string;
}

/**
 * Comprehensive benchmark report.
 */
export interface BenchmarkReport {
  readonly timestamp: string;
  readonly totalScenarios: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly avgEvDelta: number;
  readonly maxEvDelta: number;
  readonly worstScenario: string;
  readonly worstHand: CanonicalHand;
  readonly totalTimeMs: number;
  readonly results: readonly ValidationResult[];
}

/**
 * Default validation configuration.
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  tolerance: 0.001,
  verbose: false,
  stopOnFailure: false,
};

// ========================================
// Solver Integration (Placeholder)
// ========================================

/**
 * Interface for solver function that validation can call.
 * This will be connected to actual solvers once 01-05 and 01-06 are complete.
 */
export type SolverFunction = (scenario: BenchmarkScenario) => Promise<{
  solution: SolverSolution;
  timeMs: number;
  iterations: number;
  exploitability: number;
}>;

/**
 * Mock solver for testing validation infrastructure.
 * Returns reference data as "solved" output (perfect match).
 */
export async function mockSolver(scenario: BenchmarkScenario): Promise<{
  solution: SolverSolution;
  timeMs: number;
  iterations: number;
  exploitability: number;
}> {
  // Load reference and return as solver output (perfect match for testing)
  try {
    const ref = loadPioReference(scenario.id);
    return {
      solution: {
        strategies: ref.strategies,
        evs: ref.evs,
      },
      timeMs: Math.random() * 1000 + 100,
      iterations: 1000,
      exploitability: 0.0001,
    };
  } catch {
    // No reference data - return empty solution
    return {
      solution: {
        strategies: new Map(),
        evs: new Map(),
      },
      timeMs: 0,
      iterations: 0,
      exploitability: Infinity,
    };
  }
}

/**
 * Create a solver function that introduces controlled error for testing.
 *
 * @param evDelta - Amount to add to all EVs (for testing tolerance)
 * @returns Solver function that produces solutions with known error
 */
export function createTestSolver(evDelta: number): SolverFunction {
  return async (scenario: BenchmarkScenario) => {
    try {
      const ref = loadPioReference(scenario.id);

      // Modify EVs by delta
      const evs = new Map<CanonicalHand, number>();
      for (const [hand, ev] of ref.evs) {
        evs.set(hand, ev + evDelta);
      }

      return {
        solution: {
          strategies: ref.strategies,
          evs,
        },
        timeMs: Math.random() * 1000 + 100,
        iterations: 1000,
        exploitability: Math.abs(evDelta) * 1000,
      };
    } catch {
      return {
        solution: { strategies: new Map(), evs: new Map() },
        timeMs: 0,
        iterations: 0,
        exploitability: Infinity,
      };
    }
  };
}

// ========================================
// Validation Runner
// ========================================

/**
 * Runs benchmark validation against PioSolver references.
 *
 * @param config - Validation configuration (optional, uses defaults)
 * @param solver - Solver function to use (optional, uses mock solver)
 * @returns Comprehensive benchmark report
 */
export async function runBenchmarkValidation(
  config: Partial<ValidationConfig> = {},
  solver: SolverFunction = mockSolver
): Promise<BenchmarkReport> {
  const fullConfig: ValidationConfig = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Determine which scenarios to run
  const availableReferences = listReferenceScenarios();
  let scenariosToRun: string[];

  if (fullConfig.scenarios && fullConfig.scenarios.length > 0) {
    // Filter to only those with reference data
    scenariosToRun = fullConfig.scenarios.filter(id => availableReferences.includes(id));
  } else {
    // Run all scenarios that have reference data
    scenariosToRun = BENCHMARK_SCENARIOS
      .map(s => s.id)
      .filter(id => availableReferences.includes(id));
  }

  const results: ValidationResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let maxEvDelta = 0;
  let worstScenario = '';
  let worstHand: CanonicalHand = 'AA';
  let totalEvDelta = 0;
  let scenarioCount = 0;

  for (const scenarioId of scenariosToRun) {
    const scenario = getScenarioById(scenarioId);

    if (!scenario) {
      skipped++;
      continue;
    }

    try {
      // Run solver
      const solverResult = await solver(scenario);

      // Load reference
      const reference = loadPioReference(scenarioId);

      // Compare solutions
      const comparison = compareSolutions(
        solverResult.solution,
        reference,
        fullConfig.tolerance
      );

      const result: ValidationResult = {
        scenarioId,
        scenarioName: scenario.name,
        passed: comparison.passed,
        comparison,
        solverTimeMs: solverResult.timeMs,
        iterations: solverResult.iterations,
        exploitability: solverResult.exploitability,
      };

      results.push(result);

      if (comparison.passed) {
        passed++;
      } else {
        failed++;
      }

      // Track worst case
      if (comparison.maxEvDelta > maxEvDelta) {
        maxEvDelta = comparison.maxEvDelta;
        worstScenario = scenarioId;
        worstHand = comparison.worstHand;
      }

      totalEvDelta += comparison.avgEvDelta;
      scenarioCount++;

      // Stop on failure if configured
      if (!comparison.passed && fullConfig.stopOnFailure) {
        break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      results.push({
        scenarioId,
        scenarioName: scenario.name,
        passed: false,
        comparison: {
          scenarioId,
          passed: false,
          maxEvDelta: Infinity,
          avgEvDelta: Infinity,
          worstHand: 'AA',
          handResults: new Map(),
        },
        solverTimeMs: 0,
        iterations: 0,
        exploitability: Infinity,
        error: errorMessage,
      });

      failed++;

      if (fullConfig.stopOnFailure) {
        break;
      }
    }
  }

  const totalTimeMs = Date.now() - startTime;
  const avgEvDelta = scenarioCount > 0 ? totalEvDelta / scenarioCount : 0;

  return {
    timestamp,
    totalScenarios: scenariosToRun.length,
    passed,
    failed,
    skipped,
    avgEvDelta,
    maxEvDelta,
    worstScenario,
    worstHand,
    totalTimeMs,
    results,
  };
}

// ========================================
// Report Formatting
// ========================================

/**
 * Formats a benchmark report for console output.
 *
 * @param report - Benchmark report to format
 * @param verbose - Include per-hand details
 * @returns Formatted string for console output
 */
export function formatBenchmarkReport(report: BenchmarkReport, verbose: boolean = false): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Benchmark Validation Report');
  lines.push('===========================');
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push(`Scenarios: ${report.totalScenarios} total, ${report.passed} passed, ${report.failed} failed${report.skipped > 0 ? `, ${report.skipped} skipped` : ''}`);
  lines.push('');
  lines.push('Results:');

  for (const result of report.results) {
    const status = result.passed ? '\u2713' : '\u2717';
    const deltaStr = (result.comparison.avgEvDelta * 100).toFixed(2);
    const timeStr = result.solverTimeMs.toFixed(1);

    if (result.error) {
      lines.push(`  ${status} ${result.scenarioName.padEnd(25)} (ERROR: ${result.error})`);
    } else {
      lines.push(`  ${status} ${result.scenarioName.padEnd(25)} (${deltaStr}% avg EV delta, ${timeStr}ms)`);
    }

    if (verbose && !result.passed && result.comparison.handResults.size > 0) {
      // Show worst 5 hands
      const sortedHands = [...result.comparison.handResults.entries()]
        .sort((a, b) => b[1].evDelta - a[1].evDelta)
        .slice(0, 5);

      for (const [hand, comparison] of sortedHands) {
        const delta = (comparison.evDelta * 100).toFixed(3);
        lines.push(`      ${hand}: ${delta}% delta (solver: ${comparison.solverEv.toFixed(3)}, ref: ${comparison.referenceEv.toFixed(3)})`);
      }
    }
  }

  lines.push('');
  lines.push('Summary:');
  lines.push(`  Max EV delta: ${(report.maxEvDelta * 100).toFixed(2)}% (${report.worstScenario}, hand: ${report.worstHand})`);
  lines.push(`  Avg EV delta: ${(report.avgEvDelta * 100).toFixed(3)}%`);
  lines.push(`  Total time: ${(report.totalTimeMs / 1000).toFixed(1)}s`);
  lines.push('');

  if (report.failed === 0 && report.passed > 0) {
    lines.push('All benchmarks passed! Solver within tolerance of PioSolver.');
  } else if (report.failed > 0) {
    lines.push(`FAILED: ${report.failed} scenario(s) exceeded tolerance.`);
  }

  lines.push('');

  return lines.join('\n');
}

// ========================================
// CLI Entry Point
// ========================================

/**
 * Run validation from command line.
 * Usage: npx ts-node src/lib/solver/benchmark/validation.ts
 */
if (typeof require !== 'undefined' && require.main === module) {
  runBenchmarkValidation({ verbose: true }).then(report => {
    console.log(formatBenchmarkReport(report, true));
    process.exit(report.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}
