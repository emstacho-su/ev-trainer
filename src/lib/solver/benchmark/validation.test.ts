// src/lib/solver/benchmark/validation.test.ts
// Tests for benchmark validation suite runner.

import { describe, it, expect } from 'vitest';
import {
  runBenchmarkValidation,
  formatBenchmarkReport,
  mockSolver,
  createTestSolver,
  DEFAULT_VALIDATION_CONFIG,
  type ValidationConfig,
  type BenchmarkReport,
} from './validation';
import { listReferenceScenarios } from './comparator';

describe('runBenchmarkValidation', () => {
  it('runs all scenarios with reference data', async () => {
    const report = await runBenchmarkValidation();

    expect(report.totalScenarios).toBeGreaterThan(0);
    expect(report.passed + report.failed + report.skipped).toBe(report.totalScenarios);
    expect(report.results.length).toBe(report.passed + report.failed);
  });

  it('passes when using mock solver (perfect match)', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);

    expect(report.passed).toBeGreaterThan(0);
    expect(report.failed).toBe(0);
    expect(report.avgEvDelta).toBeLessThan(0.001);
  });

  it('respects config.scenarios filter', async () => {
    const availableScenarios = listReferenceScenarios();
    const firstScenario = availableScenarios[0];

    const report = await runBenchmarkValidation(
      { scenarios: [firstScenario] },
      mockSolver
    );

    expect(report.totalScenarios).toBe(1);
    expect(report.results.length).toBe(1);
    expect(report.results[0].scenarioId).toBe(firstScenario);
  });

  it('filters out scenarios without reference data', async () => {
    const report = await runBenchmarkValidation(
      { scenarios: ['non-existent-scenario', 'preflop-rfi-btn'] },
      mockSolver
    );

    // Only preflop-rfi-btn should run (assuming it has reference data)
    expect(report.totalScenarios).toBe(1);
  });

  it('respects tolerance config', async () => {
    // Create solver with 0.0005 BB error
    const smallErrorSolver = createTestSolver(0.0005);

    // Strict tolerance (should fail)
    const strictReport = await runBenchmarkValidation(
      { tolerance: 0.0001 },
      smallErrorSolver
    );
    expect(strictReport.failed).toBeGreaterThan(0);

    // Loose tolerance (should pass)
    const looseReport = await runBenchmarkValidation(
      { tolerance: 0.001 },
      smallErrorSolver
    );
    expect(looseReport.passed).toBeGreaterThan(0);
  });

  it('stops on first failure when configured', async () => {
    const failingSolver = createTestSolver(0.1); // Large error

    const report = await runBenchmarkValidation(
      { stopOnFailure: true },
      failingSolver
    );

    // Should stop after first failure
    expect(report.failed).toBe(1);
    expect(report.results.length).toBe(1);
  });

  it('aggregates results correctly', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);

    // Verify aggregation
    const passedCount = report.results.filter(r => r.passed).length;
    const failedCount = report.results.filter(r => !r.passed).length;

    expect(passedCount).toBe(report.passed);
    expect(failedCount).toBe(report.failed);
  });

  it('tracks worst scenario and hand', async () => {
    const errorSolver = createTestSolver(0.005);

    const report = await runBenchmarkValidation({}, errorSolver);

    expect(report.worstScenario).toBeDefined();
    expect(report.worstHand).toBeDefined();
    expect(report.maxEvDelta).toBeGreaterThan(0);
  });

  it('calculates average EV delta', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);

    expect(report.avgEvDelta).toBeGreaterThanOrEqual(0);
    expect(report.avgEvDelta).toBeLessThan(0.01);
  });

  it('measures total execution time', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);

    expect(report.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(report.totalTimeMs).toBeLessThan(60000); // Should complete in under 60s
  });

  it('includes timestamp in report', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);

    expect(report.timestamp).toBeDefined();
    expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('handles solver errors gracefully', async () => {
    const errorSolver = async () => {
      throw new Error('Solver failed');
    };

    const report = await runBenchmarkValidation({}, errorSolver);

    expect(report.failed).toBeGreaterThan(0);
    const failedResult = report.results.find(r => !r.passed);
    expect(failedResult?.error).toContain('Solver failed');
  });
});

describe('ValidationConfig', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_VALIDATION_CONFIG.tolerance).toBe(0.001);
    expect(DEFAULT_VALIDATION_CONFIG.verbose).toBe(false);
    expect(DEFAULT_VALIDATION_CONFIG.stopOnFailure).toBe(false);
  });

  it('accepts partial config', async () => {
    const report = await runBenchmarkValidation({ verbose: true }, mockSolver);

    expect(report).toBeDefined();
  });
});

describe('formatBenchmarkReport', () => {
  it('produces readable output', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);
    const formatted = formatBenchmarkReport(report, false);

    expect(formatted).toContain('Benchmark Validation Report');
    expect(formatted).toContain('Scenarios:');
    expect(formatted).toContain('Results:');
    expect(formatted).toContain('Summary:');
  });

  it('includes pass/fail counts', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);
    const formatted = formatBenchmarkReport(report, false);

    expect(formatted).toMatch(/\d+ passed/);
  });

  it('shows verbose details when requested', async () => {
    const errorSolver = createTestSolver(0.01);
    const report = await runBenchmarkValidation({}, errorSolver);
    const formatted = formatBenchmarkReport(report, true);

    // Verbose mode should show hand-level details for failures
    if (report.failed > 0) {
      expect(formatted.length).toBeGreaterThan(100);
    }
  });

  it('indicates success when all pass', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);
    const formatted = formatBenchmarkReport(report, false);

    expect(formatted).toContain('All benchmarks passed');
  });

  it('indicates failure when any fail', async () => {
    const errorSolver = createTestSolver(0.1);
    const report = await runBenchmarkValidation({}, errorSolver);
    const formatted = formatBenchmarkReport(report, false);

    expect(formatted).toContain('FAILED');
  });

  it('shows max and avg EV delta', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);
    const formatted = formatBenchmarkReport(report, false);

    expect(formatted).toContain('Max EV delta:');
    expect(formatted).toContain('Avg EV delta:');
  });

  it('shows worst scenario and hand', async () => {
    const errorSolver = createTestSolver(0.005);
    const report = await runBenchmarkValidation({}, errorSolver);
    const formatted = formatBenchmarkReport(report, false);

    expect(formatted).toContain(report.worstScenario);
    expect(formatted).toContain(report.worstHand);
  });

  it('shows execution time', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);
    const formatted = formatBenchmarkReport(report, false);

    expect(formatted).toContain('Total time:');
    expect(formatted).toMatch(/\d+\.\d+s/);
  });
});

describe('Mock Solver', () => {
  it('returns perfect match with reference', async () => {
    const availableScenarios = listReferenceScenarios();
    const scenario = { id: availableScenarios[0] } as any;

    const result = await mockSolver(scenario);

    expect(result.solution.strategies.size).toBeGreaterThan(0);
    expect(result.solution.evs.size).toBeGreaterThan(0);
    expect(result.timeMs).toBeGreaterThan(0);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.exploitability).toBeGreaterThan(0);
  });

  it('handles missing reference gracefully', async () => {
    const scenario = { id: 'non-existent-scenario' } as any;

    const result = await mockSolver(scenario);

    expect(result.solution.strategies.size).toBe(0);
    expect(result.solution.evs.size).toBe(0);
  });
});

describe('Test Solver', () => {
  it('introduces controlled error', async () => {
    const delta = 0.01;
    const testSolver = createTestSolver(delta);

    const availableScenarios = listReferenceScenarios();
    const scenario = { id: availableScenarios[0] } as any;

    const result = await testSolver(scenario);

    // EVs should be offset by delta
    expect(result.solution.evs.size).toBeGreaterThan(0);

    // Load reference to verify offset
    const { loadPioReference } = await import('./comparator');
    const ref = loadPioReference(scenario.id);

    for (const [hand, ev] of result.solution.evs) {
      const refEv = ref.evs.get(hand);
      if (refEv !== undefined) {
        expect(Math.abs(ev - refEv - delta)).toBeLessThan(0.0001);
      }
    }
  });

  it('reflects error in exploitability', async () => {
    const delta = 0.005;
    const testSolver = createTestSolver(delta);

    const availableScenarios = listReferenceScenarios();
    const scenario = { id: availableScenarios[0] } as any;

    const result = await testSolver(scenario);

    expect(result.exploitability).toBeCloseTo(delta * 1000, 1);
  });
});

describe('Integration', () => {
  it('end-to-end validation run completes', async () => {
    const report = await runBenchmarkValidation({}, mockSolver);

    expect(report.totalScenarios).toBeGreaterThan(0);
    expect(report.passed).toBeGreaterThan(0);
    expect(report.results.length).toBeGreaterThan(0);

    const formatted = formatBenchmarkReport(report, false);
    expect(formatted.length).toBeGreaterThan(50);
  });

  it('validates all available reference scenarios', async () => {
    const availableRefs = listReferenceScenarios();
    const report = await runBenchmarkValidation({}, mockSolver);

    // Should run at least the scenarios with reference data
    expect(report.totalScenarios).toBe(availableRefs.length);
  });
});
