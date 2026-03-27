/**
 * Prompt Chain Builder — STRIPPED (OSS).
 *
 * Prompt chain building requires Data Workers Pro.
 * Visit https://dataworkers.io/pricing
 */

import type { ParsedPipelineIntent } from '../engine/nl-parser.js';

export interface PromptChain {
  steps: PromptStep[];
  totalEstimatedTokens: number;
}

export interface PromptStep {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  fewShotExamples: FewShotExample[];
  maxTokens: number;
}

export interface FewShotExample {
  input: string;
  output: string;
  source: string;
  relevanceScore: number;
}

const PRO_MESSAGE = 'Prompt chain building requires Data Workers Pro. Visit https://dataworkers.io/pricing';

export class PromptChainBuilder {
  constructor(_maxContextTokens?: number) {}

  buildGenerationChain(
    _intent: ParsedPipelineIntent,
    _fewShotExamples?: FewShotExample[],
    _schemaContext?: string,
  ): PromptChain {
    return { steps: [], totalEstimatedTokens: 0 };
  }

  formatPrompt(step: PromptStep): { system: string; user: string } {
    return { system: PRO_MESSAGE, user: step.userPrompt };
  }
}
