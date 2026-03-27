import { describe, it, expect } from 'vitest';
import { ProgressiveToolLoader } from '../tool-loader.js';
import type { ToolMetadata } from '../tool-loader.js';

function makeMeta(overrides?: Partial<ToolMetadata>): ToolMetadata {
  return {
    name: 'diagnose_incident',
    description: 'Diagnose an incident',
    agentId: 'dw-incidents',
    inputTypes: ['AnomalySignal'],
    outputTypes: ['Diagnosis'],
    ...overrides,
  };
}

describe('ProgressiveToolLoader', () => {
  describe('registerMetadata()', () => {
    it('registers a single tool metadata', () => {
      const loader = new ProgressiveToolLoader();
      loader.registerMetadata(makeMeta());

      expect(loader.getAvailableTools()).toHaveLength(1);
    });

    it('overwrites on duplicate name', () => {
      const loader = new ProgressiveToolLoader();
      loader.registerMetadata(makeMeta({ description: 'v1' }));
      loader.registerMetadata(makeMeta({ description: 'v2' }));

      const tools = loader.getAvailableTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('v2');
    });
  });

  describe('registerBulk()', () => {
    it('registers multiple tools at once', () => {
      const loader = new ProgressiveToolLoader();
      loader.registerBulk([
        makeMeta({ name: 'tool_a', agentId: 'agent-1' }),
        makeMeta({ name: 'tool_b', agentId: 'agent-1' }),
        makeMeta({ name: 'tool_c', agentId: 'agent-2' }),
      ]);

      expect(loader.getAvailableTools()).toHaveLength(3);
    });
  });

  describe('getAvailableTools()', () => {
    it('returns all tools when no agentId filter', () => {
      const loader = new ProgressiveToolLoader();
      loader.registerBulk([
        makeMeta({ name: 'tool_a', agentId: 'agent-1' }),
        makeMeta({ name: 'tool_b', agentId: 'agent-2' }),
      ]);

      expect(loader.getAvailableTools()).toHaveLength(2);
    });

    it('filters by agentId', () => {
      const loader = new ProgressiveToolLoader();
      loader.registerBulk([
        makeMeta({ name: 'tool_a', agentId: 'agent-1' }),
        makeMeta({ name: 'tool_b', agentId: 'agent-2' }),
        makeMeta({ name: 'tool_c', agentId: 'agent-1' }),
      ]);

      const filtered = loader.getAvailableTools('agent-1');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.agentId === 'agent-1')).toBe(true);
    });

    it('returns empty array for unknown agentId', () => {
      const loader = new ProgressiveToolLoader();
      loader.registerMetadata(makeMeta());

      expect(loader.getAvailableTools('unknown-agent')).toHaveLength(0);
    });
  });

  describe('loadFull()', () => {
    it('returns full definition for registered tool', async () => {
      const loader = new ProgressiveToolLoader();
      loader.registerMetadata(makeMeta({ name: 'my_tool' }));

      const full = await loader.loadFull('my_tool');
      expect(full).not.toBeNull();
      expect(full!.name).toBe('my_tool');
      expect(full!.inputSchema).toEqual({});
    });

    it('returns null for unknown tool', async () => {
      const loader = new ProgressiveToolLoader();
      const full = await loader.loadFull('nonexistent');
      expect(full).toBeNull();
    });

    it('caches loaded definitions', async () => {
      const loader = new ProgressiveToolLoader();
      loader.registerMetadata(makeMeta({ name: 'cached_tool' }));

      const first = await loader.loadFull('cached_tool');
      const second = await loader.loadFull('cached_tool');
      expect(first).toBe(second); // Same reference = cached

      const stats = loader.getStats();
      expect(stats.loaded).toBe(1); // Only loaded once
    });

    it('increments loadCount on each unique load', async () => {
      const loader = new ProgressiveToolLoader();
      loader.registerBulk([
        makeMeta({ name: 'tool_1' }),
        makeMeta({ name: 'tool_2' }),
      ]);

      await loader.loadFull('tool_1');
      await loader.loadFull('tool_2');
      await loader.loadFull('tool_1'); // cached, no increment

      const stats = loader.getStats();
      expect(stats.loaded).toBe(2);
    });
  });

  describe('getStats()', () => {
    it('returns zeros when empty', () => {
      const loader = new ProgressiveToolLoader();
      const stats = loader.getStats();

      expect(stats.registered).toBe(0);
      expect(stats.loaded).toBe(0);
      expect(stats.loadRatio).toBe(0);
    });

    it('computes correct load ratio', async () => {
      const loader = new ProgressiveToolLoader();
      loader.registerBulk([
        makeMeta({ name: 'tool_1' }),
        makeMeta({ name: 'tool_2' }),
        makeMeta({ name: 'tool_3' }),
        makeMeta({ name: 'tool_4' }),
      ]);

      await loader.loadFull('tool_1');
      await loader.loadFull('tool_2');

      const stats = loader.getStats();
      expect(stats.registered).toBe(4);
      expect(stats.loaded).toBe(2);
      expect(stats.loadRatio).toBe(0.5);
    });
  });
});
