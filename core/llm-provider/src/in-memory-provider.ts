/**
 * In-Memory LLM Provider
 *
 * Backward-compatible test mock that implements ILLMProvider.
 * Uses pattern-matching for deterministic responses, mirroring the
 * existing InMemoryLLMClient from infrastructure-stubs.
 */

import type { ILLMProvider, LLMRequest, LLMResponse, ProviderUsage } from './types.js';

/** Cost per token (simulated, matching infrastructure-stubs). */
const COST_PER_INPUT_TOKEN = 0.000003;
const COST_PER_OUTPUT_TOKEN = 0.000015;

interface ResponsePattern {
  match: (prompt: string) => boolean;
  response: string;
  inputTokens: number;
  outputTokens: number;
}

export class InMemoryLLMProvider implements ILLMProvider {
  readonly name = 'in-memory';
  readonly supportedModels = ['stub-model'];

  private patterns: ResponsePattern[] = [];
  private usage: ProviderUsage = this.emptyUsage();

  constructor() {
    this.seedDefaultPatterns();
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    const lower = request.prompt.toLowerCase();
    const model = request.model ?? 'stub-model';

    let text: string;
    let inputTokens: number;
    let outputTokens: number;

    // Check custom patterns first (most recently added takes priority)
    const matched = [...this.patterns].reverse().find((p) => p.match(lower));

    if (matched) {
      text = matched.response;
      inputTokens = matched.inputTokens;
      outputTokens = matched.outputTokens;
    } else {
      // Default response
      text = 'I can help you with data pipeline tasks including parsing, generation, and optimization.';
      inputTokens = 300;
      outputTokens = 100;
    }

    // Respect maxTokens (approximate: 1 token ≈ 4 chars)
    if (request.maxTokens) {
      const maxChars = request.maxTokens * 4;
      if (text.length > maxChars) {
        text = text.slice(0, maxChars);
      }
    }

    const totalTokens = inputTokens + outputTokens;
    const inputCost = inputTokens * COST_PER_INPUT_TOKEN;
    const outputCost = outputTokens * COST_PER_OUTPUT_TOKEN;
    const totalCost = inputCost + outputCost;
    const latencyMs = Date.now() - start;

    // Track usage
    this.usage.totalRequests++;
    this.usage.totalTokens += totalTokens;
    this.usage.totalCost += totalCost;

    if (!this.usage.byModel[model]) {
      this.usage.byModel[model] = { requests: 0, tokens: 0, cost: 0 };
    }
    this.usage.byModel[model].requests++;
    this.usage.byModel[model].tokens += totalTokens;
    this.usage.byModel[model].cost += totalCost;

    return {
      text,
      model,
      provider: this.name,
      usage: { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens },
      latencyMs,
      cost: { inputCost, outputCost, totalCost },
      finishReason: 'stop',
    };
  }

  isAvailable(): boolean {
    return true;
  }

  getUsage(): ProviderUsage {
    return { ...this.usage, byModel: { ...this.usage.byModel } };
  }

  reset(): void {
    this.usage = this.emptyUsage();
  }

  /**
   * Add a custom response pattern.
   */
  addPattern(
    match: string | ((prompt: string) => boolean),
    response: string,
    inputTokens = 500,
    outputTokens = 200,
  ): void {
    const matchFn =
      typeof match === 'string'
        ? (prompt: string) => prompt.includes(match.toLowerCase())
        : match;
    this.patterns.push({ match: matchFn, response, inputTokens, outputTokens });
  }

  /**
   * Seed default patterns matching the original InMemoryLLMClient behavior
   * plus patterns for each agent use case.
   */
  seed(): void {
    this.patterns = [];
    this.seedDefaultPatterns();
  }

  /* ---------------------------------------------------------------- */
  /*  Private helpers                                                   */
  /* ---------------------------------------------------------------- */

  private seedDefaultPatterns(): void {
    // Pipeline parsing (matches InMemoryLLMClient)
    this.addPattern(
      (p) =>
        p.includes('parse pipeline') ||
        p.includes('parse the following') ||
        p.includes('pipeline description'),
      JSON.stringify({
        pipelineName: 'llm_parsed_pipeline',
        pattern: 'etl',
        sources: [{ platform: 'snowflake' }],
        targets: [{ platform: 'bigquery', writeMode: 'append' }],
        transformations: [{ type: 'custom', description: 'LLM-parsed transformation' }],
        schedule: { frequency: 'daily', cron: '0 0 * * *' },
        qualityChecks: ['schema', 'row_count'],
        confidence: 0.95,
        rawDescription: 'parsed pipeline',
      }),
      800,
      400,
    );

    // Code generation
    this.addPattern(
      'generate',
      '-- LLM-generated pipeline code\nSELECT * FROM source_table;',
      500,
      200,
    );

    // PII classification
    this.addPattern(
      'classify pii',
      JSON.stringify({
        columns: [
          { name: 'email', piiType: 'EMAIL', confidence: 0.98 },
          { name: 'ssn', piiType: 'SSN', confidence: 0.99 },
          { name: 'id', piiType: null, confidence: 0.05 },
        ],
      }),
      600,
      300,
    );

    // SQL translation
    this.addPattern(
      'translate sql',
      'SELECT col1, col2 FROM target_schema.target_table WHERE active = TRUE;',
      400,
      200,
    );

    // Incident analysis
    this.addPattern(
      'incident',
      JSON.stringify({
        severity: 'high',
        rootCause: 'Schema drift detected in upstream table',
        suggestedFix: 'Run schema migration to align columns',
        confidence: 0.88,
      }),
      700,
      350,
    );

    // Data quality
    this.addPattern(
      'quality',
      JSON.stringify({
        score: 0.92,
        issues: [
          { type: 'null_values', column: 'email', count: 15 },
          { type: 'format_mismatch', column: 'phone', count: 3 },
        ],
        recommendation: 'Add null checks and format validation',
      }),
      500,
      250,
    );

    // Schema analysis
    this.addPattern(
      'schema',
      JSON.stringify({
        compatibility: 'backward',
        changes: [
          { field: 'new_col', change: 'added', type: 'string' },
        ],
        risk: 'low',
      }),
      450,
      200,
    );

    // Governance / compliance
    this.addPattern(
      'governance',
      JSON.stringify({
        compliant: true,
        policies: ['data-retention', 'access-control'],
        violations: [],
      }),
      400,
      200,
    );

    // Cost optimization
    this.addPattern(
      'cost',
      JSON.stringify({
        currentCost: 1250.0,
        projectedSavings: 320.0,
        recommendations: [
          'Consolidate redundant pipelines',
          'Switch to spot instances for batch jobs',
        ],
      }),
      500,
      250,
    );

    // Migration
    this.addPattern(
      'migration',
      JSON.stringify({
        strategy: 'blue-green',
        steps: ['Provision target', 'Replicate data', 'Validate', 'Cutover'],
        estimatedDuration: '4 hours',
        rollbackPlan: 'Switch DNS back to source',
      }),
      600,
      300,
    );
  }

  private emptyUsage(): ProviderUsage {
    return { totalRequests: 0, totalTokens: 0, totalCost: 0, byModel: {} };
  }
}
