/**
 * Persona-based AI Eval Benchmark — Report Generator
 *
 * Aggregates PersonaResult[] into a PersonaReport and writes:
 *   - docs/eval-results/persona-benchmark-YYYY-MM-DD.json
 *   - docs/PERSONA_BENCHMARK_REPORT.md
 *
 * Iteration 3 additions:
 *   - Coverage map (which agents/tools are tested by which personas)
 *   - Latency compliance summary
 *   - Multi-step handoff success rate
 *   - Latency column in detailed results
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Persona, PersonaResult, PersonaReport, SeedDataset } from './types.js';
import { jaccardSimilarity, getDifficultyWeight } from './scoring.js';

// ─── Root resolution ────────────────────────────────────────────────────────

/** Resolve path relative to the repo root (3 levels up from this file). */
function repoRoot(...segments: string[]): string {
  return resolve(__dirname, '..', '..', '..', ...segments);
}

// ─── Report generation ──────────────────────────────────────────────────────

/**
 * Build the full PersonaReport from an array of results.
 */
export function buildPersonaReport(results: PersonaResult[]): PersonaReport {
  const timestamp = new Date().toISOString();

  // ── By Persona ──────────────────────────────────────────────────────────
  const personas: Persona[] = [
    'data_engineer', 'analytics_engineer', 'data_platform_lead',
    'data_scientist', 'ml_engineer', 'openclaw_user',
    'governance_officer', 'data_practitioner',
  ];

  const byPersona = {} as PersonaReport['byPersona'];
  for (const p of personas) {
    const subset = results.filter((r) => r.scenario.persona === p);
    const avg = subset.length > 0
      ? subset.reduce((s, r) => s + r.scores.composite, 0) / subset.length
      : 0;
    byPersona[p] = { count: subset.length, avgComposite: round(avg), results: subset };
  }

  // ── By Seed ─────────────────────────────────────────────────────────────
  const seeds: SeedDataset[] = ['jaffle-shop', 'openmetadata'];
  const bySeed = {} as PersonaReport['bySeed'];
  for (const s of seeds) {
    const subset = results.filter((r) => r.seed === s);
    const avg = subset.length > 0
      ? subset.reduce((sum, r) => sum + r.scores.composite, 0) / subset.length
      : 0;
    bySeed[s] = { count: subset.length, avgComposite: round(avg) };
  }

  // ── By Agent ────────────────────────────────────────────────────────────
  const agentMap = new Map<string, { composites: number[]; routingHits: number }>();
  for (const r of results) {
    for (const route of r.scenario.routes) {
      const entry = agentMap.get(route.agent) ?? { composites: [], routingHits: 0 };
      entry.composites.push(r.scores.composite);
      if (r.scores.routingAccuracy === 1) entry.routingHits++;
      agentMap.set(route.agent, entry);
    }
  }
  const byAgent: PersonaReport['byAgent'] = {};
  for (const [agent, data] of agentMap.entries()) {
    const avg = data.composites.reduce((s, v) => s + v, 0) / data.composites.length;
    byAgent[agent] = {
      count: data.composites.length,
      avgComposite: round(avg),
      routingHitRate: round(data.routingHits / data.composites.length),
    };
  }

  // ── Multi-seed consistency ──────────────────────────────────────────────
  // Scenarios that run on multiple seeds: compare response TEXT via Jaccard
  const scenarioSeeds = new Map<string, PersonaResult[]>();
  for (const r of results) {
    const list = scenarioSeeds.get(r.scenario.name) ?? [];
    list.push(r);
    scenarioSeeds.set(r.scenario.name, list);
  }

  let hardcodedCount = 0;
  let seedSensitiveCount = 0;
  const jaccardSimilarities: Array<{ scenario: string; similarity: number }> = [];

  for (const [name, group] of scenarioSeeds.entries()) {
    if (group.length < 2) continue;

    // Compare actual response text via Jaccard similarity, not just score diffs
    const responseTexts = group.map((r) => {
      try { return JSON.stringify(r.response); } catch { return String(r.response); }
    });

    const similarity = jaccardSimilarity(responseTexts[0], responseTexts[1]);
    jaccardSimilarities.push({ scenario: name, similarity: round(similarity) });

    // Jaccard > 0.95 means responses are effectively identical (likely hardcoded)
    if (similarity > 0.95) {
      hardcodedCount++;
    } else {
      seedSensitiveCount++;
    }
  }

  // ── By Difficulty ─────────────────────────────────────────────────────
  const difficultyLevels = ['basic', 'intermediate', 'advanced'];
  const byDifficulty: PersonaReport['byDifficulty'] = {};
  for (const d of difficultyLevels) {
    const subset = results.filter((r) => r.scenario.difficulty === d);
    const avg = subset.length > 0
      ? subset.reduce((s, r) => s + r.scores.composite, 0) / subset.length
      : 0;
    const weight = getDifficultyWeight(d);
    byDifficulty[d] = {
      count: subset.length,
      avgComposite: round(avg),
      weightedComposite: round(avg * weight),
    };
  }

  // ── Negative test summary ──────────────────────────────────────────
  const negativeTests = results.filter((r) => r.scenario.isNegativeTest);
  const gracefulCount = negativeTests.filter((r) => r.scores.negativeHandling >= 0.5).length;
  const negativeTestSummary = {
    totalNegativeTests: negativeTests.length,
    gracefulHandlingRate: negativeTests.length > 0 ? round(gracefulCount / negativeTests.length) : 1,
  };

  // ── Multi-step summary ─────────────────────────────────────────────
  const multiStepResults = results.filter((r) => r.scenario.isMultiStep);
  // Compute handoff success rate from multi-step scenarios with dynamic chaining
  const multiStepWithChaining = multiStepResults.filter((r) =>
    r.scenario.multiSteps && r.scenario.multiSteps.length > 0
  );
  let totalHandoffs = 0;
  let successHandoffs = 0;
  for (const r of multiStepWithChaining) {
    // Count dynamic inputs across all steps
    for (const step of r.scenario.multiSteps!) {
      if (step.dynamicInputs) {
        totalHandoffs += Object.keys(step.dynamicInputs).length;
        // Check if response contains _handoffSuccess
        const resp = r.response as Record<string, unknown> | null;
        if (resp && typeof resp === 'object' && '_handoffSuccess' in resp) {
          // This is a merged response
          const rate = resp._handoffSuccess as number;
          successHandoffs += Math.round(rate * Object.keys(step.dynamicInputs).length);
        }
      }
    }
  }

  const multiStepSummary = {
    totalMultiStep: multiStepResults.length,
    avgComposite: multiStepResults.length > 0
      ? round(multiStepResults.reduce((s, r) => s + r.scores.composite, 0) / multiStepResults.length)
      : 0,
    handoffSuccessRate: totalHandoffs > 0 ? round(successHandoffs / totalHandoffs) : 1,
  };

  // ── Latency compliance ─────────────────────────────────────────────
  const withBudget = results.filter((r) => r.scenario.maxLatencyMs !== undefined);
  const compliantCount = withBudget.filter((r) => r.scores.latencyCompliance >= 1.0).length;
  const latencyCompliance = {
    totalWithBudget: withBudget.length,
    compliantCount,
    complianceRate: withBudget.length > 0 ? round(compliantCount / withBudget.length) : 1,
  };

  // ── Coverage map ───────────────────────────────────────────────────
  const coverageByAgent: Record<string, Set<string>> = {};
  const coverageByTool: Record<string, Set<string>> = {};

  for (const r of results) {
    const persona = r.scenario.persona;

    // Cover routes
    for (const route of r.scenario.routes) {
      if (!coverageByAgent[route.agent]) coverageByAgent[route.agent] = new Set();
      coverageByAgent[route.agent].add(persona);

      if (!coverageByTool[route.tool]) coverageByTool[route.tool] = new Set();
      coverageByTool[route.tool].add(persona);
    }

    // Cover multi-step routes
    if (r.scenario.multiSteps) {
      for (const step of r.scenario.multiSteps) {
        if (!coverageByAgent[step.agent]) coverageByAgent[step.agent] = new Set();
        coverageByAgent[step.agent].add(persona);

        if (!coverageByTool[step.tool]) coverageByTool[step.tool] = new Set();
        coverageByTool[step.tool].add(persona);
      }
    }

    // Cover legacy steps
    if (r.scenario.steps) {
      for (const step of r.scenario.steps) {
        if (!coverageByAgent[step.agent]) coverageByAgent[step.agent] = new Set();
        coverageByAgent[step.agent].add(persona);

        if (!coverageByTool[step.tool]) coverageByTool[step.tool] = new Set();
        coverageByTool[step.tool].add(persona);
      }
    }
  }

  const coverageMap = {
    byAgent: Object.fromEntries(
      Object.entries(coverageByAgent).map(([k, v]) => [k, [...v].sort()])
    ),
    byTool: Object.fromEntries(
      Object.entries(coverageByTool).map(([k, v]) => [k, [...v].sort()])
    ),
  };

  // ── Overall ─────────────────────────────────────────────────────────────
  const overallComposite = results.length > 0
    ? results.reduce((s, r) => s + r.scores.composite, 0) / results.length
    : 0;

  return {
    timestamp,
    totalScenarios: results.length,
    overallComposite: round(overallComposite),
    byPersona,
    bySeed,
    byAgent,
    byDifficulty,
    multiSeedConsistency: { hardcodedCount, seedSensitiveCount, jaccardSimilarities },
    negativeTestSummary,
    multiStepSummary,
    latencyCompliance,
    coverageMap,
  };
}

// ─── File writers ───────────────────────────────────────────────────────────

/**
 * Write the JSON report to docs/eval-results/.
 */
function writeJsonReport(report: PersonaReport): string {
  const date = report.timestamp.slice(0, 10);
  const outDir = repoRoot('docs', 'eval-results');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `persona-benchmark-${date}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  return outPath;
}

/**
 * Write the Markdown report to docs/PERSONA_BENCHMARK_REPORT.md.
 */
function writeMarkdownReport(report: PersonaReport): string {
  const lines: string[] = [];

  lines.push('# Persona Benchmark Report');
  lines.push('');
  lines.push(`**Generated:** ${report.timestamp}`);
  lines.push(`**Total scenarios evaluated:** ${report.totalScenarios}`);
  lines.push(`**Overall composite score:** ${(report.overallComposite * 100).toFixed(1)}%`);
  lines.push('');

  // ── Per-Persona table ───────────────────────────────────────────────────
  lines.push('## Results by Persona');
  lines.push('');
  lines.push('| Persona | Scenarios | Avg Composite |');
  lines.push('|---------|-----------|---------------|');
  for (const [persona, data] of Object.entries(report.byPersona)) {
    lines.push(`| ${persona} | ${data.count} | ${(data.avgComposite * 100).toFixed(1)}% |`);
  }
  lines.push('');

  // ── Per-Seed table ──────────────────────────────────────────────────────
  lines.push('## Results by Seed Dataset');
  lines.push('');
  lines.push('| Seed | Scenarios | Avg Composite |');
  lines.push('|------|-----------|---------------|');
  for (const [seed, data] of Object.entries(report.bySeed)) {
    lines.push(`| ${seed} | ${data.count} | ${(data.avgComposite * 100).toFixed(1)}% |`);
  }
  lines.push('');

  // ── Per-Agent table ─────────────────────────────────────────────────────
  lines.push('## Results by Agent');
  lines.push('');
  lines.push('| Agent | Scenarios | Avg Composite | Routing Hit Rate |');
  lines.push('|-------|-----------|---------------|------------------|');
  for (const [agent, data] of Object.entries(report.byAgent)) {
    lines.push(`| ${agent} | ${data.count} | ${(data.avgComposite * 100).toFixed(1)}% | ${(data.routingHitRate * 100).toFixed(0)}% |`);
  }
  lines.push('');

  // ── By Difficulty table ─────────────────────────────────────────────────
  lines.push('## Results by Difficulty');
  lines.push('');
  lines.push('| Difficulty | Scenarios | Avg Composite | Weighted Composite |');
  lines.push('|------------|-----------|---------------|--------------------|');
  for (const [diff, data] of Object.entries(report.byDifficulty)) {
    lines.push(`| ${diff} | ${data.count} | ${(data.avgComposite * 100).toFixed(1)}% | ${(data.weightedComposite * 100).toFixed(1)}% |`);
  }
  lines.push('');

  // ── Latency compliance ──────────────────────────────────────────────────
  lines.push('## Latency Compliance');
  lines.push('');
  lines.push(`- **Scenarios with latency budget:** ${report.latencyCompliance.totalWithBudget}`);
  lines.push(`- **Compliant (within budget):** ${report.latencyCompliance.compliantCount}`);
  lines.push(`- **Compliance rate:** ${(report.latencyCompliance.complianceRate * 100).toFixed(1)}%`);
  lines.push('');

  // ── Multi-seed consistency ──────────────────────────────────────────────
  lines.push('## Multi-Seed Consistency (Jaccard Token Similarity)');
  lines.push('');
  lines.push(`- **Hardcoded responses** (Jaccard > 0.95): ${report.multiSeedConsistency.hardcodedCount}`);
  lines.push(`- **Seed-sensitive responses** (Jaccard <= 0.95): ${report.multiSeedConsistency.seedSensitiveCount}`);
  lines.push('');
  if (report.multiSeedConsistency.jaccardSimilarities.length > 0) {
    lines.push('| Scenario | Jaccard Similarity |');
    lines.push('|----------|--------------------|');
    for (const j of report.multiSeedConsistency.jaccardSimilarities) {
      lines.push(`| ${j.scenario} | ${(j.similarity * 100).toFixed(1)}% |`);
    }
    lines.push('');
  }

  // ── Negative test summary ──────────────────────────────────────────────
  lines.push('## Negative Test Results');
  lines.push('');
  lines.push(`- **Total negative tests:** ${report.negativeTestSummary.totalNegativeTests}`);
  lines.push(`- **Graceful handling rate:** ${(report.negativeTestSummary.gracefulHandlingRate * 100).toFixed(1)}%`);
  lines.push('');

  // ── Multi-step summary ─────────────────────────────────────────────────
  lines.push('## Multi-Step Scenario Results');
  lines.push('');
  lines.push(`- **Total multi-step scenarios:** ${report.multiStepSummary.totalMultiStep}`);
  lines.push(`- **Avg composite:** ${(report.multiStepSummary.avgComposite * 100).toFixed(1)}%`);
  lines.push(`- **Handoff success rate:** ${(report.multiStepSummary.handoffSuccessRate * 100).toFixed(1)}%`);
  lines.push('');

  // ── Coverage map ───────────────────────────────────────────────────────
  lines.push('## Coverage Map');
  lines.push('');
  lines.push('### Agents Tested by Persona');
  lines.push('');
  lines.push('| Agent | Personas |');
  lines.push('|-------|----------|');
  for (const [agent, personas] of Object.entries(report.coverageMap.byAgent)) {
    lines.push(`| ${agent} | ${personas.join(', ')} |`);
  }
  lines.push('');

  lines.push('### Tools Tested by Persona');
  lines.push('');
  lines.push('| Tool | Personas |');
  lines.push('|------|----------|');
  for (const [tool, personas] of Object.entries(report.coverageMap.byTool)) {
    lines.push(`| ${tool} | ${personas.join(', ')} |`);
  }
  lines.push('');

  // ── Detailed scenario breakdown ─────────────────────────────────────────
  lines.push('## Detailed Scenario Results');
  lines.push('');
  lines.push('| Scenario | Persona | Seed | Routing | Complete | Ground | Action | Specific | NegHdl | Structure | Latency | Composite | Ms |');
  lines.push('|----------|---------|------|---------|----------|--------|--------|----------|--------|-----------|---------|-----------|-----|');
  for (const personaData of Object.values(report.byPersona)) {
    for (const r of personaData.results) {
      const s = r.scores;
      lines.push(
        `| ${r.scenario.name} | ${r.scenario.persona} | ${r.seed} ` +
        `| ${pct(s.routingAccuracy)} | ${pct(s.responseCompleteness)} ` +
        `| ${pct(s.factualGrounding)} | ${pct(s.actionability)} ` +
        `| ${pct(s.seedSpecificity)} | ${pct(s.negativeHandling)} ` +
        `| ${pct(s.responseStructure)} | ${pct(s.latencyCompliance)} ` +
        `| ${pct(s.composite)} | ${r.latencyMs}ms |`,
      );
    }
  }
  lines.push('');

  // ── Errors ──────────────────────────────────────────────────────────────
  const errors = Object.values(report.byPersona)
    .flatMap((p) => p.results)
    .filter((r) => r.error);
  if (errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const r of errors) {
      lines.push(`- **${r.scenario.name}** (${r.seed}): ${r.error}`);
    }
    lines.push('');
  }

  const outPath = repoRoot('docs', 'PERSONA_BENCHMARK_REPORT.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
  return outPath;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate the full persona benchmark report.
 * Writes both JSON and Markdown files, returns the report object.
 */
export function generatePersonaReport(results: PersonaResult[]): PersonaReport {
  const report = buildPersonaReport(results);
  writeJsonReport(report);
  writeMarkdownReport(report);
  return report;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function round(n: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
