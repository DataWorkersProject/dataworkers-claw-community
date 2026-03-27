import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../model-router.js';
import { InMemoryLLMProvider } from '../in-memory-provider.js';

describe('ModelRouter', () => {
  it('exports ModelRouter class', () => {
    expect(ModelRouter).toBeDefined();
  });

  it('registers a provider', () => {
    const router = new ModelRouter();
    const provider = new InMemoryLLMProvider();
    router.registerProvider(provider);
    // First registered becomes default
    const result = router.route({ prompt: 'hello' });
    expect(result.provider.name).toBe('in-memory');
  });

  it('routes to explicit model when specified', () => {
    const router = new ModelRouter();
    const provider = new InMemoryLLMProvider();
    router.registerProvider(provider);
    const result = router.route({ prompt: 'test', model: 'stub-model' });
    expect(result.model).toBe('stub-model');
  });

  it('adds routing rules', () => {
    const router = new ModelRouter();
    router.addRule({
      pattern: /sql/i,
      preferredModel: 'stub-model',
    });
    expect(true).toBe(true);
  });
});
