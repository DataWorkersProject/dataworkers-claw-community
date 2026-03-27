/**
 * @data-workers/llm-provider — barrel exports
 *
 * Multi-provider LLM abstraction layer supporting Claude, OpenAI,
 * Bedrock, Vertex AI, Ollama, and Azure OpenAI.
 */

// Types
export type {
  LLMRequest,
  LLMResponse,
  LLMTool,
  ILLMProvider,
  ProviderUsage,
  ModelConfig,
  RoutingRule,
  CircuitBreakerConfig,
} from './types.js';

// In-memory provider
export { InMemoryLLMProvider } from './in-memory-provider.js';

// Vercel AI adapter base
export { VercelAIAdapter } from './vercel-ai-adapter.js';
export type { VercelAIAdapterConfig } from './vercel-ai-adapter.js';

// Provider adapters (, 294, 311-314)
export { AnthropicProvider } from './anthropic-provider.js';
export { OpenAIProvider } from './openai-provider.js';
export { BedrockProvider } from './bedrock-provider.js';
export { VertexProvider } from './vertex-provider.js';
export { OllamaProvider } from './ollama-provider.js';
export { AzureOpenAIProvider } from './azure-openai-provider.js';

// Model router
export { ModelRouter } from './model-router.js';

// Provider fallback + circuit breaker (/298)
export { ProviderFallback, CircuitBreaker } from './provider-fallback.js';

// Agent migration helpers
export { createProviderFromEnv, createRouterFromEnv } from './agent-migration.js';
