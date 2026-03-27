/**
 * Benchmark Test Runner
 *
 * Executes all benchmark scenarios against the 5 target agents,
 * measures latency/completeness/consistency, runs quality checks,
 * and generates both JSON and Markdown reports.
 *
 * Run: npx vitest run tests/benchmarks/benchmark.test.ts
 */

import { describe, it, expect } from 'vitest';
import path from 'path';

// Agent servers
import { server as catalogServer } from '../../agents/dw-context-catalog/src/index.js';
import { server as pipelinesServer } from '../../agents/dw-pipelines/src/index.js';
import { server as qualityServer } from '../../agents/dw-quality/src/index.js';
import { server as governanceServer } from '../../agents/dw-governance/src/index.js';
import { server as incidentsServer } from '../../agents/dw-incidents/src/index.js';

// Benchmark framework
import { runBenchmarks, type ServerMap } from './framework.js';
import { computeOverallMetrics } from './metrics.js';
import { writeJsonReport, writeMarkdownReport } from './report.js';
import { allScenarios } from './scenarios/index.js';

// ---------------------------------------------------------------------------
// Server map
// ---------------------------------------------------------------------------

const servers: ServerMap = {
  'dw-context-catalog': catalogServer as any,
  'dw-pipelines': pipelinesServer as any,
  'dw-quality': qualityServer as any,
  'dw-governance': governanceServer as any,
  'dw-incidents': incidentsServer as any,
};

// ---------------------------------------------------------------------------
// Output paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');
const DOCS = path.join(ROOT, 'docs');
const EVAL_RESULTS = path.join(DOCS, 'eval-results');
const BENCHMARK_REPORT = path.join(DOCS, 'BENCHMARK_REPORT.md');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Agent Benchmarks', () => {
  it('runs all benchmark scenarios and generates reports', async () => {
    // Run benchmarks with 3 repetitions per scenario
    const results = await runBenchmarks(allScenarios, servers, {
      runs: 3,
      timeoutMs: 30_000,
    });

    // Basic sanity: we got a result for every scenario
    expect(results.length).toBe(allScenarios.length);

    // Compute aggregated metrics
    const metrics = computeOverallMetrics(results);

    // Write reports
    const jsonPath = writeJsonReport(metrics, EVAL_RESULTS);
    const mdPath = writeMarkdownReport(metrics, BENCHMARK_REPORT);

    // Log summary to console
    console.log('\n========================================');
    console.log('  BENCHMARK SUMMARY');
    console.log('========================================');
    console.log(`  Scenarios:    ${metrics.totalScenarios}`);
    console.log(`  Passed:       ${metrics.passed}/${metrics.totalScenarios} (${(metrics.passRate * 100).toFixed(1)}%)`);
    console.log(`  Avg Latency:  ${metrics.avgLatencyMs.toFixed(1)}ms`);
    console.log(`  Completeness: ${(metrics.avgCompleteness * 100).toFixed(1)}%`);
    console.log(`  Consistency:  ${(metrics.avgConsistency * 100).toFixed(1)}%`);
    console.log('');

    for (const agent of metrics.byAgent) {
      const grade = getGrade(agent.passRate, agent.avgCompleteness, agent.qualityPassRate);
      console.log(`  ${agent.agent}: ${agent.passed}/${agent.totalScenarios} pass, ${agent.avgLatencyMs.toFixed(1)}ms avg, grade ${grade}`);
    }

    console.log('');
    console.log(`  JSON report:     ${jsonPath}`);
    console.log(`  Markdown report: ${mdPath}`);
    console.log('========================================\n');

    // Assertions: overall pass rate should be reasonable for InMemory stubs
    expect(metrics.passRate).toBeGreaterThanOrEqual(0.5);
    expect(metrics.avgCompleteness).toBeGreaterThanOrEqual(0.3);
    expect(metrics.avgConsistency).toBeGreaterThanOrEqual(0.5);
  }, 120_000); // 2 minute timeout for the full suite
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGrade(passRate: number, completeness: number, qualityRate: number): string {
  const composite = passRate * 0.5 + completeness * 0.3 + qualityRate * 0.2;
  if (composite >= 0.9) return 'A';
  if (composite >= 0.8) return 'B';
  if (composite >= 0.7) return 'C';
  if (composite >= 0.6) return 'D';
  return 'F';
}
