/**
 * Eval Framework — OSS vs Private Comparison Report
 *
 * Generates a side-by-side comparison of community (OSS) and enterprise
 * evaluation results. This is the key document for understanding the value
 * proposition of the open-source edition and what drives upgrades.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import type { AgentEvalResult, SwarmEvalResult } from '../types.js';
import type { GatingVerificationResult } from '../oss-comparison/gating-verification.js';
import type { OSSValueResult } from '../oss-comparison/value-verification.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparisonReportInput {
  communityResults: AgentEvalResult[];
  enterpriseResults: AgentEvalResult[];
  communitySwarmResults?: SwarmEvalResult[];
  enterpriseSwarmResults?: SwarmEvalResult[];
  gatingResult?: GatingVerificationResult;
  ossValueResult?: OSSValueResult;
}

export interface ComparisonReportOutput {
  markdownPath: string;
  jsonPath: string;
}

interface AgentComparison {
  agent: string;
  ossScore: number;
  privateScore: number;
  delta: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(value: number): string {
  return `${value.toFixed(1)}`;
}

function pctOf(part: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function deltaSymbol(delta: number): string {
  if (delta > 0) return `+${pct(delta)}`;
  if (delta < 0) return pct(delta);
  return '0.0';
}

// ---------------------------------------------------------------------------
// OSS agents (all except dw-ml which is enterprise-only)
// ---------------------------------------------------------------------------

const ENTERPRISE_ONLY_AGENTS = new Set(['dw-ml']);

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function generateComparisonMarkdown(input: ComparisonReportInput): string {
  const lines: string[] = [];
  const {
    communityResults,
    enterpriseResults,
    communitySwarmResults,
    enterpriseSwarmResults,
    gatingResult,
    ossValueResult,
  } = input;

  // Build agent comparison
  const agentComparisons: AgentComparison[] = [];
  const enterpriseMap = new Map(enterpriseResults.map((r) => [r.agent, r]));

  for (const community of communityResults) {
    const enterprise = enterpriseMap.get(community.agent);
    const privateScore = enterprise?.compositeScore ?? 0;
    const delta = community.compositeScore - privateScore;
    const notes = ENTERPRISE_ONLY_AGENTS.has(community.agent)
      ? 'Enterprise-only agent'
      : delta === 0
        ? 'No difference (read-only agent)'
        : delta < -10
          ? 'Significant write tool dependency'
          : 'Minor write tool dependency';

    agentComparisons.push({
      agent: community.agent,
      ossScore: community.compositeScore,
      privateScore,
      delta,
      notes,
    });
  }

  // Agents only in enterprise
  for (const ent of enterpriseResults) {
    if (!communityResults.find((c) => c.agent === ent.agent)) {
      agentComparisons.push({
        agent: ent.agent,
        ossScore: 0,
        privateScore: ent.compositeScore,
        delta: -ent.compositeScore,
        notes: 'Enterprise-only agent (not in OSS)',
      });
    }
  }

  const avgOss = communityResults.length > 0
    ? communityResults.reduce((s, r) => s + r.compositeScore, 0) / communityResults.length
    : 0;
  const avgEnterprise = enterpriseResults.length > 0
    ? enterpriseResults.reduce((s, r) => s + r.compositeScore, 0) / enterpriseResults.length
    : 0;
  const valueRatio = avgEnterprise > 0 ? (avgOss / avgEnterprise) * 100 : 0;

  // ---- Header ----
  lines.push('# OSS vs Enterprise Evaluation Comparison');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  // ---- Key Finding ----
  lines.push('## Key Finding');
  lines.push('');
  lines.push(`> **OSS delivers ${pct(valueRatio)}% of enterprise value.**`);
  lines.push('');
  lines.push(`The community edition scores an average of ${pct(avgOss)}/100 compared to the enterprise edition's ${pct(avgEnterprise)}/100.`);
  if (ossValueResult) {
    lines.push(`The OSS value verification scored the community experience at ${ossValueResult.overallScore}/100.`);
  }
  lines.push('');

  // ---- Agent comparison table ----
  lines.push('## Agent-Level Comparison');
  lines.push('');
  lines.push('| Agent | OSS Score | Private Score | Delta | Notes |');
  lines.push('|-------|----------:|--------------:|------:|-------|');
  for (const ac of agentComparisons) {
    lines.push(
      `| ${ac.agent} | ${pct(ac.ossScore)} | ${pct(ac.privateScore)} | ${deltaSymbol(ac.delta)} | ${ac.notes} |`,
    );
  }
  lines.push('');

  // ---- Tool availability comparison ----
  if (gatingResult || ossValueResult) {
    lines.push('## Tool Availability Comparison');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|------:|');

    if (ossValueResult) {
      lines.push(`| Total tools | ${ossValueResult.totalToolCount} |`);
      lines.push(`| Read tools (community) | ${ossValueResult.communityToolCount} |`);
      lines.push(`| Write/admin tools (gated) | ${ossValueResult.totalToolCount - ossValueResult.communityToolCount} |`);
      lines.push(`| Tool availability rate | ${pctOf(ossValueResult.communityToolCount, ossValueResult.totalToolCount)} |`);
    }

    if (gatingResult) {
      lines.push(`| Write tools tested | ${gatingResult.totalWriteTools} |`);
      lines.push(`| Correctly gated | ${gatingResult.gatedCorrectly} |`);
      lines.push(`| Gating accuracy | ${pctOf(gatingResult.gatedCorrectly, gatingResult.totalWriteTools)} |`);
      lines.push(`| Read tools tested | ${gatingResult.totalReadTools} |`);
      lines.push(`| Read tools working | ${gatingResult.readToolsWork} |`);
      lines.push(`| Messaging score | ${gatingResult.messagingScore}/100 |`);
    }
    lines.push('');
  }

  // ---- Swarm comparison ----
  if (communitySwarmResults && enterpriseSwarmResults) {
    lines.push('## Swarm Completion Comparison');
    lines.push('');

    const communityPass = communitySwarmResults.filter((s) => s.handoffSuccess).length;
    const enterprisePass = enterpriseSwarmResults.filter((s) => s.handoffSuccess).length;

    lines.push('| Tier | Scenarios | Handoff Pass | Pass Rate |');
    lines.push('|------|----------:|-------------:|----------:|');
    lines.push(`| Community | ${communitySwarmResults.length} | ${communityPass} | ${pctOf(communityPass, communitySwarmResults.length)} |`);
    lines.push(`| Enterprise | ${enterpriseSwarmResults.length} | ${enterprisePass} | ${pctOf(enterprisePass, enterpriseSwarmResults.length)} |`);
    lines.push('');

    // Per-scenario breakdown
    lines.push('### Scenario Details');
    lines.push('');
    lines.push('| Scenario | Community | Enterprise | Notes |');
    lines.push('|----------|-----------|------------|-------|');

    const enterpriseSwarmMap = new Map(enterpriseSwarmResults.map((s) => [s.scenario, s]));
    for (const cs of communitySwarmResults) {
      const es = enterpriseSwarmMap.get(cs.scenario);
      const cStatus = cs.handoffSuccess ? 'PASS' : 'FAIL';
      const eStatus = es?.handoffSuccess ? 'PASS' : 'N/A';
      const note = !cs.handoffSuccess && es?.handoffSuccess
        ? 'Requires write tools for handoff'
        : cs.handoffSuccess && es?.handoffSuccess
          ? 'Works in both tiers'
          : '';
      lines.push(`| ${cs.scenario} | ${cStatus} | ${eStatus} | ${note} |`);
    }
    lines.push('');
  }

  // ---- OSS workflow value ----
  if (ossValueResult) {
    lines.push('## OSS Workflow Value');
    lines.push('');
    lines.push('| Workflow | Score | Tools Working | Notes |');
    lines.push('|----------|------:|--------------:|-------|');
    for (const w of ossValueResult.workflows) {
      lines.push(
        `| ${w.name} | ${w.score}/100 | ${w.toolsWorking.length}/${w.toolsTested.length} | ${w.note} |`,
      );
    }
    lines.push('');
  }

  // ---- Upgrade motivation analysis ----
  lines.push('## Upgrade Motivation Analysis');
  lines.push('');
  lines.push('Features that drive the most upgrade motivation (largest delta between tiers):');
  lines.push('');

  const sortedByDelta = [...agentComparisons]
    .filter((ac) => ac.delta < 0)
    .sort((a, b) => a.delta - b.delta);

  if (sortedByDelta.length > 0) {
    for (let i = 0; i < Math.min(5, sortedByDelta.length); i++) {
      const ac = sortedByDelta[i];
      lines.push(`${i + 1}. **${ac.agent}** — ${deltaSymbol(ac.delta)} points gap. ${ac.notes}`);
    }
  } else {
    lines.push('No significant delta detected between tiers.');
  }
  lines.push('');

  // ---- Recommendation ----
  lines.push('## Recommendations');
  lines.push('');
  if (valueRatio >= 60) {
    lines.push('The OSS edition delivers strong value. The upgrade path is driven by:');
  } else if (valueRatio >= 40) {
    lines.push('The OSS edition delivers moderate value. Consider expanding read capabilities to:');
  } else {
    lines.push('The OSS edition may be under-serving users. Consider:');
  }
  lines.push('');
  lines.push('- Write operations (pipeline deployment, schema migration, quality SLAs)');
  lines.push('- Admin capabilities (alert resolution, data steward workflows)');
  lines.push('- Enterprise-only agents (dw-ml for ML lifecycle management)');
  lines.push('- Multi-agent swarm scenarios that span read and write operations');
  lines.push('');

  lines.push('---');
  lines.push('Generated by eval-framework comparison-report');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a side-by-side OSS vs Enterprise comparison report.
 *
 * Outputs:
 *   - docs/EVAL_COMPARISON_OSS_VS_PRIVATE.md — human-readable comparison
 *   - docs/eval-results/comparison-YYYY-MM-DD.json — structured data
 *
 * @param input - Community and enterprise results plus optional gating/value data
 * @param outputDir - Base output directory (defaults to project root docs/)
 * @returns Paths to generated files
 */
export function generateComparisonReport(
  input: ComparisonReportInput,
  outputDir?: string,
): ComparisonReportOutput {
  const baseDir = outputDir ?? path.resolve(__dirname, '../../../docs');
  const resultsDir = path.join(baseDir, 'eval-results');

  for (const dir of [baseDir, resultsDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Write Markdown
  const markdownPath = path.join(baseDir, 'EVAL_COMPARISON_OSS_VS_PRIVATE.md');
  writeFileSync(markdownPath, generateComparisonMarkdown(input), 'utf-8');

  // Write JSON
  const dateStr = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(resultsDir, `comparison-${dateStr}.json`);

  const avgOss = input.communityResults.length > 0
    ? input.communityResults.reduce((s, r) => s + r.compositeScore, 0) / input.communityResults.length
    : 0;
  const avgEnterprise = input.enterpriseResults.length > 0
    ? input.enterpriseResults.reduce((s, r) => s + r.compositeScore, 0) / input.enterpriseResults.length
    : 0;

  const jsonData = {
    generatedAt: new Date().toISOString(),
    summary: {
      avgOssScore: avgOss,
      avgEnterpriseScore: avgEnterprise,
      valueRatio: avgEnterprise > 0 ? (avgOss / avgEnterprise) * 100 : 0,
      communityAgents: input.communityResults.length,
      enterpriseAgents: input.enterpriseResults.length,
    },
    gating: input.gatingResult ?? null,
    ossValue: input.ossValueResult ?? null,
    communityResults: input.communityResults,
    enterpriseResults: input.enterpriseResults,
    communitySwarmResults: input.communitySwarmResults ?? [],
    enterpriseSwarmResults: input.enterpriseSwarmResults ?? [],
  };

  writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');

  return { markdownPath, jsonPath };
}
