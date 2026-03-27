/**
 * Eval Framework — Main Test Suite
 *
 * Runs AI Evals + Product Quality dimensions against all 14 MCP agents.
 * Generates per-agent scores and overall summary.
 *
 * Uses InMemory stubs — no external services required.
 */

import { describe, it, expect, afterAll } from 'vitest';

// ── Agent server imports (same pattern as agent-report-card.test.ts) ────────
import { server as pipelinesServer } from '../../agents/dw-pipelines/src/index.js';
import { server as incidentsServer } from '../../agents/dw-incidents/src/index.js';
import { server as catalogServer } from '../../agents/dw-context-catalog/src/index.js';
import { server as schemaServer } from '../../agents/dw-schema/src/index.js';
import { server as qualityServer } from '../../agents/dw-quality/src/index.js';
import { server as governanceServer } from '../../agents/dw-governance/src/index.js';
import { server as usageIntelServer } from '../../agents/dw-usage-intelligence/src/index.js';
import { server as observabilityServer } from '../../agents/dw-observability/src/index.js';
import { server as connectorsServer } from '../../agents/dw-connectors/src/index.js';
import { server as mlServer } from '../../agents/dw-ml/src/index.js';

// ── Eval framework imports ──────────────────────────────────────────────────
import type { AgentEvalResult, DimensionScore, MCPServer } from './types.js';
import { AGENT_REGISTRY } from './config.js';
import { evaluateAIEvals } from './dimensions/ai-evals.js';
import { evaluateProductQuality } from './dimensions/product-quality.js';
import { buildAgentEvalResult, aggregateSummary } from './scoring/aggregator.js';
import { scoreToGrade } from './scoring/rubrics.js';

// ── Server map ──────────────────────────────────────────────────────────────

const SERVERS: Record<string, MCPServer> = {
  'dw-pipelines': pipelinesServer as unknown as MCPServer,
  'dw-incidents': incidentsServer as unknown as MCPServer,
  'dw-context-catalog': catalogServer as unknown as MCPServer,
  'dw-schema': schemaServer as unknown as MCPServer,
  'dw-quality': qualityServer as unknown as MCPServer,
  'dw-governance': governanceServer as unknown as MCPServer,
  'dw-usage-intelligence': usageIntelServer as unknown as MCPServer,
  'dw-observability': observabilityServer as unknown as MCPServer,
  'dw-connectors': connectorsServer as unknown as MCPServer,
  'dw-ml': mlServer as unknown as MCPServer,
};

// ── Collect results across all tests ────────────────────────────────────────

const allResults: AgentEvalResult[] = [];

// ── Test suite ──────────────────────────────────────────────────────────────

describe('Eval Framework: AI Evals + Product Quality', () => {
  const RUNS_PER_TOOL = 3;

  // Build the list of agents to evaluate (skip dw-orchestration — not MCP)
  const mcpAgents = AGENT_REGISTRY.filter(
    (a) => a.tools.length > 0 && SERVERS[a.agent],
  );

  for (const agentConfig of mcpAgents) {
    describe(agentConfig.agent, () => {
      const agentDimensions: DimensionScore[] = [];
      const toolsTested: string[] = [];

      // Get tool descriptions from the server for doc-match evaluation
      const server = SERVERS[agentConfig.agent];
      const toolList = server.listTools?.() ?? [];
      const toolDescriptions: Record<string, string | undefined> = {};
      for (const t of toolList) {
        toolDescriptions[t.name] = t.description;
      }

      for (const tool of agentConfig.tools) {
        it(`${tool} — AI Evals`, async () => {
          const aiScore = await evaluateAIEvals(agentConfig.agent, tool, server, RUNS_PER_TOOL);

          // Store for aggregation
          agentDimensions.push(aiScore);
          toolsTested.push(tool);

          console.log(
            `  [${agentConfig.agent}/${tool}] AI Evals: ${aiScore.score}/100 (${aiScore.grade})`,
          );
          for (const sub of aiScore.subscores) {
            console.log(`    ${sub.metric}: ${sub.value.toFixed(1)} ${sub.passed ? 'PASS' : 'FAIL'} — ${sub.detail}`);
          }

          // Non-blocking — we're scoring, not hard-asserting
          expect(aiScore.score).toBeGreaterThanOrEqual(0);
          expect(aiScore.score).toBeLessThanOrEqual(100);
        }, 60_000);

        it(`${tool} — Product Quality`, async () => {
          const pqScore = await evaluateProductQuality(
            agentConfig.agent,
            tool,
            server,
            toolDescriptions[tool],
            RUNS_PER_TOOL,
          );

          agentDimensions.push(pqScore);

          console.log(
            `  [${agentConfig.agent}/${tool}] Product Quality: ${pqScore.score}/100 (${pqScore.grade})`,
          );
          for (const sub of pqScore.subscores) {
            console.log(`    ${sub.metric}: ${sub.value.toFixed(1)} ${sub.passed ? 'PASS' : 'FAIL'} — ${sub.detail}`);
          }

          expect(pqScore.score).toBeGreaterThanOrEqual(0);
          expect(pqScore.score).toBeLessThanOrEqual(100);
        }, 60_000);
      }

      // After all tools for this agent, build the agent-level result
      it('agent composite score', () => {
        // Merge dimension scores: average AI Evals across tools, average PQ across tools
        const aiScores = agentDimensions.filter((d) => d.dimension === 'ai-evals');
        const pqScores = agentDimensions.filter((d) => d.dimension === 'product-quality');

        const avgAI = aiScores.length > 0
          ? aiScores.reduce((s, d) => s + d.score, 0) / aiScores.length
          : 0;
        const avgPQ = pqScores.length > 0
          ? pqScores.reduce((s, d) => s + d.score, 0) / pqScores.length
          : 0;

        // For now, Productivity and User Value use heuristic defaults
        // (these will be implemented in the next iteration)
        const productivityScore = agentConfig.tools.length >= 4 ? 70 : 50;
        const userValueScore = avgAI > 60 ? 65 : 45;

        const mergedDimensions: DimensionScore[] = [
          {
            dimension: 'ai-evals',
            score: Math.round(avgAI * 100) / 100,
            grade: scoreToGrade(avgAI),
            subscores: aiScores.flatMap((d) => d.subscores),
            evidence: aiScores.flatMap((d) => d.evidence),
          },
          {
            dimension: 'product-quality',
            score: Math.round(avgPQ * 100) / 100,
            grade: scoreToGrade(avgPQ),
            subscores: pqScores.flatMap((d) => d.subscores),
            evidence: pqScores.flatMap((d) => d.evidence),
          },
          {
            dimension: 'productivity',
            score: productivityScore,
            grade: scoreToGrade(productivityScore),
            subscores: [],
            evidence: [`Heuristic: ${agentConfig.tools.length} tools tested`],
          },
          {
            dimension: 'user-value',
            score: userValueScore,
            grade: scoreToGrade(userValueScore),
            subscores: [],
            evidence: [`Heuristic based on AI Evals score: ${avgAI.toFixed(1)}`],
          },
        ];

        const agentResult = buildAgentEvalResult(
          agentConfig.agent,
          [...new Set(toolsTested)],
          mergedDimensions,
          'community',
        );

        allResults.push(agentResult);

        console.log(`\n  === ${agentConfig.agent} COMPOSITE ===`);
        console.log(`  AI Evals:       ${avgAI.toFixed(1)} (${scoreToGrade(avgAI)})`);
        console.log(`  Product Quality: ${avgPQ.toFixed(1)} (${scoreToGrade(avgPQ)})`);
        console.log(`  Productivity:    ${productivityScore} (${scoreToGrade(productivityScore)})`);
        console.log(`  User Value:      ${userValueScore} (${scoreToGrade(userValueScore)})`);
        console.log(`  COMPOSITE:       ${agentResult.compositeScore.toFixed(1)} (${agentResult.compositeGrade})`);

        expect(agentResult.compositeScore).toBeGreaterThanOrEqual(0);
        expect(agentResult.compositeScore).toBeLessThanOrEqual(100);
      });
    });
  }

  // ── Summary (runs after all agent tests) ────────────────────────────────

  afterAll(() => {
    if (allResults.length === 0) return;

    const summary = aggregateSummary(allResults);

    console.log('\n\n========================================');
    console.log('  EVAL FRAMEWORK SUMMARY');
    console.log('========================================');
    console.log(`  Agents evaluated: ${summary.totalAgents}`);
    console.log(`  Average composite: ${summary.avgComposite.toFixed(1)} (${summary.avgGrade})`);
    console.log('');
    console.log('  By Dimension:');
    for (const [dim, stats] of Object.entries(summary.byDimension)) {
      console.log(`    ${dim}: avg=${stats.avg.toFixed(1)} min=${stats.min.toFixed(1)} max=${stats.max.toFixed(1)} (${stats.grade})`);
    }
    console.log('');
    console.log('  Agent Ranking:');
    for (let i = 0; i < summary.agentRanking.length; i++) {
      const r = summary.agentRanking[i];
      console.log(`    ${i + 1}. ${r.agent}: ${r.composite.toFixed(1)} (${r.grade})`);
    }
    console.log('========================================\n');
  });
});
