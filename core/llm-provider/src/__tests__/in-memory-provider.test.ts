import { describe, it, expect } from 'vitest';
import { InMemoryLLMProvider } from '../in-memory-provider.js';

describe('InMemoryLLMProvider', () => {
  it('exports InMemoryLLMProvider class', () => {
    expect(InMemoryLLMProvider).toBeDefined();
  });

  it('has correct name and supported models', () => {
    const provider = new InMemoryLLMProvider();
    expect(provider.name).toBe('in-memory');
    expect(provider.supportedModels).toContain('stub-model');
  });

  it('completes a prompt', async () => {
    const provider = new InMemoryLLMProvider();
    const response = await provider.complete({ prompt: 'What is data quality?' });
    expect(response).toBeDefined();
    expect(typeof response.text).toBe('string');
    expect(response.text.length).toBeGreaterThan(0);
  });

  it('returns usage stats', async () => {
    const provider = new InMemoryLLMProvider();
    await provider.complete({ prompt: 'test' });
    const usage = provider.getUsage();
    expect(usage).toBeDefined();
    expect(typeof usage.totalRequests).toBe('number');
  });

  it('reports availability', () => {
    const provider = new InMemoryLLMProvider();
    expect(provider.isAvailable()).toBe(true);
  });
});
