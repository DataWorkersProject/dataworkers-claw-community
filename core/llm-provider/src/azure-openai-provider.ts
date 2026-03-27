/**
 * Azure OpenAI Provider Adapter
 *
 * Wraps @ai-sdk/azure via dynamic import.
 * Reads AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY from environment.
 */

import { VercelAIAdapter } from './vercel-ai-adapter.js';

export class AzureOpenAIProvider extends VercelAIAdapter {
  private readonly endpoint?: string;

  constructor(endpoint?: string, apiKey?: string) {
    super({
      providerName: 'azure-openai',
      defaultModel: 'gpt-4o',
      apiKey,
      supportedModels: ['gpt-4o', 'gpt-4o-mini'],
      costPer1kInput: 0.005,
      costPer1kOutput: 0.015,
    });
    this.endpoint = endpoint;
  }

  static fromEnv(): AzureOpenAIProvider {
    return new AzureOpenAIProvider(
      process.env.AZURE_OPENAI_ENDPOINT,
      process.env.AZURE_OPENAI_API_KEY,
    );
  }

  protected override createModel(modelId: string): unknown {
    let azureFn: ((id: string) => unknown) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const mod = require('@ai-sdk/azure');
      azureFn = mod.azure ?? mod.default?.azure;
    } catch {
      throw new Error(
        "AzureOpenAIProvider: '@ai-sdk/azure' is not installed. " +
        'Install it with: npm install @ai-sdk/azure',
      );
    }
    if (!azureFn) {
      throw new Error("AzureOpenAIProvider: Could not resolve 'azure' export from @ai-sdk/azure.");
    }
    return azureFn(modelId);
  }

  override isAvailable(): boolean {
    return !!(this.endpoint ?? process.env.AZURE_OPENAI_ENDPOINT) &&
           !!(this.apiKey ?? process.env.AZURE_OPENAI_API_KEY);
  }
}
