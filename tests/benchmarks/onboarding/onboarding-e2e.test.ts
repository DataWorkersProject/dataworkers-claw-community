/**
 * End-to-end integration tests for onboarding features.
 *
 * Verifies: init config generation, connection testers with stubs,
 * factory auto-detection fallback, and CLI exports.
 */
import { describe, it, expect } from 'vitest';

// ── Test 1: init command generates valid configs ─────────────────────────────

import { generateMCPConfig } from '../../../packages/cli/src/commands/init.js';
import { generateNpxConfig } from '../../../packages/dw-claw/src/cli.js';

describe('init command', () => {
  it('generates monorepo MCP config with all agents', () => {
    const config = generateMCPConfig();
    expect(Object.keys(config.mcpServers).length).toBeGreaterThanOrEqual(9);
    // Each agent should have command and args
    for (const server of Object.values(config.mcpServers)) {
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

// NOTE: connection-tester tests for the real warehouse clients live in the
// private repo — the OSS enterprise-leak policy ('from.*real-client') keeps
// real client imports out of Community Edition.

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
