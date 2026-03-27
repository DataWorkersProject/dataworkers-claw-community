/**
 * Benchmark Framework — Report Generation
 *
 * Produces both JSON and Markdown reports from benchmark metrics.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import type { OverallMetrics, BenchmarkResult } from './types.js';

// ---------------------------------------------------------------------------
// JSON report
// ---------------------------------------------------------------------------

export function writeJsonReport(metrics: OverallMetrics, outputDir: string): string {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const filePath = path.join(outputDir, `benchmark-${dateStr}.json`);
  writeFileSync(filePath, JSON.stringify(metrics, null, 2), 'utf-8');
  return filePath;
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

export function generateMarkdownReport(metrics: OverallMetrics): string {
  const lines: string[] = [];

  lines.push('# Benchmark Report -- ');
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Scenarios:** ${metrics.totalScenarios}`);
  lines.push(`**Pass rate:** ${pct(metrics.passRate)}`);
  lines.push(`**Avg latency:** ${metrics.avgLatencyMs.toFixed(1)}ms`);
  lines.push(`**Avg completeness:** ${pct(metrics.avgCompleteness)}`);
  lines.push(`**Avg consistency:** ${pct(metrics.avgConsistency)}`);
  lines.push('');

  // Summary table
  lines.push('## Agent Summary');
  lines.push('');
  lines.push('| Agent | Scenarios | Pass Rate | Avg Latency | Completeness | Consistency | Quality | Grade |');
  lines.push('|-------|----------:|----------:|------------:|-------------:|------------:|--------:|-------|');

  for (const agent of metrics.byAgent) {
    const grade = getGrade(agent.passRate, agent.avgCompleteness, agent.qualityPassRate);
    lines.push(
      `| ${agent.agent} | ${agent.totalScenarios} | ${pct(agent.passRate)} | ${agent.avgLatencyMs.toFixed(1)}ms | ${pct(agent.avgCompleteness)} | ${pct(agent.avgConsistency)} | ${pct(agent.qualityPassRate)} | ${grade} |`,
    );
  }

  lines.push('');

  // Category breakdown
  lines.push('## By Category');
  lines.push('');
  lines.push('| Category | Scenarios | Pass Rate | Avg Latency | Completeness |');
  lines.push('|----------|----------:|----------:|------------:|-------------:|');

  for (const cat of metrics.byCategory) {
    lines.push(
      `| ${cat.category} | ${cat.totalScenarios} | ${pct(cat.passRate)} | ${cat.avgLatencyMs.toFixed(1)}ms | ${pct(cat.avgCompleteness)} |`,
    );
  }

  lines.push('');

  // Difficulty breakdown
  lines.push('## By Difficulty');
  lines.push('');
  lines.push('| Difficulty | Scenarios | Pass Rate |');
  lines.push('|------------|----------:|----------:|');

  for (const [diff, data] of Object.entries(metrics.byDifficulty)) {
    lines.push(`| ${diff} | ${data.total} | ${pct(data.passRate)} |`);
  }

  lines.push('');

  // Detailed results
  lines.push('## Detailed Results');
  lines.push('');

  const byAgent = groupResultsByAgent(metrics.results);

  for (const [agent, results] of Object.entries(byAgent)) {
    const passCount = results.filter((r) => r.success).length;
    lines.push(`### ${agent} (${passCount}/${results.length} passed)`);
    lines.push('');
    lines.push('| Scenario | Tool | Latency | Complete | Consistent | Quality | Status |');
    lines.push('|----------|------|--------:|---------:|-----------:|--------:|--------|');

    for (const r of results) {
      const status = r.success ? 'PASS' : 'FAIL';
      const qualityStr = r.qualityChecks.length > 0 ? pct(r.qualityChecks.filter((c) => c.passed).length / r.qualityChecks.length) : 'n/a';

      lines.push(
        `| ${r.scenario} | ${r.tool} | ${r.latencyMs.toFixed(1)}ms | ${pct(r.completeness)} | ${pct(r.consistency)} | ${qualityStr} | ${status}${r.error ? ` -- ${truncate(r.error, 60)}` : ''} |`,
      );
    }

    lines.push('');
  }

  // Failed scenarios section
  const failed = metrics.results.filter((r) => !r.success);
  if (failed.length > 0) {
    lines.push('## Failed Scenarios');
    lines.push('');

    for (const r of failed) {
      lines.push(`- **${r.scenario}** (${r.agent}/${r.tool}): ${r.error ?? 'unknown error'}`);
    }

    lines.push('');
  }

  // Quality check failures
  const qualityFailures = metrics.results
    .filter((r) => r.qualityChecks.some((c) => !c.passed))
    .flatMap((r) =>
      r.qualityChecks
        .filter((c) => !c.passed)
        .map((c) => ({ scenario: r.scenario, agent: r.agent, check: c.name, message: c.message })),
    );

  if (qualityFailures.length > 0) {
    lines.push('## Quality Check Failures');
    lines.push('');

    for (const f of qualityFailures) {
      lines.push(`- **${f.scenario}** (${f.agent}): ${f.check} -- ${f.message}`);
    }

    lines.push('');
  }

  lines.push('---');
  lines.push(`Generated by benchmark framework on ${new Date().toISOString()}`);
  lines.push('');

  return lines.join('\n');
}

export function writeMarkdownReport(metrics: OverallMetrics, outputPath: string): string {
  const dir = path.dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const md = generateMarkdownReport(metrics);
  writeFileSync(outputPath, md, 'utf-8');
  return outputPath;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getGrade(passRate: number, completeness: number, qualityRate: number): string {
  const composite = passRate * 0.5 + completeness * 0.3 + qualityRate * 0.2;
  if (composite >= 0.9) return 'A';
  if (composite >= 0.8) return 'B';
  if (composite >= 0.7) return 'C';
  if (composite >= 0.6) return 'D';
  return 'F';
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function groupResultsByAgent(results: BenchmarkResult[]): Record<string, BenchmarkResult[]> {
  const groups: Record<string, BenchmarkResult[]> = {};
  for (const r of results) {
    if (!groups[r.agent]) groups[r.agent] = [];
    groups[r.agent].push(r);
  }
  return groups;
}
