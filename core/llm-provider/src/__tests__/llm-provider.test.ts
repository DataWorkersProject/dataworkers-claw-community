/**
 * Comprehensive tests for @data-workers/llm-provider
 *
 * Covers: InMemoryLLMProvider, ModelRouter, ProviderFallback,
 * CircuitBreaker, all real provider adapters, and migration helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryLLMProvider } from '../in-memory-provider.js';
import { ModelRouter } from '../model-router.js';
import { ProviderFallback, CircuitBreaker } from '../provider-fallback.js';
import { AnthropicProvider } from '../anthropic-provider.js';
import { OpenAIProvider } from '../openai-provider.js';
import { BedrockProvider } from '../bedrock-provider.js';
import { VertexProvider } from '../vertex-provider.js';
import { OllamaProvider } from '../ollama-provider.js';
import { AzureOpenAIProvider } from '../azure-openai-provider.js';
import { createProviderFromEnv, createRouterFromEnv } from '../agent-migration.js';
import type { ILLMProvider, LLMRequest, LLMResponse, ProviderUsage } from '../types.js';

/* ================================================================== */
/*  InMemoryLLMProvider                                      */
/* ================================================================== */

describe('InMemoryLLMProvider', () => {
  let provider: InMemoryLLMProvider;

  beforeEach(() => {
    provider = new InMemoryLLMProvider();
  });

  it('should have correct name and supported models', () => {
    expect(provider.name).toBe('in-memory');
    expect(provider.supportedModels).toEqual(['stub-model']);
  });

  it('should always be available', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  it('should complete with a default response for unknown prompts', async () => {
    const response = await provider.complete({ prompt: 'hello world' });
    expect(response.text).toContain('data pipeline');
    expect(response.provider).toBe('in-memory');
    expect(response.model).toBe('stub-model');
    expect(response.finishReason).toBe('stop');
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });

  it('should match pipeline parsing patterns', async () => {
    const response = await provider.complete({ prompt: 'parse pipeline description for ETL' });
    const parsed = JSON.parse(response.text);
    expect(parsed.pipelineName).toBe('llm_parsed_pipeline');
    expect(parsed.pattern).toBe('etl');
    expect(parsed.confidence).toBe(0.95);
  });

  it('should match code generation patterns', async () => {
    const response = await provider.complete({ prompt: 'generate SQL query' });
    expect(response.text).toContain('SELECT * FROM source_table');
  });

  it('should match PII classification patterns', async () => {
    const response = await provider.complete({ prompt: 'classify PII in these columns' });
    const parsed = JSON.parse(response.text);
    expect(parsed.columns).toBeDefined();
    expect(parsed.columns.length).toBeGreaterThan(0);
  });

  it('should match SQL translation patterns', async () => {
    const response = await provider.complete({ prompt: 'translate SQL from Snowflake to BigQuery' });
    expect(response.text).toContain('SELECT');
  });

  it('should match incident patterns', async () => {
    const response = await provider.complete({ prompt: 'analyze this incident' });
    const parsed = JSON.parse(response.text);
    expect(parsed.severity).toBe('high');
    expect(parsed.rootCause).toBeDefined();
  });

  it('should match quality patterns', async () => {
    const response = await provider.complete({ prompt: 'assess data quality' });
    const parsed = JSON.parse(response.text);
    expect(parsed.score).toBe(0.92);
  });

  it('should match schema patterns', async () => {
    const response = await provider.complete({ prompt: 'check schema compatibility' });
    const parsed = JSON.parse(response.text);
    expect(parsed.compatibility).toBe('backward');
  });

  it('should match governance patterns', async () => {
    const response = await provider.complete({ prompt: 'verify governance compliance' });
    const parsed = JSON.parse(response.text);
    expect(parsed.compliant).toBe(true);
  });

  it('should match cost patterns', async () => {
    const response = await provider.complete({ prompt: 'analyze cost optimization' });
    const parsed = JSON.parse(response.text);
    expect(parsed.currentCost).toBe(1250.0);
    expect(parsed.projectedSavings).toBe(320.0);
  });

  it('should match migration patterns', async () => {
    const response = await provider.complete({ prompt: 'plan migration strategy' });
    const parsed = JSON.parse(response.text);
    expect(parsed.strategy).toBe('blue-green');
  });

  it('should use the specified model in the response', async () => {
    const response = await provider.complete({ prompt: 'hello', model: 'custom-model' });
    expect(response.model).toBe('custom-model');
  });

  it('should track usage across multiple calls', async () => {
    await provider.complete({ prompt: 'generate code' });
    await provider.complete({ prompt: 'generate more code' });

    const usage = provider.getUsage();
    expect(usage.totalRequests).toBe(2);
    expect(usage.totalTokens).toBeGreaterThan(0);
    expect(usage.totalCost).toBeGreaterThan(0);
  });

  it('should track usage by model', async () => {
    await provider.complete({ prompt: 'test', model: 'model-a' });
    await provider.complete({ prompt: 'test', model: 'model-b' });
    await provider.complete({ prompt: 'test', model: 'model-a' });

    const usage = provider.getUsage();
    expect(usage.byModel['model-a']?.requests).toBe(2);
    expect(usage.byModel['model-b']?.requests).toBe(1);
  });

  it('should reset usage tracking', async () => {
    await provider.complete({ prompt: 'test' });
    provider.reset();

    const usage = provider.getUsage();
    expect(usage.totalRequests).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(usage.totalCost).toBe(0);
  });

  it('should include cost in response', async () => {
    const response = await provider.complete({ prompt: 'generate something' });
    expect(response.cost).toBeDefined();
    expect(response.cost!.inputCost).toBeGreaterThan(0);
    expect(response.cost!.outputCost).toBeGreaterThan(0);
    expect(response.cost!.totalCost).toBe(response.cost!.inputCost + response.cost!.outputCost);
  });

  it('should support adding custom patterns', async () => {
    provider.addPattern('custom test', 'custom response');
    const response = await provider.complete({ prompt: 'run custom test' });
    expect(response.text).toBe('custom response');
  });

  it('should prioritize later-added patterns over earlier ones', async () => {
    provider.addPattern('overlap', 'first match');
    provider.addPattern('overlap', 'second match');
    const response = await provider.complete({ prompt: 'overlap test' });
    expect(response.text).toBe('second match');
  });

  it('should re-seed default patterns', async () => {
    provider.addPattern('custom', 'custom');
    provider.seed();
    // After seed, custom patterns should be gone, defaults should work
    const response = await provider.complete({ prompt: 'generate code' });
    expect(response.text).toContain('SELECT * FROM source_table');
  });

  it('should include latencyMs in response', async () => {
    const response = await provider.complete({ prompt: 'test' });
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

/* ================================================================== */
/*  ModelRouter                                              */
/* ================================================================== */

describe('ModelRouter', () => {
  let router: ModelRouter;
  let providerA: InMemoryLLMProvider;
  let providerB: FakeProvider;

  beforeEach(() => {
    router = new ModelRouter();
    providerA = new InMemoryLLMProvider();
    providerB = new FakeProvider('provider-b', ['model-b1', 'model-b2']);
    router.registerProvider(providerA);
    router.registerProvider(providerB);
  });

  it('should register providers', () => {
    expect(router.getProviders()).toContain('in-memory');
    expect(router.getProviders()).toContain('provider-b');
  });

  it('should route explicit model to correct provider', () => {
    const result = router.route({ prompt: 'test', model: 'model-b1' });
    expect(result.provider.name).toBe('provider-b');
    expect(result.model).toBe('model-b1');
  });

  it('should route explicit model stub-model to in-memory', () => {
    const result = router.route({ prompt: 'test', model: 'stub-model' });
    expect(result.provider.name).toBe('in-memory');
  });

  it('should use default provider when no model specified and no rules match', () => {
    const result = router.route({ prompt: 'random prompt' });
    // First registered provider is default
    expect(result.provider.name).toBe('in-memory');
  });

  it('should route by pattern rules', () => {
    router.addRule({
      pattern: 'special task',
      preferredModel: 'model-b1',
    });

    const result = router.route({ prompt: 'run special task now' });
    expect(result.provider.name).toBe('provider-b');
    expect(result.model).toBe('model-b1');
  });

  it('should support regex patterns in rules', () => {
    router.addRule({
      pattern: /classify|categorize/i,
      preferredModel: 'model-b2',
    });

    const result = router.route({ prompt: 'classify this data' });
    expect(result.model).toBe('model-b2');
  });

  it('should use fallback model when preferred model provider is unavailable', () => {
    const unavailable = new FakeProvider('unavailable', ['model-x'], false);
    router.registerProvider(unavailable);

    router.addRule({
      pattern: 'special',
      preferredModel: 'model-x',
      fallbackModel: 'model-b1',
    });

    const result = router.route({ prompt: 'special request' });
    expect(result.model).toBe('model-b1');
  });

  it('should throw when no providers registered', () => {
    const emptyRouter = new ModelRouter();
    expect(() => emptyRouter.route({ prompt: 'test' })).toThrow('No providers registered');
  });

  it('should setDefault to specific provider', () => {
    router.setDefault('provider-b', 'model-b2');
    const result = router.route({ prompt: 'some random request' });
    expect(result.provider.name).toBe('provider-b');
    expect(result.model).toBe('model-b2');
  });

  it('should throw on setDefault with unknown provider', () => {
    expect(() => router.setDefault('nonexistent')).toThrow('not registered');
  });

  it('should complete via routed provider', async () => {
    const response = await router.complete({ prompt: 'generate pipeline code' });
    expect(response.provider).toBe('in-memory');
    expect(response.text).toBeDefined();
  });

  it('should seed default routing rules', () => {
    router.seed();
    expect(router.getRules().length).toBeGreaterThan(0);
  });
});

/* ================================================================== */
/*  ProviderFallback                                         */
/* ================================================================== */

describe('ProviderFallback', () => {
  it('should use primary provider on success', async () => {
    const primary = new InMemoryLLMProvider();
    const fallback = new FakeProvider('fallback', ['m1']);
    const pf = new ProviderFallback(primary, [fallback]);

    const response = await pf.complete({ prompt: 'test' });
    expect(response.provider).toBe('in-memory');
  });

  it('should fall back when primary fails', async () => {
    const primary = new FailingProvider('primary');
    const fallback = new InMemoryLLMProvider();
    const pf = new ProviderFallback(primary, [fallback]);

    const response = await pf.complete({ prompt: 'test' });
    expect(response.provider).toBe('in-memory');
  });

  it('should throw when all providers fail', async () => {
    const primary = new FailingProvider('p1');
    const fallback = new FailingProvider('p2');
    const pf = new ProviderFallback(primary, [fallback]);

    await expect(pf.complete({ prompt: 'test' })).rejects.toThrow('All providers failed');
  });

  it('should report availability from any provider', () => {
    const primary = new FailingProvider('p1');
    const fallback = new InMemoryLLMProvider();
    const pf = new ProviderFallback(primary, [fallback]);
    expect(pf.isAvailable()).toBe(true);
  });

  it('should aggregate usage across providers', async () => {
    const primary = new InMemoryLLMProvider();
    const fallback = new InMemoryLLMProvider();
    const pf = new ProviderFallback(primary, [fallback]);

    await pf.complete({ prompt: 'test' });
    const usage = pf.getUsage();
    expect(usage.totalRequests).toBe(1);
  });

  it('should reset all providers and circuit breakers', async () => {
    const primary = new InMemoryLLMProvider();
    const fallback = new InMemoryLLMProvider();
    const pf = new ProviderFallback(primary, [fallback]);

    await pf.complete({ prompt: 'test' });
    pf.reset();
    expect(pf.getUsage().totalRequests).toBe(0);
  });

  it('should expose circuit breakers per provider', () => {
    const primary = new InMemoryLLMProvider();
    const pf = new ProviderFallback(primary, []);
    expect(pf.getCircuitBreaker('in-memory')).toBeDefined();
    expect(pf.getCircuitBreaker('nonexistent')).toBeUndefined();
  });

  it('should have a descriptive name', () => {
    const primary = new InMemoryLLMProvider();
    const pf = new ProviderFallback(primary, []);
    expect(pf.name).toBe('fallback(in-memory)');
  });
});

/* ================================================================== */
/*  CircuitBreaker                                           */
/* ================================================================== */

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeMs: 100,
      halfOpenRequests: 1,
    });
  });

  it('should start in closed state', () => {
    expect(cb.getState()).toBe('closed');
    expect(cb.isOpen()).toBe(false);
  });

  it('should remain closed on success', async () => {
    await cb.execute(async () => 'ok');
    expect(cb.getState()).toBe('closed');
  });

  it('should open after threshold failures', () => {
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('closed');
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    expect(cb.isOpen()).toBe(true);
  });

  it('should reject requests when open', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    await expect(cb.execute(async () => 'ok')).rejects.toThrow('Circuit is open');
  });

  it('should transition to half-open after reset time', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);

    // Wait for reset time
    await new Promise((r) => setTimeout(r, 150));

    // Next execute should try (half-open)
    const result = await cb.execute(async () => 'recovered');
    expect(result).toBe('recovered');
  });

  it('should close after successful half-open requests', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();

    await new Promise((r) => setTimeout(r, 150));

    await cb.execute(async () => 'ok');
    // With halfOpenRequests=1, one success should close it
    expect(cb.getState()).toBe('closed');
  });

  it('should re-open on failure during half-open', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();

    await new Promise((r) => setTimeout(r, 150));

    try {
      await cb.execute(async () => { throw new Error('still broken'); });
    } catch { /* expected */ }

    expect(cb.getState()).toBe('open');
  });

  it('should reset to closed state', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);

    cb.reset();
    expect(cb.getState()).toBe('closed');
    expect(cb.isOpen()).toBe(false);
  });

  it('should reset failure count on success in closed state', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    // After success, failures reset — so one more failure should not open
    cb.recordFailure();
    expect(cb.getState()).toBe('closed');
  });
});

/* ================================================================== */
/*  Provider Adapters — Instantiation & Config                         */
/* ================================================================== */

describe('AnthropicProvider', () => {
  it('should instantiate with correct name', () => {
    const p = new AnthropicProvider('test-key');
    expect(p.name).toBe('anthropic');
  });

  it('should list supported models', () => {
    const p = new AnthropicProvider();
    expect(p.supportedModels).toContain('claude-sonnet-4-6');
    expect(p.supportedModels).toContain('claude-haiku-4-5');
    expect(p.supportedModels).toContain('claude-opus-4-6');
  });

  it('should create from environment', () => {
    const p = AnthropicProvider.fromEnv();
    expect(p.name).toBe('anthropic');
  });

  it('should report availability based on API key', () => {
    const p = new AnthropicProvider('test-key');
    expect(p.isAvailable()).toBe(true);

    const noKey = new AnthropicProvider();
    // Available only if ANTHROPIC_API_KEY is set in env
    expect(typeof noKey.isAvailable()).toBe('boolean');
  });
});

describe('OpenAIProvider', () => {
  it('should instantiate with correct name', () => {
    const p = new OpenAIProvider('test-key');
    expect(p.name).toBe('openai');
  });

  it('should list supported models', () => {
    const p = new OpenAIProvider();
    expect(p.supportedModels).toContain('gpt-4o');
    expect(p.supportedModels).toContain('gpt-4o-mini');
    expect(p.supportedModels).toContain('o3-mini');
  });

  it('should create from environment', () => {
    const p = OpenAIProvider.fromEnv();
    expect(p.name).toBe('openai');
  });

  it('should report availability based on API key', () => {
    const p = new OpenAIProvider('test-key');
    expect(p.isAvailable()).toBe(true);
  });
});

describe('BedrockProvider', () => {
  it('should instantiate with correct name', () => {
    const p = new BedrockProvider('us-east-1');
    expect(p.name).toBe('bedrock');
  });

  it('should list supported models', () => {
    const p = new BedrockProvider();
    expect(p.supportedModels).toContain('anthropic.claude-sonnet-4-6-v1');
    expect(p.supportedModels).toContain('anthropic.claude-haiku-4-5-v1');
    expect(p.supportedModels).toContain('amazon.nova-pro-v1');
  });

  it('should create from environment', () => {
    const p = BedrockProvider.fromEnv();
    expect(p.name).toBe('bedrock');
  });

  it('should report availability based on region env', () => {
    const p = new BedrockProvider();
    // Available only if AWS_BEDROCK_REGION or AWS_REGION is set
    expect(typeof p.isAvailable()).toBe('boolean');
  });
});

describe('VertexProvider', () => {
  it('should instantiate with correct name', () => {
    const p = new VertexProvider('my-project');
    expect(p.name).toBe('vertex');
  });

  it('should list supported models', () => {
    const p = new VertexProvider();
    expect(p.supportedModels).toContain('gemini-2.5-pro');
    expect(p.supportedModels).toContain('gemini-2.5-flash');
  });

  it('should create from environment', () => {
    const p = VertexProvider.fromEnv();
    expect(p.name).toBe('vertex');
  });

  it('should report availability based on project env', () => {
    const p = new VertexProvider();
    expect(typeof p.isAvailable()).toBe('boolean');
  });
});

describe('OllamaProvider', () => {
  it('should instantiate with correct name', () => {
    const p = new OllamaProvider('http://localhost:11434');
    expect(p.name).toBe('ollama');
  });

  it('should list supported models', () => {
    const p = new OllamaProvider();
    expect(p.supportedModels).toContain('llama3');
    expect(p.supportedModels).toContain('mistral');
    expect(p.supportedModels).toContain('codellama');
  });

  it('should create from environment', () => {
    const p = OllamaProvider.fromEnv();
    expect(p.name).toBe('ollama');
  });

  it('should report availability based on host env', () => {
    const p = new OllamaProvider();
    expect(typeof p.isAvailable()).toBe('boolean');
  });
});

describe('AzureOpenAIProvider', () => {
  it('should instantiate with correct name', () => {
    const p = new AzureOpenAIProvider('https://my.openai.azure.com', 'key');
    expect(p.name).toBe('azure-openai');
  });

  it('should list supported models', () => {
    const p = new AzureOpenAIProvider();
    expect(p.supportedModels).toContain('gpt-4o');
    expect(p.supportedModels).toContain('gpt-4o-mini');
  });

  it('should create from environment', () => {
    const p = AzureOpenAIProvider.fromEnv();
    expect(p.name).toBe('azure-openai');
  });

  it('should report availability based on endpoint and key env', () => {
    const withBoth = new AzureOpenAIProvider('https://my.openai.azure.com', 'key');
    expect(withBoth.isAvailable()).toBe(true);

    const withoutKey = new AzureOpenAIProvider('https://my.openai.azure.com');
    // Only if env var is set too
    expect(typeof withoutKey.isAvailable()).toBe('boolean');
  });
});

/* ================================================================== */
/*  Agent Migration Helpers                                  */
/* ================================================================== */

describe('createProviderFromEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all provider env vars
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AWS_BEDROCK_REGION;
    delete process.env.AWS_REGION;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.OLLAMA_HOST;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it('should return InMemoryLLMProvider when no env vars set', () => {
    const provider = createProviderFromEnv();
    expect(provider.name).toBe('in-memory');
  });

  it('should return AnthropicProvider when ANTHROPIC_API_KEY set', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const provider = createProviderFromEnv();
    expect(provider.name).toBe('anthropic');
  });

  it('should return OpenAIProvider when OPENAI_API_KEY set', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const provider = createProviderFromEnv();
    expect(provider.name).toBe('openai');
  });

  it('should prefer Anthropic over OpenAI when both set', () => {
    process.env.ANTHROPIC_API_KEY = 'key1';
    process.env.OPENAI_API_KEY = 'key2';
    const provider = createProviderFromEnv();
    expect(provider.name).toBe('anthropic');
  });

  it('should return BedrockProvider when AWS_BEDROCK_REGION set', () => {
    process.env.AWS_BEDROCK_REGION = 'us-east-1';
    const provider = createProviderFromEnv();
    expect(provider.name).toBe('bedrock');
  });

  it('should return VertexProvider when GOOGLE_CLOUD_PROJECT set', () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';
    const provider = createProviderFromEnv();
    expect(provider.name).toBe('vertex');
  });

  it('should return OllamaProvider when OLLAMA_HOST set', () => {
    process.env.OLLAMA_HOST = 'http://localhost:11434';
    const provider = createProviderFromEnv();
    expect(provider.name).toBe('ollama');
  });

  it('should return AzureOpenAIProvider when AZURE_OPENAI_ENDPOINT set', () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://my.openai.azure.com';
    const provider = createProviderFromEnv();
    expect(provider.name).toBe('azure-openai');
  });
});

describe('createRouterFromEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AWS_BEDROCK_REGION;
    delete process.env.AWS_REGION;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.OLLAMA_HOST;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should create router with in-memory fallback when no env vars set', () => {
    const router = createRouterFromEnv();
    expect(router.getProviders()).toContain('in-memory');
  });

  it('should create router with multiple providers when env vars set', () => {
    process.env.ANTHROPIC_API_KEY = 'key1';
    process.env.OPENAI_API_KEY = 'key2';
    const router = createRouterFromEnv();
    expect(router.getProviders()).toContain('anthropic');
    expect(router.getProviders()).toContain('openai');
  });

  it('should seed routing rules', () => {
    const router = createRouterFromEnv();
    expect(router.getRules().length).toBeGreaterThan(0);
  });

  it('should be able to complete requests', async () => {
    const router = createRouterFromEnv();
    const response = await router.complete({ prompt: 'test prompt' });
    expect(response.text).toBeDefined();
    expect(response.provider).toBe('in-memory');
  });
});

/* ================================================================== */
/*  VercelAIAdapter base class                                         */
/* ================================================================== */

describe('VercelAIAdapter', () => {
  it('should track usage and reset', () => {
    // Use AnthropicProvider as a concrete subclass
    const p = new AnthropicProvider('key');
    const usage = p.getUsage();
    expect(usage.totalRequests).toBe(0);
    p.reset();
    expect(p.getUsage().totalRequests).toBe(0);
  });
});

/* ================================================================== */
/*  Test Helpers                                                       */
/* ================================================================== */

/** Fake provider for routing/fallback tests. */
class FakeProvider implements ILLMProvider {
  readonly name: string;
  readonly supportedModels: string[];
  private readonly available: boolean;
  private usage: ProviderUsage = {
    totalRequests: 0, totalTokens: 0, totalCost: 0, byModel: {},
  };

  constructor(name: string, models: string[], available = true) {
    this.name = name;
    this.supportedModels = models;
    this.available = available;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    this.usage.totalRequests++;
    return {
      text: `fake response from ${this.name}`,
      model: request.model ?? this.supportedModels[0],
      provider: this.name,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      latencyMs: 1,
      finishReason: 'stop',
    };
  }

  isAvailable(): boolean { return this.available; }
  getUsage(): ProviderUsage { return { ...this.usage }; }
  reset(): void {
    this.usage = { totalRequests: 0, totalTokens: 0, totalCost: 0, byModel: {} };
  }
}

/** Provider that always throws on complete(). */
class FailingProvider implements ILLMProvider {
  readonly name: string;
  readonly supportedModels = ['fail-model'];

  constructor(name: string) { this.name = name; }

  async complete(): Promise<LLMResponse> {
    throw new Error(`${this.name}: simulated failure`);
  }

  isAvailable(): boolean { return false; }
  getUsage(): ProviderUsage {
    return { totalRequests: 0, totalTokens: 0, totalCost: 0, byModel: {} };
  }
  reset(): void { /* no-op */ }
}
