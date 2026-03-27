/**
 * Google Vertex AI Provider Adapter
 *
 * Wraps @ai-sdk/google-vertex via dynamic import.
 * Reads GOOGLE_CLOUD_PROJECT and optional GOOGLE_CLOUD_LOCATION from environment.
 */

import { VercelAIAdapter } from './vercel-ai-adapter.js';

export class VertexProvider extends VercelAIAdapter {
  constructor(project?: string) {
    super({
      providerName: 'vertex',
      defaultModel: 'gemini-2.5-pro',
      apiKey: project,
      supportedModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
      costPer1kInput: 0.00125,
      costPer1kOutput: 0.005,
    });
  }

  static fromEnv(): VertexProvider {
    return new VertexProvider(process.env.GOOGLE_CLOUD_PROJECT);
  }

  protected override createModel(modelId: string): unknown {
    let vertexFn: ((id: string) => unknown) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@ai-sdk/google-vertex');
      vertexFn = mod.vertex ?? mod.default?.vertex;
    } catch {
      throw new Error(
        "VertexProvider: '@ai-sdk/google-vertex' is not installed. " +
        'Install it with: npm install @ai-sdk/google-vertex',
      );
    }
    if (!vertexFn) {
      throw new Error("VertexProvider: Could not resolve 'vertex' export from @ai-sdk/google-vertex.");
    }
    return vertexFn(modelId);
  }

  override isAvailable(): boolean {
    return !!process.env.GOOGLE_CLOUD_PROJECT;
  }
}
