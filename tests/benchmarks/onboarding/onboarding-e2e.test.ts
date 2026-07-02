/**
 * End-to-end integration tests for onboarding features.
 *
 * Verifies: init config generation, connection testers with stubs,
 * factory auto-detection fallback, and CLI exports.
 */
import { describe, it, expect } from 'vitest';

// ── Test 1: init command generates valid configs ─────────────────────────────

import {
  generateMCPConfig,
  generateNpxConfig,
} from '../../../packages/cli/src/commands/init.js';

describe('init command', () => {
  it('generates monorepo MCP config with all agents', () => {
    const config = generateMCPConfig();
    expect(Object.keys(config.mcpServers).length).toBeGreaterThanOrEqual(9);
    // Each agent should have command and args
    for (const [_name, server] of Object.entries(config.mcpServers)) {
      expect(server.command).toBe('node');
      expect(server.args[0]).toContain('agents/');
    }
  });

  it('generates npx config with single data-workers entry', () => {
    const config = generateNpxConfig();
    expect(Object.keys(config.mcpServers)).toEqual(['data-workers']);
    expect(config.mcpServers['data-workers'].command).toBe('npx');
    expect(config.mcpServers['data-workers'].args).toContain('-y');
    expect(config.mcpServers['data-workers'].args).toContain('dw-claw');
  });
});

// ── Test 2: Connection testers work with stubs ───────────────────────────────

import { testSnowflakeConnection } from '../../../connectors/snowflake/src/test-connection.js';
import { testBigQueryConnection } from '../../../connectors/bigquery/src/test-connection.js';
import { testDatabricksConnection } from '../../../connectors/databricks/src/test-connection.js';

describe('connection testers', () => {
  it('snowflake stub connection succeeds', async () => {
    const result = await testSnowflakeConnection();
    expect(result.success).toBe(true);
    expect(result.provider).toBe('snowflake');
    expect(result.latencyMs).toBeLessThan(1000);
  });

  it('bigquery stub connection succeeds', async () => {
    const result = await testBigQueryConnection();
    expect(result.success).toBe(true);
    expect(result.provider).toBe('bigquery');
  });

  it('databricks stub connection succeeds', async () => {
    const result = await testDatabricksConnection();
    expect(result.success).toBe(true);
    expect(result.provider).toBe('databricks');
  });
});

// ── Test 3: Factory auto-detection returns InMemory by default ───────────────

import { createWarehouseConnector } from '../../../core/infrastructure-stubs/src/adapters/factory.js';

describe('factory auto-detection', () => {
  it('returns InMemory when no env vars set', async () => {
    // Save and clear env vars
    const saved = {
      SNOWFLAKE_ACCOUNT: process.env.SNOWFLAKE_ACCOUNT,
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
      GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
      DATABRICKS_HOST: process.env.DATABRICKS_HOST,
    };
    delete process.env.SNOWFLAKE_ACCOUNT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCP_PROJECT_ID;
    delete process.env.DATABRICKS_HOST;

    try {
      const connector = await createWarehouseConnector();
      expect(connector).toBeDefined();
      expect(typeof connector.seed).toBe('function');
    } finally {
      // Restore env vars
      for (const [key, value] of Object.entries(saved)) {
        if (value !== undefined) {
          process.env[key] = value;
        }
      }
    }
  });
});

// ── Test 4: CLI claw.ts exports and basic functions work ─────────────────────

import {
  AGENTS,
  TOTAL_AGENTS,
  TOTAL_TOOLS,
  resolveAgent,
} from '../../../packages/cli/src/claw.js';

describe('claw CLI', () => {
  it('exports agent registry', () => {
    expect(AGENTS.length).toBeGreaterThanOrEqual(9);
    expect(TOTAL_AGENTS).toBe(AGENTS.length);
    expect(TOTAL_TOOLS).toBeGreaterThan(100);
  });

  it('resolves agents by short name', () => {
    expect(resolveAgent('catalog')?.name).toBe('dw-context-catalog');
    expect(resolveAgent('pipelines')?.name).toBe('dw-pipelines');
    expect(resolveAgent('schema')?.name).toBe('dw-schema');
  });

  it('resolves agents by full name', () => {
    expect(resolveAgent('dw-pipelines')?.name).toBe('dw-pipelines');
  });

  it('returns undefined for unknown agents', () => {
    expect(resolveAgent('nonexistent')).toBeUndefined();
  });
});
