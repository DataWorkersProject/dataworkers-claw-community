import { describe, it, expect } from 'vitest';
import { AgentRegistry } from '../agent-registry.js';
import { InMemoryRelationalStore } from '@data-workers/infrastructure-stubs';

describe('AgentRegistry', () => {
  it('exports AgentRegistry class', () => {
    expect(AgentRegistry).toBeDefined();
  });

  it('creates and initializes registry', async () => {
    const store = new InMemoryRelationalStore();
    const registry = new AgentRegistry(store);
    await registry.init();
    expect(registry).toBeDefined();
  });

  it('registers an agent', async () => {
    const store = new InMemoryRelationalStore();
    const registry = new AgentRegistry(store);
    await registry.init();
    await registry.register({
      name: 'dw-pipelines',
      version: '1.0.0',
      status: 'active',
      capabilities: ['generate-pipeline', 'validate-pipeline'],
      registeredAt: Date.now(),
    } as any);
    const agent = await registry.getByName('dw-pipelines');
    expect(agent).toBeDefined();
  });
});
