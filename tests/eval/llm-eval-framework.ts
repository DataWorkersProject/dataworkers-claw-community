/**
 * LLM Evaluation Framework.
 *
 * Provides a structured way to evaluate LLM-powered agent responses
 * across categories like pipeline generation, SQL, RCA, and classification.
 */

import type { ILLMClient } from '../../core/infrastructure-stubs/src/interfaces/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvalScenario {
  name: string;
  category: 'pipeline' | 'sql' | 'rca' | 'classification';
  input: string;
  expectedOutput: string | RegExp;
  agent: string;
  /** Optional tags for filtering scenarios */
  tags?: string[];
  /** Difficulty level for reporting */
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface EvalResult {
  scenario: EvalScenario;
  actualOutput: string;
  passed: boolean;
  matchType: 'exact' | 'regex' | 'partial';
  latencyMs: number;
  tokensUsed: { input: number; output: number };
  error?: string;
}

export interface EvalMetrics {
  totalScenarios: number;
  passed: number;
  failed: number;
  passRate: number;
  avgLatencyMs: number;
  totalTokens: { input: number; output: number };
  byCategory: Record<string, { total: number; passed: number; passRate: number }>;
  byAgent: Record<string, { total: number; passed: number; passRate: number }>;
  byDifficulty: Record<string, { total: number; passed: number; passRate: number }>;
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

function matchOutput(actual: string, expected: string | RegExp): { passed: boolean; matchType: 'exact' | 'regex' | 'partial' } {
  if (expected instanceof RegExp) {
    return { passed: expected.test(actual), matchType: 'regex' };
  }

  // Exact match
  if (actual.trim() === expected.trim()) {
    return { passed: true, matchType: 'exact' };
  }

  // Partial match (contains expected)
  if (actual.toLowerCase().includes(expected.toLowerCase())) {
    return { passed: true, matchType: 'partial' };
  }

  return { passed: false, matchType: 'exact' };
}

// ---------------------------------------------------------------------------
// LLMEvalRunner
// ---------------------------------------------------------------------------

export class LLMEvalRunner {
  private llmClient: ILLMClient;

  constructor(llmClient: ILLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Run a batch of evaluation scenarios against the LLM client.
   */
  async runScenarios(scenarios: EvalScenario[]): Promise<EvalResult[]> {
    const results: EvalResult[] = [];

    for (const scenario of scenarios) {
      const start = Date.now();
      let actualOutput = '';
      let tokensUsed = { input: 0, output: 0 };
      let error: string | undefined;

      try {
        const response = await this.llmClient.complete(scenario.input);
        actualOutput = response.content;
        tokensUsed = response.tokensUsed;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      const latencyMs = Date.now() - start;
      const match = error ? { passed: false, matchType: 'exact' as const } : matchOutput(actualOutput, scenario.expectedOutput);

      results.push({
        scenario,
        actualOutput,
        passed: match.passed,
        matchType: match.matchType,
        latencyMs,
        tokensUsed,
        error,
      });
    }

    return results;
  }

  /**
   * Compute aggregate metrics from evaluation results.
   */
  computeMetrics(results: EvalResult[]): EvalMetrics {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;

    const avgLatencyMs = total > 0 ? results.reduce((sum, r) => sum + r.latencyMs, 0) / total : 0;

    const totalTokens = results.reduce(
      (acc, r) => ({
        input: acc.input + r.tokensUsed.input,
        output: acc.output + r.tokensUsed.output,
      }),
      { input: 0, output: 0 },
    );

    const byCategory = this.groupMetrics(results, (r) => r.scenario.category);
    const byAgent = this.groupMetrics(results, (r) => r.scenario.agent);
    const byDifficulty = this.groupMetrics(results, (r) => r.scenario.difficulty ?? 'unspecified');

    return {
      totalScenarios: total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? passed / total : 0,
      avgLatencyMs,
      totalTokens,
      byCategory,
      byAgent,
      byDifficulty,
    };
  }

  private groupMetrics(
    results: EvalResult[],
    keyFn: (r: EvalResult) => string,
  ): Record<string, { total: number; passed: number; passRate: number }> {
    const groups: Record<string, { total: number; passed: number }> = {};

    for (const r of results) {
      const key = keyFn(r);
      if (!groups[key]) groups[key] = { total: 0, passed: 0 };
      groups[key].total++;
      if (r.passed) groups[key].passed++;
    }

    const result: Record<string, { total: number; passed: number; passRate: number }> = {};
    for (const [key, { total, passed: p }] of Object.entries(groups)) {
      result[key] = { total, passed: p, passRate: total > 0 ? p / total : 0 };
    }
    return result;
  }
}
