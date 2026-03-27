/**
 * Ollama Local Provider Adapter
 *
 * Connects to a local Ollama instance for air-gapped deployments.
 * Wraps @ai-sdk/openai in OpenAI-compatible mode pointing at the Ollama host.
 * Reads OLLAMA_HOST from environment (defaults to http://localhost:11434).
 */

import { VercelAIAdapter } from './vercel-ai-adapter.js';

export class OllamaProvider extends VercelAIAdapter {
  private readonly host: string;

  constructor(host?: string) {
    const ollamaHost = host ?? 'http://localhost:11434';
    super({
      providerName: 'ollama',
      defaultModel: 'llama3',
      apiKey: 'ollama', // Ollama doesn't require a real key
      supportedModels: ['llama3', 'mistral', 'codellama'],
      costPer1kInput: 0, // local — no API cost
      costPer1kOutput: 0,
    });
    this.host = ollamaHost;
  }

  static fromEnv(): OllamaProvider {
    return new OllamaProvider(process.env.OLLAMA_HOST);
  }

  protected override createModel(modelId: string): unknown {
    let createOpenAICompatible: ((opts: Record<string, unknown>) => { chatModel: (id: string) => unknown }) | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const mod = require('@ai-sdk/openai-compatible');
      createOpenAICompatible = mod.createOpenAICompatible ?? mod.default?.createOpenAICompatible;
    } catch {
      throw new Error(
        "OllamaProvider: '@ai-sdk/openai-compatible' is not installed. " +
        'Install it with: npm install @ai-sdk/openai-compatible',
      );
    }
    if (!createOpenAICompatible) {
      throw new Error("OllamaProvider: Could not resolve 'createOpenAICompatible' from @ai-sdk/openai-compatible.");
    }
    const provider = createOpenAICompatible({
      name: 'ollama',
      baseURL: `${this.host}/v1`,
      apiKey: 'ollama',
    });
    return provider.chatModel(modelId);
  }

  override isAvailable(): boolean {
    // Ollama is available if OLLAMA_HOST is set or we assume localhost
    return !!process.env.OLLAMA_HOST;
  }
}
