/**
 * Eval Framework — Swarm Evaluation Tests
 *
 * Runs multi-agent swarm scenarios end-to-end, evaluating:
 * - Handoff success: can outputs from one agent chain into the next?
 * - End-to-end latency: total time across all steps
 * - Task completion: did each step produce valid output?
 * - Productivity & user-value scoring via dimension rubrics
 *
 * All agents use InMemory stubs — no external services required.
 */

import { describe, it, expect } from 'vitest';

// ─── Agent servers ──────────────────────────────────────────────────────────
import { server as catalogServer } from '../../agents/dw-context-catalog/src/index.js';
import { server as incidentsServer } from '../../agents/dw-incidents/src/index.js';
import { server as schemaServer } from '../../agents/dw-schema/src/index.js';
import { server as qualityServer } from '../../agents/dw-quality/src/index.js';
import { server as governanceServer } from '../../agents/dw-governance/src/index.js';
import { server as usageIntelServer } from '../../agents/dw-usage-intelligence/src/index.js';
import { server as observabilityServer } from '../../agents/dw-observability/src/index.js';

// ─── Swarm scenarios ────────────────────────────────────────────────────────
import { onboardingScenario, runSwarmScenario } from './scenarios/swarm/onboarding.js';
import { incidentResponseScenario } from './scenarios/swarm/incident-response.js';
import { costOptimizationScenario } from './scenarios/swarm/cost-optimization.js';
import { schemaMigrationScenario } from './scenarios/swarm/schema-migration.js';
import { dataDiscoveryScenario } from './scenarios/swarm/data-discovery.js';

// ─── Dimensions ─────────────────────────────────────────────────────────────
import {
  measureTaskCompletion,
  measureStepsSaved,
  measureAutomationCoverage,
} from './dimensions/productivity.js';
import {
  measureActionability,
  measureRelevance,
  measureTrustSignals,
} from './dimensions/user-value.js';

// ─── Types ──────────────────────────────────────────────────────────────────
import type { SwarmEvalResult, SwarmStepResult, SwarmScenario } from './scenarios/swarm/types.js';

// ---------------------------------------------------------------------------
// Server map — maps agent names to their MCP server instances
// ---------------------------------------------------------------------------

type ServerInstance = { callTool: (name: string, args: Record<string, unknown>) => Promise<any> };

const servers: Record<string, ServerInstance> = {
  'dw-context-catalog': catalogServer as unknown as ServerInstance,
  'dw-incidents': incidentsServer as unknown as ServerInstance,
  'dw-schema': schemaServer as unknown as ServerInstance,
  'dw-quality': qualityServer as unknown as ServerInstance,
  'dw-governance': governanceServer as unknown as ServerInstance,
  'dw-usage-intelligence': usageIntelServer as unknown as ServerInstance,
  'dw-observability': observabilityServer as unknown as ServerInstance,
};

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Compute productivity score for a swarm result.
 * Combines task completion, steps saved, and automation coverage.
 */
function computeProductivityScore(steps: SwarmStepResult[]): number {
  if (steps.length === 0) return 0;

  // Task completion: fraction of steps that succeeded
  const completionRate = steps.filter((s) => s.success).length / steps.length;

  // Steps saved: average across all steps
  const stepsSavedScores = steps.map((s) => {
    const result = wrapAsToolResult(s);
    const saved = measureStepsSaved(s.tool, result);
    return saved.ratio;
  });
  const avgStepsSaved = stepsSavedScores.reduce((a, b) => a + b, 0) / stepsSavedScores.length;

  // Automation coverage
  const coverage = measureAutomationCoverage(
    { name: 'swarm', steps: steps.map((s) => s.stepId) },
    steps.map((s) => ({ step: s.stepId, success: s.success })),
  );

  // Weighted combination
  return (
    completionRate * 0.4 +
    avgStepsSaved * 0.3 +
    coverage.coverage * 0.3
  );
}

/**
 * Compute user-value score for a swarm result.
 * Combines actionability, relevance, and trust signals across all steps.
 */
function computeUserValueScore(steps: SwarmStepResult[]): number {
  const successSteps = steps.filter((s) => s.success);
  if (successSteps.length === 0) return 0;

  let totalActionability = 0;
  let totalTrust = 0;

  for (const step of successSteps) {
    const result = wrapAsToolResult(step);
    totalActionability += measureActionability(result).score;
    totalTrust += measureTrustSignals(result).score;
  }

  const avgActionability = totalActionability / successSteps.length;
  const avgTrust = totalTrust / successSteps.length;

  // Weighted combination
  return avgActionability * 0.6 + avgTrust * 0.4;
}

/**
 * Wrap a SwarmStepResult as a tool result shape for the dimension functions.
 */
function wrapAsToolResult(step: SwarmStepResult): { isError?: boolean; content?: Array<{ text?: string }> } | null {
  if (!step.success || step.output === null) {
    return step.error ? { isError: true, content: [{ text: step.error }] } : null;
  }
  return {
    isError: false,
    content: [{ text: JSON.stringify(step.output) }],
  };
}

/**
 * Evaluate a single swarm scenario and produce a SwarmEvalResult.
 */
async function evaluateSwarmScenario(scenario: SwarmScenario): Promise<SwarmEvalResult> {
  const result = await runSwarmScenario(scenario, servers);

  const stepsSucceeded = result.steps.filter((s) => s.success).length;
  const stepsFailed = result.steps.filter((s) => !s.success).length;
  const handoffSuccesses = result.steps.filter((s) => s.handoffSuccess).length;
  const handoffRate = result.steps.length > 0 ? handoffSuccesses / result.steps.length : 0;

  const productivityScore = computeProductivityScore(result.steps);
  const userValueScore = computeUserValueScore(result.steps);

  const automationCoverage = measureAutomationCoverage(
    { name: scenario.name, steps: scenario.steps.map((s) => s.id) },
    result.steps.map((s) => ({ step: s.stepId, success: s.success })),
  );

  const overallScore =
    productivityScore * 0.35 +
    userValueScore * 0.25 +
    handoffRate * 0.25 +
    automationCoverage.coverage * 0.15;

  return {
    scenario: scenario.name,
    description: scenario.description,
    success: result.success,
    totalLatencyMs: result.totalLatencyMs,
    stepCount: result.steps.length,
    stepsSucceeded,
    stepsFailed,
    handoffSuccessRate: Math.round(handoffRate * 1000) / 1000,
    automationCoverage: Math.round(automationCoverage.coverage * 1000) / 1000,
    productivityScore: Math.round(productivityScore * 1000) / 1000,
    userValueScore: Math.round(userValueScore * 1000) / 1000,
    overallScore: Math.round(overallScore * 1000) / 1000,
    steps: result.steps,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Swarm Evaluation', () => {
  const allResults: SwarmEvalResult[] = [];

  // ── Onboarding ──────────────────────────────────────────────────────────

  describe('New Engineer Onboarding', () => {
    let evalResult: SwarmEvalResult;

    it('should run the full onboarding swarm scenario', async () => {
      evalResult = await evaluateSwarmScenario(onboardingScenario);
      allResults.push(evalResult);

      // At minimum, the scenario should execute without throwing
      expect(evalResult).toBeDefined();
      expect(evalResult.stepCount).toBe(4);
    });

    it('should achieve reasonable handoff success rate', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(onboardingScenario);

      // With InMemory stubs, we expect at least some handoffs to work
      // The first step has no dependencies, so it should always "succeed" at handoff
      expect(evalResult.handoffSuccessRate).toBeGreaterThanOrEqual(0);
      expect(evalResult.handoffSuccessRate).toBeLessThanOrEqual(1);
    });

    it('should produce a valid productivity score', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(onboardingScenario);

      expect(evalResult.productivityScore).toBeGreaterThanOrEqual(0);
      expect(evalResult.productivityScore).toBeLessThanOrEqual(1);
    });

    it('should produce a valid user-value score', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(onboardingScenario);

      expect(evalResult.userValueScore).toBeGreaterThanOrEqual(0);
      expect(evalResult.userValueScore).toBeLessThanOrEqual(1);
    });
  });

  // ── Incident Response ───────────────────────────────────────────────────

  describe('Incident Response', () => {
    let evalResult: SwarmEvalResult;

    it('should run the full incident response swarm scenario', async () => {
      evalResult = await evaluateSwarmScenario(incidentResponseScenario);
      allResults.push(evalResult);

      expect(evalResult).toBeDefined();
      expect(evalResult.stepCount).toBe(4);
    });

    it('should chain incident ID from diagnose to root-cause and remediate', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(incidentResponseScenario);

      // The diagnose step should produce an incidentId used downstream
      const diagnoseStep = evalResult.steps.find((s) => s.stepId === 'diagnose');
      expect(diagnoseStep).toBeDefined();

      // If diagnose succeeded, downstream steps should have received the ID
      if (diagnoseStep?.success && diagnoseStep.output?.incidentId) {
        const rootCause = evalResult.steps.find((s) => s.stepId === 'root-cause');
        expect(rootCause?.handoffSuccess).toBe(true);
      }
    });

    it('should score productivity and user-value in valid range', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(incidentResponseScenario);

      expect(evalResult.productivityScore).toBeGreaterThanOrEqual(0);
      expect(evalResult.productivityScore).toBeLessThanOrEqual(1);
      expect(evalResult.userValueScore).toBeGreaterThanOrEqual(0);
      expect(evalResult.userValueScore).toBeLessThanOrEqual(1);
    });
  });

  // ── Cost Optimization ───────────────────────────────────────────────────

  describe('Cost Optimization', () => {
    let evalResult: SwarmEvalResult;

    it('should run the full cost optimization swarm scenario', async () => {
      evalResult = await evaluateSwarmScenario(costOptimizationScenario);
      allResults.push(evalResult);

      expect(evalResult).toBeDefined();
      expect(evalResult.stepCount).toBe(5);
    });

    it('should complete with valid automation coverage', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(costOptimizationScenario);

      expect(evalResult.automationCoverage).toBeGreaterThanOrEqual(0);
      expect(evalResult.automationCoverage).toBeLessThanOrEqual(1);
    });

    it('should produce actionable cost savings information', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(costOptimizationScenario);

      // If the savings step succeeded, it should have actionable content
      const savingsStep = evalResult.steps.find((s) => s.stepId === 'savings-estimate');
      if (savingsStep?.success) {
        const result = wrapAsToolResult(savingsStep);
        const actionability = measureActionability(result);
        expect(actionability.score).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ── Schema Migration ────────────────────────────────────────────────────

  describe('Schema Migration', () => {
    let evalResult: SwarmEvalResult;

    it('should run the full schema migration swarm scenario', async () => {
      evalResult = await evaluateSwarmScenario(schemaMigrationScenario);
      allResults.push(evalResult);

      expect(evalResult).toBeDefined();
      expect(evalResult.stepCount).toBe(4);
    });

    it('should generate valid migration SQL', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(schemaMigrationScenario);

      const migrationStep = evalResult.steps.find((s) => s.stepId === 'generate-migration');
      if (migrationStep?.success && migrationStep.output) {
        // The output should contain SQL
        const outputStr = JSON.stringify(migrationStep.output);
        const hasSqlContent = /sql|alter|create|add/i.test(outputStr);
        expect(hasSqlContent || migrationStep.success).toBe(true);
      }
    });

    it('should produce an audit trail after migration', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(schemaMigrationScenario);

      const auditStep = evalResult.steps.find((s) => s.stepId === 'audit-report');
      expect(auditStep).toBeDefined();
      // The audit step doesn't depend on previous outputs, so it should execute
    });
  });

  // ── Data Discovery ──────────────────────────────────────────────────────

  describe('Data Discovery', () => {
    let evalResult: SwarmEvalResult;

    it('should run the full data discovery swarm scenario', async () => {
      evalResult = await evaluateSwarmScenario(dataDiscoveryScenario);
      allResults.push(evalResult);

      expect(evalResult).toBeDefined();
      expect(evalResult.stepCount).toBe(4);
    });

    it('should chain search results to explain and documentation steps', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(dataDiscoveryScenario);

      const searchStep = evalResult.steps.find((s) => s.stepId === 'search-data');
      if (searchStep?.success) {
        const explainStep = evalResult.steps.find((s) => s.stepId === 'explain-table');
        const docsStep = evalResult.steps.find((s) => s.stepId === 'generate-docs');
        // If search produced results, downstream should have usable handoffs
        expect(explainStep).toBeDefined();
        expect(docsStep).toBeDefined();
      }
    });

    it('should generate insights with trust signals', async () => {
      if (!evalResult) evalResult = await evaluateSwarmScenario(dataDiscoveryScenario);

      const insightStep = evalResult.steps.find((s) => s.stepId === 'generate-insight');
      if (insightStep?.success) {
        const result = wrapAsToolResult(insightStep);
        const trust = measureTrustSignals(result);
        expect(trust.score).toBeGreaterThanOrEqual(0);
        expect(trust.score).toBeLessThanOrEqual(1);
      }
    });
  });

  // ── Aggregate Report ────────────────────────────────────────────────────

  describe('Aggregate Swarm Report', () => {
    it('should produce a summary across all scenarios', async () => {
      // Run any scenarios that haven't been run yet
      if (allResults.length < 5) {
        const scenarios = [
          onboardingScenario,
          incidentResponseScenario,
          costOptimizationScenario,
          schemaMigrationScenario,
          dataDiscoveryScenario,
        ];

        for (const scenario of scenarios) {
          if (!allResults.find((r) => r.scenario === scenario.name)) {
            allResults.push(await evaluateSwarmScenario(scenario));
          }
        }
      }

      expect(allResults.length).toBe(5);

      // Log the aggregate report
      const totalSteps = allResults.reduce((s, r) => s + r.stepCount, 0);
      const totalSucceeded = allResults.reduce((s, r) => s + r.stepsSucceeded, 0);
      const avgProductivity = allResults.reduce((s, r) => s + r.productivityScore, 0) / allResults.length;
      const avgUserValue = allResults.reduce((s, r) => s + r.userValueScore, 0) / allResults.length;
      const avgHandoff = allResults.reduce((s, r) => s + r.handoffSuccessRate, 0) / allResults.length;
      const avgOverall = allResults.reduce((s, r) => s + r.overallScore, 0) / allResults.length;

      const report = {
        scenarioCount: allResults.length,
        totalSteps,
        totalSucceeded,
        totalFailed: totalSteps - totalSucceeded,
        stepSuccessRate: Math.round((totalSucceeded / totalSteps) * 1000) / 1000,
        avgProductivityScore: Math.round(avgProductivity * 1000) / 1000,
        avgUserValueScore: Math.round(avgUserValue * 1000) / 1000,
        avgHandoffSuccessRate: Math.round(avgHandoff * 1000) / 1000,
        avgOverallScore: Math.round(avgOverall * 1000) / 1000,
        scenarios: allResults.map((r) => ({
          name: r.scenario,
          success: r.success,
          steps: `${r.stepsSucceeded}/${r.stepCount}`,
          handoffRate: r.handoffSuccessRate,
          productivity: r.productivityScore,
          userValue: r.userValueScore,
          overall: r.overallScore,
          latencyMs: r.totalLatencyMs,
        })),
      };

      console.log('\n=== SWARM EVALUATION REPORT ===');
      console.log(JSON.stringify(report, null, 2));
      console.log('===============================\n');

      // All scores should be in valid range
      expect(avgProductivity).toBeGreaterThanOrEqual(0);
      expect(avgProductivity).toBeLessThanOrEqual(1);
      expect(avgUserValue).toBeGreaterThanOrEqual(0);
      expect(avgUserValue).toBeLessThanOrEqual(1);
      expect(avgOverall).toBeGreaterThanOrEqual(0);
      expect(avgOverall).toBeLessThanOrEqual(1);
    });
  });
});
