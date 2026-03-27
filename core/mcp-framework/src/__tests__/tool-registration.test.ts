import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGatedHandler, registerToolWithGate } from '../tool-registration.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

const readToolDef: ToolDefinition = {
  name: 'search_datasets',
  description: 'Search datasets (read-only)',
  inputSchema: { type: 'object', properties: {} },
};

const writeToolDef: ToolDefinition = {
  name: 'deploy_pipeline',
  description: 'Deploy a pipeline (write operation)',
  inputSchema: { type: 'object', properties: {} },
};

const adminToolDef: ToolDefinition = {
  name: 'resolve_pagerduty_alert',
  description: 'Resolve a PagerDuty alert (admin operation)',
  inputSchema: { type: 'object', properties: {} },
};

const dummyHandler: ToolHandler = async () => ({
  content: [{ type: 'text', text: 'ok' }],
});

describe('tool-registration gate', () => {
  let savedTier: string | undefined;

  beforeEach(() => {
    savedTier = process.env.DW_LICENSE_TIER;
  });

  afterEach(() => {
    if (savedTier === undefined) {
      delete process.env.DW_LICENSE_TIER;
    } else {
      process.env.DW_LICENSE_TIER = savedTier;
    }
  });

  describe('community tier', () => {
    beforeEach(() => {
      process.env.DW_LICENSE_TIER = 'community';
    });

    it('allows read tools', async () => {
      const gated = createGatedHandler(readToolDef, dummyHandler);
      const result = await gated({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('ok');
    });

    it('blocks write tools with upgrade message', async () => {
      const gated = createGatedHandler(writeToolDef, dummyHandler);
      const result = await gated({});
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toContain('pro');
      expect(data.upgrade).toBe('https://dataworkers.io/pricing');
      expect(data.tool).toBe('deploy_pipeline');
    });

    it('blocks admin tools with upgrade message', async () => {
      const gated = createGatedHandler(adminToolDef, dummyHandler);
      const result = await gated({});
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text!);
      expect(data.error).toContain('enterprise');
    });
  });

  describe('pro tier', () => {
    beforeEach(() => {
      process.env.DW_LICENSE_TIER = 'pro';
    });

    it('allows read tools', async () => {
      const gated = createGatedHandler(readToolDef, dummyHandler);
      const result = await gated({});
      expect(result.content[0].text).toBe('ok');
    });

    it('allows write tools', async () => {
      const gated = createGatedHandler(writeToolDef, dummyHandler);
      const result = await gated({});
      expect(result.content[0].text).toBe('ok');
    });

    it('blocks admin tools', async () => {
      const gated = createGatedHandler(adminToolDef, dummyHandler);
      const result = await gated({});
      expect(result.isError).toBe(true);
    });
  });

  describe('enterprise tier', () => {
    beforeEach(() => {
      process.env.DW_LICENSE_TIER = 'enterprise';
    });

    it('allows everything', async () => {
      for (const def of [readToolDef, writeToolDef, adminToolDef]) {
        const gated = createGatedHandler(def, dummyHandler);
        const result = await gated({});
        expect(result.content[0].text).toBe('ok');
      }
    });
  });

  describe('registerToolWithGate', () => {
    it('registers a gated handler on a server-like object', async () => {
      process.env.DW_LICENSE_TIER = 'community';
      let registeredHandler: ToolHandler | undefined;
      const fakeServer = {
        registerTool(def: ToolDefinition, handler: ToolHandler) {
          registeredHandler = handler;
        },
      };

      registerToolWithGate(fakeServer, writeToolDef, dummyHandler);
      expect(registeredHandler).toBeDefined();

      const result = await registeredHandler!({});
      expect(result.isError).toBe(true);
    });
  });
});
