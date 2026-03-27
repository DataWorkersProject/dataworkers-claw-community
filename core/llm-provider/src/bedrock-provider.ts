/**
 * AWS Bedrock Provider Adapter
 *
 * Wraps @ai-sdk/amazon-bedrock via dynamic import.
 * Reads AWS_BEDROCK_REGION (or AWS_REGION) and standard AWS credentials from environment.
 */

import { VercelAIAdapter } from './vercel-ai-adapter.js';

export class BedrockProvider extends VercelAIAdapter {
  constructor(region?: string) {
    super({
      providerName: 'bedrock',
      defaultModel: 'anthropic.claude-sonnet-4-6-v1',
      apiKey: region, // reuse apiKey slot for region
      supportedModels: [
        'anthropic.claude-sonnet-4-6-v1',
        'anthropic.claude-haiku-4-5-v1',
        'amazon.nova-pro-v1',
      ],
      costPer1kInput: 0.003,
      costPer1kOutput: 0.015,
    });
  }

  static fromEnv(): BedrockProvider {
    return new BedrockProvider(process.env.AWS_BEDROCK_REGION ?? process.env.AWS_REGION);
  }

  protected override createModel(modelId: string): unknown {
    let bedrockFn: ((id: string) => unknown) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@ai-sdk/amazon-bedrock');
      bedrockFn = mod.bedrock ?? mod.default?.bedrock;
    } catch {
      throw new Error(
        "BedrockProvider: '@ai-sdk/amazon-bedrock' is not installed. " +
        'Install it with: npm install @ai-sdk/amazon-bedrock',
      );
    }
    if (!bedrockFn) {
      throw new Error("BedrockProvider: Could not resolve 'bedrock' export from @ai-sdk/amazon-bedrock.");
    }
    return bedrockFn(modelId);
  }

  override isAvailable(): boolean {
    return !!(process.env.AWS_BEDROCK_REGION ?? process.env.AWS_REGION);
  }
}
