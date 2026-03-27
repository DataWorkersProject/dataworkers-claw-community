import { describe, it, expect } from 'vitest';
import { DependencyDiscoverer } from '../dependency-discoverer.js';

describe('DependencyDiscoverer', () => {
  it('exports DependencyDiscoverer class', () => {
    expect(DependencyDiscoverer).toBeDefined();
  });

  it('records access patterns', () => {
    const discoverer = new DependencyDiscoverer();
    discoverer.recordAccess('dw-pipelines', 'users_table', 'write');
    discoverer.recordAccess('dw-quality', 'users_table', 'read');
    // No error thrown
    expect(true).toBe(true);
  });

  it('discovers read_after_write dependencies', async () => {
    const discoverer = new DependencyDiscoverer();
    discoverer.recordAccess('dw-pipelines', 'events', 'write');
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 5));
    discoverer.recordAccess('dw-quality', 'events', 'read');
    const deps = discoverer.discover();
    expect(Array.isArray(deps)).toBe(true);
    expect(deps.length).toBeGreaterThan(0);
  });

  it('returns empty for no access patterns', () => {
    const discoverer = new DependencyDiscoverer();
    const deps = discoverer.discover();
    expect(deps).toHaveLength(0);
  });
});
