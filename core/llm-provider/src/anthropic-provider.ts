/**
 * Anthropic (Claude) Provider Adapter
 *
 * Wraps @ai-sdk/anthropic via dynamic import.
 * Reads ANTHROPIC_API_KEY from environment.
 */

import { VercelAIAdapter } from './vercel-ai-adapter.js';

export class AnthropicProvider extends VercelAIAdapter {
  constructor(apiKey?: string) {
    super({
      providerName: 'anthropic',
      defaultModel: 'claude-sonnet-4-6',
      apiKey,
      supportedModels: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6'],
      costPer1kInput: 0.003,
      costPer1kOutput: 0.015,
    });
  }

  static fromEnv(): AnthropicProvider {
    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  }

  protected override createModel(modelId: string): unknown {
    // Dynamic import handled at call time — this is called within complete()
    // which already catches import errors. We store a lazy reference.
    let anthropicFn: ((id: string) => unknown) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const mod = require('@ai-sdk/anthropic');
      anthropicFn = mod.anthropic ?? mod.default?.anthropic;
    } catch {
      throw new Error(
        "AnthropicProvider: '@ai-sdk/anthropic' is not installed. " +
        'Install it with: npm install @ai-sdk/anthropic',
      );
    }
    if (!anthropicFn) {
      throw new Error("AnthropicProvider: Could not resolve 'anthropic' export from @ai-sdk/anthropic.");
    }
    return anthropicFn(modelId);
  }

  override isAvailable(): boolean {
    return !!this.apiKey || !!process.env.ANTHROPIC_API_KEY;
  }
}
