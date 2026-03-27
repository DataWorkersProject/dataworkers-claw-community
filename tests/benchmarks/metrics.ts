/**
 * Benchmark Framework — Metric Collection & Aggregation
 *
 * Computes per-agent, per-category, and overall metrics from raw benchmark results.
 */

import type {
  BenchmarkResult,
  AgentMetrics,
  CategoryMetrics,
  OverallMetrics,
} from './types.js';

// ---------------------------------------------------------------------------
// Per-agent aggregation
// ---------------------------------------------------------------------------

export function computeAgentMetrics(results: BenchmarkResult[]): AgentMetrics[] {
  const byAgent = groupBy(results, (r) => r.agent);
  const metrics: AgentMetrics[] = [];

  for (const [agent, agentResults] of Object.entries(byAgent)) {
    const total = agentResults.length;
    const passed = agentResults.filter((r) => r.success).length;

    const allQualityChecks = agentResults.flatMap((r) => r.qualityChecks);
    const qualityPassed = allQualityChecks.filter((c) => c.passed).length;
    const qualityTotal = allQualityChecks.length;

    metrics.push({
      agent,
      totalScenarios: total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? round(passed / total, 3) : 0,
      avgLatencyMs: round(avg(agentResults.map((r) => r.latencyMs)), 2),
      avgCompleteness: round(avg(agentResults.map((r) => r.completeness)), 3),
      avgConsistency: round(avg(agentResults.map((r) => r.consistency)), 3),
      avgResponseSize: round(avg(agentResults.map((r) => r.responseSize)), 0),
      qualityPassRate: qualityTotal > 0 ? round(qualityPassed / qualityTotal, 3) : 1,
    });
  }

  return metrics.sort((a, b) => a.agent.localeCompare(b.agent));
}

// ---------------------------------------------------------------------------
// Per-category aggregation
// ---------------------------------------------------------------------------

export function computeCategoryMetrics(results: BenchmarkResult[]): CategoryMetrics[] {
  const byCat = groupBy(results, (r) => r.category);
  const metrics: CategoryMetrics[] = [];

  for (const [category, catResults] of Object.entries(byCat)) {
    const total = catResults.length;
    const passed = catResults.filter((r) => r.success).length;

    metrics.push({
      category,
      totalScenarios: total,
      passed,
      passRate: total > 0 ? round(passed / total, 3) : 0,
      avgLatencyMs: round(avg(catResults.map((r) => r.latencyMs)), 2),
      avgCompleteness: round(avg(catResults.map((r) => r.completeness)), 3),
    });
  }

  return metrics.sort((a, b) => a.category.localeCompare(b.category));
}

// ---------------------------------------------------------------------------
// By-difficulty aggregation
// ---------------------------------------------------------------------------

export function computeDifficultyMetrics(
  results: BenchmarkResult[],
): Record<string, { total: number; passed: number; passRate: number }> {
  const byDiff = groupBy(results, (r) => r.difficulty);
  const out: Record<string, { total: number; passed: number; passRate: number }> = {};

  for (const [difficulty, diffResults] of Object.entries(byDiff)) {
    const total = diffResults.length;
    const passed = diffResults.filter((r) => r.success).length;
    out[difficulty] = { total, passed, passRate: total > 0 ? round(passed / total, 3) : 0 };
  }

  return out;
}

// ---------------------------------------------------------------------------
// Overall metrics
// ---------------------------------------------------------------------------

export function computeOverallMetrics(results: BenchmarkResult[]): OverallMetrics {
  const total = results.length;
  const passed = results.filter((r) => r.success).length;

  return {
    timestamp: new Date().toISOString(),
    totalScenarios: total,
    passed,
    failed: total - passed,
    passRate: total > 0 ? round(passed / total, 3) : 0,
    avgLatencyMs: round(avg(results.map((r) => r.latencyMs)), 2),
    avgCompleteness: round(avg(results.map((r) => r.completeness)), 3),
    avgConsistency: round(avg(results.map((r) => r.consistency)), 3),
    byAgent: computeAgentMetrics(results),
    byCategory: computeCategoryMetrics(results),
    byDifficulty: computeDifficultyMetrics(results),
    results,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
