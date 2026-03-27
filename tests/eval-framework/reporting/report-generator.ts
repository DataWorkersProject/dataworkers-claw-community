/**
 * Eval Framework — Report Generator
 *
 * Produces structured JSON and Markdown evaluation reports from agent and
 * swarm results. Follows the existing benchmark report pattern from
 * tests/benchmarks/report.ts.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import type {
  AgentEvalResult,
  SwarmEvalResult,
  DimensionName,
  LetterGrade,
} from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvalReportData {
  generatedAt: string;
  compositeScore: number;
  compositeGrade: LetterGrade;
  dimensionAverages: Record<DimensionName, number>;
  agentResults: AgentEvalResult[];
  swarmResults: SwarmEvalResult[];
  topIssues: string[];
  topStrengths: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(value: number): string {
  return `${value.toFixed(1)}`;
}

function grade(score: number): LetterGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function findDimensionScore(result: AgentEvalResult, dim: DimensionName): number {
  const d = result.dimensions.find((ds) => ds.dimension === dim);
  return d ? d.score : 0;
}

function identifyIssues(agents: AgentEvalResult[], swarms: SwarmEvalResult[]): string[] {
  const issues: Array<{ text: string; severity: number }> = [];

  // Low-scoring agents
  for (const a of agents) {
    if (a.compositeScore < 60) {
      issues.push({
        text: `${a.agent} has a low composite score of ${pct(a.compositeScore)} (${a.compositeGrade})`,
        severity: 60 - a.compositeScore,
      });
    }
    for (const dim of a.dimensions) {
      if (dim.score < 50) {
        issues.push({
          text: `${a.agent} scores only ${pct(dim.score)} on ${dim.dimension}`,
          severity: 50 - dim.score,
        });
      }
    }
  }

  // Failed swarm handoffs
  for (const s of swarms) {
    if (!s.handoffSuccess) {
      issues.push({
        text: `Swarm scenario "${s.scenario}" failed handoff between: ${s.agentsInvolved.join(', ')}`,
        severity: 30,
      });
    }
    if (s.e2eLatencyMs > 10000) {
      issues.push({
        text: `Swarm scenario "${s.scenario}" is slow (${s.e2eLatencyMs}ms)`,
        severity: 10,
      });
    }
  }

  issues.sort((a, b) => b.severity - a.severity);
  return issues.slice(0, 5).map((i) => i.text);
}

function identifyStrengths(agents: AgentEvalResult[], swarms: SwarmEvalResult[]): string[] {
  const strengths: Array<{ text: string; score: number }> = [];

  for (const a of agents) {
    if (a.compositeScore >= 85) {
      strengths.push({
        text: `${a.agent} excels with a composite score of ${pct(a.compositeScore)} (${a.compositeGrade})`,
        score: a.compositeScore,
      });
    }
    for (const dim of a.dimensions) {
      if (dim.score >= 90) {
        strengths.push({
          text: `${a.agent} scores ${pct(dim.score)} on ${dim.dimension}`,
          score: dim.score,
        });
      }
    }
  }

  for (const s of swarms) {
    if (s.handoffSuccess && s.e2eLatencyMs < 3000) {
      strengths.push({
        text: `Swarm "${s.scenario}" completes with clean handoffs in ${s.e2eLatencyMs}ms`,
        score: 85,
      });
    }
  }

  strengths.sort((a, b) => b.score - a.score);
  return strengths.slice(0, 5).map((s) => s.text);
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function generateMarkdown(data: EvalReportData): string {
  const lines: string[] = [];

  lines.push('# Data Workers Evaluation Report');
  lines.push('');
  lines.push(`**Generated:** ${data.generatedAt}`);
  lines.push('');

  // Executive summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| **Composite Score** | **${pct(data.compositeScore)} / 100** |`);
  lines.push(`| **Grade** | **${data.compositeGrade}** |`);
  lines.push(`| Agents Evaluated | ${data.agentResults.length} |`);
  lines.push(`| Swarm Scenarios | ${data.swarmResults.length} |`);
  lines.push('');

  // Dimension averages
  lines.push('### Dimension Averages');
  lines.push('');
  lines.push('| Dimension | Score | Grade |');
  lines.push('|-----------|------:|-------|');
  for (const [dim, score] of Object.entries(data.dimensionAverages)) {
    lines.push(`| ${dim} | ${pct(score)} | ${grade(score)} |`);
  }
  lines.push('');

  // Per-agent detail table
  lines.push('## Per-Agent Results');
  lines.push('');
  lines.push('| Agent | AI Evals | Prod Quality | Productivity | User Value | Composite | Grade |');
  lines.push('|-------|----------:|-------------:|-------------:|-----------:|----------:|-------|');
  for (const a of data.agentResults) {
    const ai = pct(findDimensionScore(a, 'ai-evals'));
    const pq = pct(findDimensionScore(a, 'product-quality'));
    const pr = pct(findDimensionScore(a, 'productivity'));
    const uv = pct(findDimensionScore(a, 'user-value'));
    lines.push(`| ${a.agent} | ${ai} | ${pq} | ${pr} | ${uv} | ${pct(a.compositeScore)} | ${a.compositeGrade} |`);
  }
  lines.push('');

  // Swarm results
  if (data.swarmResults.length > 0) {
    lines.push('## Swarm Scenario Results');
    lines.push('');
    lines.push('| Scenario | Agents | Handoff | Latency | Tools |');
    lines.push('|----------|--------|---------|--------:|-------|');
    for (const s of data.swarmResults) {
      const handoff = s.handoffSuccess ? 'PASS' : 'FAIL';
      lines.push(
        `| ${s.scenario} | ${s.agentsInvolved.join(', ')} | ${handoff} | ${s.e2eLatencyMs}ms | ${s.toolChain.join(' -> ')} |`,
      );
    }
    lines.push('');
  }

  // Top issues
  if (data.topIssues.length > 0) {
    lines.push('## Top Issues to Fix');
    lines.push('');
    for (let i = 0; i < data.topIssues.length; i++) {
      lines.push(`${i + 1}. ${data.topIssues[i]}`);
    }
    lines.push('');
  }

  // Top strengths
  if (data.topStrengths.length > 0) {
    lines.push('## Top Strengths');
    lines.push('');
    for (let i = 0; i < data.topStrengths.length; i++) {
      lines.push(`${i + 1}. ${data.topStrengths[i]}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('Generated by eval-framework report-generator');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate evaluation reports in both Markdown and JSON formats.
 *
 * Outputs:
 *   - docs/EVAL_REPORT.md — human-readable Markdown report
 *   - docs/eval-results/eval-report-YYYY-MM-DD.json — structured data
 *
 * @param results - Per-agent evaluation results
 * @param swarmResults - Multi-agent swarm scenario results
 * @param outputDir - Base output directory (defaults to project root docs/)
 * @returns Paths to generated files
 */
export function generateEvalReport(
  results: AgentEvalResult[],
  swarmResults: SwarmEvalResult[],
  outputDir?: string,
): { markdownPath: string; jsonPath: string } {
  const baseDir = outputDir ?? path.resolve(__dirname, '../../../docs');
  const resultsDir = path.join(baseDir, 'eval-results');

  // Ensure directories exist
  for (const dir of [baseDir, resultsDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Compute dimension averages
  const dimensions: DimensionName[] = ['ai-evals', 'product-quality', 'productivity', 'user-value'];
  const dimensionAverages: Record<DimensionName, number> = {} as Record<DimensionName, number>;
  for (const dim of dimensions) {
    const scores = results.map((r) => findDimensionScore(r, dim));
    dimensionAverages[dim] = avg(scores);
  }

  const compositeScore = avg(results.map((r) => r.compositeScore));
  const compositeGrade = grade(compositeScore);

  const topIssues = identifyIssues(results, swarmResults);
  const topStrengths = identifyStrengths(results, swarmResults);

  const data: EvalReportData = {
    generatedAt: new Date().toISOString(),
    compositeScore,
    compositeGrade,
    dimensionAverages,
    agentResults: results,
    swarmResults,
    topIssues,
    topStrengths,
  };

  // Write Markdown report
  const markdownPath = path.join(baseDir, 'EVAL_REPORT.md');
  writeFileSync(markdownPath, generateMarkdown(data), 'utf-8');

  // Write JSON report
  const dateStr = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(resultsDir, `eval-report-${dateStr}.json`);
  writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

  return { markdownPath, jsonPath };
}
