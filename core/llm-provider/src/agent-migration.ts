/**
 * Agent Migration Helpers
 *
 * Utilities for migrating agents from the legacy ILLMClient interface
 * to the new ILLMProvider abstraction. Auto-detects available providers
 * from environment variables and creates appropriate instances.
 */

import type { ILLMProvider } from './types.js';
import { InMemoryLLMProvider } from './in-memory-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { BedrockProvider } from './bedrock-provider.js';
import { VertexProvider } from './vertex-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { AzureOpenAIProvider } from './azure-openai-provider.js';
import { ModelRouter } from './model-router.js';

/**
 * Auto-detect available provider from environment variables.
 * Returns the first available provider, or InMemoryLLMProvider as fallback.
 *
 * Detection order:
 * 1. ANTHROPIC_API_KEY → AnthropicProvider
 * 2. OPENAI_API_KEY → OpenAIProvider
 * 3. AWS_BEDROCK_REGION → BedrockProvider
 * 4. GOOGLE_CLOUD_PROJECT → VertexProvider
 * 5. OLLAMA_HOST → OllamaProvider
 * 6. AZURE_OPENAI_ENDPOINT → AzureOpenAIProvider
 * 7. (none) → InMemoryLLMProvider
 */
export function createProviderFromEnv(): ILLMProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return AnthropicProvider.fromEnv();
  }
  if (process.env.OPENAI_API_KEY) {
    return OpenAIProvider.fromEnv();
  }
  if (process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION) {
    return BedrockProvider.fromEnv();
  }
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return VertexProvider.fromEnv();
  }
  if (process.env.OLLAMA_HOST) {
    return OllamaProvider.fromEnv();
  }
  if (process.env.AZURE_OPENAI_ENDPOINT) {
    return AzureOpenAIProvider.fromEnv();
  }

  // Fallback to in-memory for development/testing
  return new InMemoryLLMProvider();
}

/**
 * Create a ModelRouter with all detected providers registered
 * and sensible default routing rules.
 */
export function createRouterFromEnv(): ModelRouter {
  const router = new ModelRouter();

  // Register all available providers
  const candidates: ILLMProvider[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    candidates.push(AnthropicProvider.fromEnv());
  }
  if (process.env.OPENAI_API_KEY) {
    candidates.push(OpenAIProvider.fromEnv());
  }
  if (process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION) {
    candidates.push(BedrockProvider.fromEnv());
  }
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    candidates.push(VertexProvider.fromEnv());
  }
  if (process.env.OLLAMA_HOST) {
    candidates.push(OllamaProvider.fromEnv());
  }
  if (process.env.AZURE_OPENAI_ENDPOINT) {
    candidates.push(AzureOpenAIProvider.fromEnv());
  }

  // Always include in-memory as last resort
  if (candidates.length === 0) {
    candidates.push(new InMemoryLLMProvider());
  }

  for (const provider of candidates) {
    router.registerProvider(provider);
  }

  router.seed();
  return router;
}
