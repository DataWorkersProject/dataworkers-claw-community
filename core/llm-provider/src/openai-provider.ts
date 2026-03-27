/**
 * OpenAI Provider Adapter
 *
 * Wraps @ai-sdk/openai via dynamic import.
 * Reads OPENAI_API_KEY from environment.
 */

import { VercelAIAdapter } from './vercel-ai-adapter.js';

export class OpenAIProvider extends VercelAIAdapter {
  constructor(apiKey?: string) {
    super({
      providerName: 'openai',
      defaultModel: 'gpt-4o',
      apiKey,
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
      costPer1kInput: 0.005,
      costPer1kOutput: 0.015,
    });
  }

  static fromEnv(): OpenAIProvider {
    return new OpenAIProvider(process.env.OPENAI_API_KEY);
  }

  protected override createModel(modelId: string): unknown {
    let openaiFn: ((id: string) => unknown) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@ai-sdk/openai');
      openaiFn = mod.openai ?? mod.default?.openai;
    } catch {
      throw new Error(
        "OpenAIProvider: '@ai-sdk/openai' is not installed. " +
        'Install it with: npm install @ai-sdk/openai',
      );
    }
    if (!openaiFn) {
      throw new Error("OpenAIProvider: Could not resolve 'openai' export from @ai-sdk/openai.");
    }
    return openaiFn(modelId);
  }

  override isAvailable(): boolean {
    return !!this.apiKey || !!process.env.OPENAI_API_KEY;
  }
}
