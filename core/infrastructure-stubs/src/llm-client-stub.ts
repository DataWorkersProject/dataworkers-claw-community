/**
 * In-memory LLM client stub for development and testing.
 * Returns deterministic responses based on prompt content.
 * Tracks token spend for budget enforcement.
 */

export interface LLMResponse {
  content: string;
  tokensUsed: { input: number; output: number };
  latencyMs: number;
}

export interface LLMCompleteOptions {
  maxTokens?: number;
  temperature?: number;
}

/** Cost per token (simulated). */
const COST_PER_INPUT_TOKEN = 0.000003;
const COST_PER_OUTPUT_TOKEN = 0.000015;

import type { ILLMClient } from './interfaces/index.js';

export class InMemoryLLMClient implements ILLMClient {
  private totalSpend = 0;
  private callCount = 0;

  /**
   * Send a completion request and return a deterministic response.
   * Responses are based on prompt content for predictable test behavior.
   */
  async complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMResponse> {
    const start = Date.now();
    void options;

    this.callCount++;

    let content: string;
    let inputTokens: number;
    let outputTokens: number;

    const lower = prompt.toLowerCase();

    if (lower.includes('parse pipeline') || lower.includes('parse the following') || lower.includes('pipeline description')) {
      // Return a structured ParsedPipelineIntent JSON
      content = JSON.stringify({
        pipelineName: 'llm_parsed_pipeline',
        pattern: 'etl',
        sources: [{ platform: 'snowflake' }],
        targets: [{ platform: 'bigquery', writeMode: 'append' }],
        transformations: [{ type: 'custom', description: 'LLM-parsed transformation' }],
        schedule: { frequency: 'daily', cron: '0 0 * * *' },
        qualityChecks: ['schema', 'row_count'],
        confidence: 0.95,
        rawDescription: prompt,
      });
      inputTokens = 800;
      outputTokens = 400;
    } else if (lower.includes('generate')) {
      // Return placeholder code
      content = '-- LLM-generated pipeline code\nSELECT * FROM source_table;';
      inputTokens = 500;
      outputTokens = 200;
    } else {
      // Default helpful response
      content = 'I can help you with data pipeline tasks including parsing, generation, and optimization.';
      inputTokens = 300;
      outputTokens = 100;
    }

    const cost = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN);
    this.totalSpend += cost;

    return {
      content,
      tokensUsed: { input: inputTokens, output: outputTokens },
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Get the total spend across all calls.
   */
  async getTotalSpend(): Promise<number> {
    return this.totalSpend;
  }

  /**
   * Get total number of calls made.
   */
  async getCallCount(): Promise<number> {
    return this.callCount;
  }

  /**
   * Reset spend and call tracking.
   */
  async reset(): Promise<void> {
    this.totalSpend = 0;
    this.callCount = 0;
  }

  /**
   * No-op seed for interface conformance.
   */
  seed(): void {
    // No seed data required for LLM client
  }
}
