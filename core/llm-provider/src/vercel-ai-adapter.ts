/**
 * Vercel AI SDK Base Adapter
 *
 * Base implementation that wraps Vercel AI SDK's generateText().
 * Provider-specific adapters configure the model provider while
 * this class handles the common request/response flow.
 *
 * Uses dynamic import() so the project compiles without the 'ai' package installed.
 */

import type { ILLMProvider, LLMRequest, LLMResponse, ProviderUsage } from './types.js';

export interface VercelAIAdapterConfig {
  providerName: string;
  defaultModel: string;
  apiKey?: string;
  supportedModels: string[];
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

export class VercelAIAdapter implements ILLMProvider {
  readonly name: string;
  readonly supportedModels: string[];

  protected readonly defaultModel: string;
  protected readonly apiKey?: string;
  protected readonly costPer1kInput: number;
  protected readonly costPer1kOutput: number;
  protected usage: ProviderUsage = this.emptyUsage();

  constructor(config: VercelAIAdapterConfig) {
    this.name = config.providerName;
    this.defaultModel = config.defaultModel;
    this.apiKey = config.apiKey;
    this.supportedModels = config.supportedModels;
    this.costPer1kInput = config.costPer1kInput ?? 0.003;
    this.costPer1kOutput = config.costPer1kOutput ?? 0.015;
  }

  /**
   * Override in subclasses to create the provider-specific model instance.
   * Should return an object compatible with Vercel AI SDK's model parameter.
   */
  protected createModel(_modelId: string): unknown {
    throw new Error(
      `${this.name}: createModel() must be overridden by a provider-specific subclass.`,
    );
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    const modelId = request.model ?? this.defaultModel;

    let generateText: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
    try {
      const aiModule = await import('ai');
      generateText = aiModule.generateText as typeof generateText;
    } catch {
      throw new Error(
        `${this.name}: The 'ai' package is not installed. Install it with: npm install ai`,
      );
    }

    const model = this.createModel(modelId);

    const opts: Record<string, unknown> = {
      model,
      prompt: request.prompt,
    };

    if (request.systemPrompt) opts.system = request.systemPrompt;
    if (request.maxTokens) opts.maxTokens = request.maxTokens;
    if (request.temperature !== undefined) opts.temperature = request.temperature;
    if (request.stopSequences) opts.stopSequences = request.stopSequences;

    const result = await generateText(opts);

    const text = (result.text as string) ?? '';
    const usageData = (result.usage as { promptTokens?: number; completionTokens?: number }) ?? {};
    const promptTokens = usageData.promptTokens ?? 0;
    const completionTokens = usageData.completionTokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const finishReason = this.mapFinishReason(result.finishReason as string);
    const latencyMs = Date.now() - start;

    const inputCost = (promptTokens / 1000) * this.costPer1kInput;
    const outputCost = (completionTokens / 1000) * this.costPer1kOutput;
    const totalCost = inputCost + outputCost;

    // Track usage
    this.usage.totalRequests++;
    this.usage.totalTokens += totalTokens;
    this.usage.totalCost += totalCost;

    if (!this.usage.byModel[modelId]) {
      this.usage.byModel[modelId] = { requests: 0, tokens: 0, cost: 0 };
    }
    this.usage.byModel[modelId].requests++;
    this.usage.byModel[modelId].tokens += totalTokens;
    this.usage.byModel[modelId].cost += totalCost;

    return {
      text,
      model: modelId,
      provider: this.name,
      usage: { promptTokens, completionTokens, totalTokens },
      latencyMs,
      cost: { inputCost, outputCost, totalCost },
      finishReason,
    };
  }

  isAvailable(): boolean {
    return !!this.apiKey || !!process.env[`${this.name.toUpperCase().replace(/-/g, '_')}_API_KEY`];
  }

  getUsage(): ProviderUsage {
    return { ...this.usage, byModel: { ...this.usage.byModel } };
  }

  reset(): void {
    this.usage = this.emptyUsage();
  }

  private mapFinishReason(reason: string | undefined): LLMResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool-calls':
      case 'tool_calls':
        return 'tool_call';
      default:
        return 'stop';
    }
  }

  private emptyUsage(): ProviderUsage {
    return { totalRequests: 0, totalTokens: 0, totalCost: 0, byModel: {} };
  }
}
