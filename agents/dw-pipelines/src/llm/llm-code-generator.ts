/**
 * LLM-powered code generator — STRIPPED (OSS).
 *
 * LLM code generation requires Data Workers Pro.
 * Visit https://dataworkers.dev/pricing
 */

import type { ParsedPipelineIntent } from '../engine/nl-parser.js';

export interface CodeGenerationRequest {
  type: 'airflow-dag' | 'sql-model' | 'quality-test' | 'dagster-job' | 'prefect-flow';
  intent: ParsedPipelineIntent;
  context?: {
    columns?: string[];
    orchestrator?: string;
    existingCode?: string;
  };
}

export interface CodeGenerationResult {
  code: string;
  language: 'python' | 'sql' | 'yaml';
  tokensUsed?: { input: number; output: number; total: number; costUsd: number };
  fallbackUsed: boolean;
}

const PRO_MESSAGE = '# LLM code generation requires Data Workers Pro. Visit https://dataworkers.dev/pricing';

export class LLMCodeGenerator {
  constructor(_llmClient: unknown, _budgetLimit?: number) {}

  async generateCode(_request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    return {
      code: PRO_MESSAGE,
      language: 'python',
      fallbackUsed: true,
    };
  }

  getTotalSpent(): number {
    return 0;
  }

  getTemplateFallback(_request: CodeGenerationRequest): string {
    return PRO_MESSAGE;
  }
}
