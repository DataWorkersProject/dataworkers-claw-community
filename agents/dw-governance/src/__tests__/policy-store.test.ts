import { describe, it, expect } from 'vitest';
import { PolicyStore } from '../policy-store.js';
import { InMemoryRelationalStore } from '@data-workers/infrastructure-stubs';

describe('PolicyStore', () => {
  it('exports PolicyStore class', () => {
    expect(PolicyStore).toBeDefined();
  });

  it('creates instance with relational store', () => {
    const store = new InMemoryRelationalStore();
    const policyStore = new PolicyStore(store);
    expect(policyStore).toBeDefined();
  });
});
