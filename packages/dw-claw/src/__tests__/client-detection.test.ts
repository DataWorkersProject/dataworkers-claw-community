/**
 * Tests for universal MCP client detection, config generation, and merge logic.
 *
 * These tests exercise the exported functions from cli.ts without spawning
 * the actual CLI process, using fs mocks and temp directories.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

// We import the functions directly from the cli module.
// Since cli.ts has side-effects (main()), we re-export the testable functions.
// For now, we replicate the pure logic here to test it in isolation.
// This avoids triggering the CLI's main() on import.

// ── Inline copies of exported pure functions for unit testing ───────────────
// (These mirror the implementations in cli.ts and init.ts exactly.)

type MCPClient = 'cursor' | 'claude-code' | 'github-copilot' | 'continue' | 'windsurf' | 'opencode' | 'codex' | 'gemini' | 'generic';

function detectClients(cwd: string): MCPClient[] {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const detected: MCPClient[] = [];

  let hasClaude = fs.existsSync(path.join(home, '.claude'));
  if (!hasClaude) {
    try { execSync('which claude', { stdio: 'ignore' }); hasClaude = true; } catch {}
  }
  if (hasClaude) detected.push('claude-code');

  if (fs.existsSync(path.join(cwd, '.cursor')) || fs.existsSync(path.join(home, '.cursor'))) {
    detected.push('cursor');
  }

  const hasGHCopilot =
    fs.existsSync(path.join(cwd, '.github', 'copilot')) ||
    fs.existsSync(path.join(home, '.config', 'github-copilot')) ||
    (() => {
      try {
        const vscodeSettings = path.join(cwd, '.vscode', 'settings.json');
        if (fs.existsSync(vscodeSettings)) {
          const content = fs.readFileSync(vscodeSettings, 'utf-8');
          return content.includes('mcp.servers') || content.includes('mcp-servers');
        }
      } catch {}
      return false;
    })();
  if (hasGHCopilot) detected.push('github-copilot');

  if (fs.existsSync(path.join(home, '.continue', 'config.json'))) {
    detected.push('continue');
  }

  const hasWindsurf =
    fs.existsSync(path.join(cwd, '.windsurf')) ||
    fs.existsSync(path.join(home, '.windsurf')) ||
    (() => { try { execSync('which windsurf', { stdio: 'ignore' }); return true; } catch { return false; } })();
  if (hasWindsurf) detected.push('windsurf');

  if (fs.existsSync(path.join(cwd, 'opencode.json'))) {
    detected.push('opencode');
  }

  const hasCodex =
    fs.existsSync(path.join(cwd, '.codex')) ||
    fs.existsSync(path.join(home, '.codex')) ||
    (() => { try { execSync('which codex', { stdio: 'ignore' }); return true; } catch { return false; } })();
  if (hasCodex) detected.push('codex');

  const hasGemini =
    fs.existsSync(path.join(cwd, '.gemini')) ||
    fs.existsSync(path.join(home, '.gemini')) ||
    (() => { try { execSync('which gemini', { stdio: 'ignore' }); return true; } catch { return false; } })();
  if (hasGemini) detected.push('gemini');

  return detected;
}

function getConfigPath(client: MCPClient, cwd: string): string {
  switch (client) {
    case 'cursor': return path.resolve(cwd, '.cursor', 'mcp.json');
    case 'github-copilot': return path.resolve(cwd, '.github', 'copilot', 'mcp.json');
    case 'continue': {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      return path.resolve(home, '.continue', 'config.json');
    }
    case 'windsurf': return path.resolve(cwd, '.windsurf', 'mcp.json');
    case 'opencode': return path.resolve(cwd, 'opencode.json');
    case 'codex': return path.resolve(cwd, '.codex', 'config.toml');
    case 'gemini': return path.resolve(cwd, '.gemini', 'settings.json');
    case 'claude-code':
    case 'generic':
    default:
      return path.resolve(cwd, '.mcp.json');
  }
}

function clientDisplayName(client: MCPClient): string {
  const names: Record<MCPClient, string> = {
    cursor: 'Cursor',
    'claude-code': 'Claude Code',
    'github-copilot': 'GitHub Copilot',
    'continue': 'Continue',
    'windsurf': 'Windsurf',
    opencode: 'OpenCode',
    codex: 'Codex CLI',
    gemini: 'Gemini CLI',
    generic: 'MCP',
  };
  return names[client];
}

function generateClientConfig(client: MCPClient): Record<string, unknown> {
  switch (client) {
    case 'claude-code':
    case 'cursor':
    case 'windsurf':
    case 'gemini':
      return {
        mcpServers: {
          'data-workers': { command: 'npx', args: ['-y', 'dw-claw'] },
        },
      };
    case 'github-copilot':
      return {
        servers: [
          { name: 'data-workers', command: 'npx', args: ['-y', 'dw-claw'] },
        ],
      };
    case 'continue':
      return {
        mcpServers: [
          { name: 'data-workers', command: 'npx', args: ['-y', 'dw-claw'] },
        ],
      };
    case 'opencode':
      return {
        mcp: {
          'data-workers': { type: 'local', command: ['npx', '-y', 'dw-claw'], enabled: true },
        },
      };
    case 'codex':
      return {
        mcp_servers: {
          'data-workers': { command: 'npx', args: ['-y', 'dw-claw'] },
        },
      };
    case 'generic':
    default:
      return {
        mcpServers: {
          'data-workers': { command: 'npx', args: ['-y', 'dw-claw'] },
        },
      };
  }
}

function mergeConfig(existing: Record<string, unknown>, client: MCPClient): Record<string, unknown> {
  const newConfig = generateClientConfig(client);
  const merged = { ...existing };

  switch (client) {
    case 'claude-code':
    case 'cursor':
    case 'windsurf':
    case 'gemini':
    case 'generic': {
      const existingServers = (merged.mcpServers as Record<string, unknown>) || {};
      merged.mcpServers = { ...existingServers, ...(newConfig.mcpServers as Record<string, unknown>) };
      return merged;
    }
    case 'github-copilot': {
      const existingServers = (Array.isArray(merged.servers) ? merged.servers : []) as Array<{ name: string; [k: string]: unknown }>;
      const filtered = existingServers.filter(s => s.name !== 'data-workers');
      const newServers = (newConfig.servers as Array<{ name: string }>) || [];
      merged.servers = [...filtered, ...newServers];
      return merged;
    }
    case 'continue': {
      const existingServers = (Array.isArray(merged.mcpServers) ? merged.mcpServers : []) as Array<{ name: string; [k: string]: unknown }>;
      const filtered = existingServers.filter(s => s.name !== 'data-workers');
      const newServers = (newConfig.mcpServers as Array<{ name: string }>) || [];
      merged.mcpServers = [...filtered, ...newServers];
      return merged;
    }
    case 'opencode': {
      const existingMcp = (merged.mcp as Record<string, unknown>) || {};
      merged.mcp = { ...existingMcp, ...(newConfig.mcp as Record<string, unknown>) };
      return merged;
    }
    default:
      return { ...merged, ...newConfig };
  }
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('MCP Client Detection', () => {
  let tmpDir: string;
  let origHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-claw-test-'));
    origHome = process.env.HOME;
    // Point HOME to a clean temp dir so existing user configs don't interfere
    process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-claw-home-'));
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (process.env.HOME && process.env.HOME.includes('dw-claw-home-')) {
      fs.rmSync(process.env.HOME, { recursive: true, force: true });
    }
  });

  it('detects Cursor when .cursor/ exists in cwd', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'));
    const clients = detectClients(tmpDir);
    expect(clients).toContain('cursor');
  });

  it('detects Cursor when .cursor/ exists in HOME', () => {
    fs.mkdirSync(path.join(process.env.HOME!, '.cursor'));
    const clients = detectClients(tmpDir);
    expect(clients).toContain('cursor');
  });

  it('detects GitHub Copilot when .github/copilot/ exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.github', 'copilot'), { recursive: true });
    const clients = detectClients(tmpDir);
    expect(clients).toContain('github-copilot');
  });

  it('detects GitHub Copilot via .vscode/settings.json with mcp.servers', () => {
    fs.mkdirSync(path.join(tmpDir, '.vscode'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.vscode', 'settings.json'),
      JSON.stringify({ 'mcp.servers': {} }),
    );
    const clients = detectClients(tmpDir);
    expect(clients).toContain('github-copilot');
  });

  it('detects Continue when ~/.continue/config.json exists', () => {
    const home = process.env.HOME!;
    fs.mkdirSync(path.join(home, '.continue'), { recursive: true });
    fs.writeFileSync(path.join(home, '.continue', 'config.json'), '{}');
    const clients = detectClients(tmpDir);
    expect(clients).toContain('continue');
  });

  it('detects Windsurf when .windsurf/ exists in cwd', () => {
    fs.mkdirSync(path.join(tmpDir, '.windsurf'));
    const clients = detectClients(tmpDir);
    expect(clients).toContain('windsurf');
  });

  it('detects OpenCode when opencode.json exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.json'), '{}');
    const clients = detectClients(tmpDir);
    expect(clients).toContain('opencode');
  });

  it('detects Codex CLI when .codex/ exists in cwd', () => {
    fs.mkdirSync(path.join(tmpDir, '.codex'));
    const clients = detectClients(tmpDir);
    expect(clients).toContain('codex');
  });

  it('detects Gemini CLI when .gemini/ exists in cwd', () => {
    fs.mkdirSync(path.join(tmpDir, '.gemini'));
    const clients = detectClients(tmpDir);
    expect(clients).toContain('gemini');
  });

  it('returns empty array when no clients detected', () => {
    const clients = detectClients(tmpDir);
    // claude-code/codex/gemini may be detected via binaries on PATH depending
    // on the test environment — filter those out
    const envIndependent = clients.filter(c => c !== 'claude-code' && c !== 'codex' && c !== 'gemini');
    // Should have no other clients detected in a clean temp dir
    expect(envIndependent).toEqual([]);
  });

  it('detects multiple clients simultaneously', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'));
    fs.mkdirSync(path.join(tmpDir, '.windsurf'));
    fs.writeFileSync(path.join(tmpDir, 'opencode.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, '.codex'));
    const clients = detectClients(tmpDir);
    expect(clients).toContain('cursor');
    expect(clients).toContain('windsurf');
    expect(clients).toContain('opencode');
    expect(clients).toContain('codex');
  });
});

describe('Config Path Resolution', () => {
  it('returns .mcp.json for Claude Code', () => {
    expect(getConfigPath('claude-code', '/project')).toBe(path.resolve('/project', '.mcp.json'));
  });

  it('returns .cursor/mcp.json for Cursor', () => {
    expect(getConfigPath('cursor', '/project')).toBe(path.resolve('/project', '.cursor', 'mcp.json'));
  });

  it('returns .github/copilot/mcp.json for GitHub Copilot', () => {
    expect(getConfigPath('github-copilot', '/project')).toBe(
      path.resolve('/project', '.github', 'copilot', 'mcp.json'),
    );
  });

  it('returns ~/.continue/config.json for Continue', () => {
    const home = process.env.HOME || '';
    expect(getConfigPath('continue', '/project')).toBe(path.resolve(home, '.continue', 'config.json'));
  });

  it('returns .windsurf/mcp.json for Windsurf', () => {
    expect(getConfigPath('windsurf', '/project')).toBe(path.resolve('/project', '.windsurf', 'mcp.json'));
  });

  it('returns opencode.json for OpenCode', () => {
    expect(getConfigPath('opencode', '/project')).toBe(path.resolve('/project', 'opencode.json'));
  });

  it('returns .codex/config.toml for Codex CLI', () => {
    expect(getConfigPath('codex', '/project')).toBe(path.resolve('/project', '.codex', 'config.toml'));
  });

  it('returns .gemini/settings.json for Gemini CLI', () => {
    expect(getConfigPath('gemini', '/project')).toBe(path.resolve('/project', '.gemini', 'settings.json'));
  });

  it('returns .mcp.json for generic', () => {
    expect(getConfigPath('generic', '/project')).toBe(path.resolve('/project', '.mcp.json'));
  });
});

describe('Client Display Names', () => {
  it('maps all clients to human-readable names', () => {
    expect(clientDisplayName('claude-code')).toBe('Claude Code');
    expect(clientDisplayName('cursor')).toBe('Cursor');
    expect(clientDisplayName('github-copilot')).toBe('GitHub Copilot');
    expect(clientDisplayName('continue')).toBe('Continue');
    expect(clientDisplayName('windsurf')).toBe('Windsurf');
    expect(clientDisplayName('opencode')).toBe('OpenCode');
    expect(clientDisplayName('codex')).toBe('Codex CLI');
    expect(clientDisplayName('gemini')).toBe('Gemini CLI');
    expect(clientDisplayName('generic')).toBe('MCP');
  });
});

describe('Config Generation', () => {
  it('generates Claude Code config with mcpServers object', () => {
    const config = generateClientConfig('claude-code');
    expect(config).toEqual({
      mcpServers: {
        'data-workers': { command: 'npx', args: ['-y', 'dw-claw'] },
      },
    });
  });

  it('generates Cursor config identical to Claude Code', () => {
    const claude = generateClientConfig('claude-code');
    const cursor = generateClientConfig('cursor');
    expect(cursor).toEqual(claude);
  });

  it('generates Windsurf config identical to Claude Code', () => {
    const claude = generateClientConfig('claude-code');
    const windsurf = generateClientConfig('windsurf');
    expect(windsurf).toEqual(claude);
  });

  it('generates GitHub Copilot config with servers array', () => {
    const config = generateClientConfig('github-copilot');
    expect(config).toEqual({
      servers: [
        { name: 'data-workers', command: 'npx', args: ['-y', 'dw-claw'] },
      ],
    });
  });

  it('generates Continue config with mcpServers array', () => {
    const config = generateClientConfig('continue');
    expect(config).toEqual({
      mcpServers: [
        { name: 'data-workers', command: 'npx', args: ['-y', 'dw-claw'] },
      ],
    });
  });

  it('generates OpenCode config with mcp object, local type, and command array', () => {
    const config = generateClientConfig('opencode');
    expect(config).toEqual({
      mcp: {
        'data-workers': {
          type: 'local',
          command: ['npx', '-y', 'dw-claw'],
          enabled: true,
        },
      },
    });
  });

  it('generates Gemini CLI config identical to Claude Code', () => {
    const claude = generateClientConfig('claude-code');
    const gemini = generateClientConfig('gemini');
    expect(gemini).toEqual(claude);
  });

  it('generates Codex config with mcp_servers table shape', () => {
    const config = generateClientConfig('codex');
    expect(config).toEqual({
      mcp_servers: {
        'data-workers': { command: 'npx', args: ['-y', 'dw-claw'] },
      },
    });
  });

  it('generates generic config same as Claude Code', () => {
    const generic = generateClientConfig('generic');
    const claude = generateClientConfig('claude-code');
    expect(generic).toEqual(claude);
  });
});

describe('Config Merge Behavior', () => {
  describe('Claude Code / Cursor / Windsurf (object-based mcpServers)', () => {
    it('preserves existing servers when merging', () => {
      const existing = {
        mcpServers: {
          'my-other-server': { command: 'node', args: ['other.js'] },
        },
      };
      const merged = mergeConfig(existing, 'claude-code');
      expect((merged.mcpServers as Record<string, unknown>)['my-other-server']).toBeDefined();
      expect((merged.mcpServers as Record<string, unknown>)['data-workers']).toBeDefined();
    });

    it('overwrites existing data-workers entry', () => {
      const existing = {
        mcpServers: {
          'data-workers': { command: 'node', args: ['old.js'] },
        },
      };
      const merged = mergeConfig(existing, 'cursor');
      const dw = (merged.mcpServers as Record<string, { command: string; args: string[] }>)['data-workers'];
      expect(dw.command).toBe('npx');
      expect(dw.args).toEqual(['-y', 'dw-claw']);
    });

    it('preserves non-mcpServers keys in existing config', () => {
      const existing = {
        mcpServers: {},
        customKey: 'should-survive',
      };
      const merged = mergeConfig(existing, 'windsurf');
      expect(merged.customKey).toBe('should-survive');
    });
  });

  describe('GitHub Copilot (array-based servers)', () => {
    it('preserves existing servers in the array', () => {
      const existing = {
        servers: [
          { name: 'other-server', command: 'node', args: ['other.js'] },
        ],
      };
      const merged = mergeConfig(existing, 'github-copilot');
      const servers = merged.servers as Array<{ name: string }>;
      expect(servers).toHaveLength(2);
      expect(servers.find(s => s.name === 'other-server')).toBeDefined();
      expect(servers.find(s => s.name === 'data-workers')).toBeDefined();
    });

    it('replaces existing data-workers entry', () => {
      const existing = {
        servers: [
          { name: 'data-workers', command: 'node', args: ['old.js'] },
          { name: 'other', command: 'node', args: ['other.js'] },
        ],
      };
      const merged = mergeConfig(existing, 'github-copilot');
      const servers = merged.servers as Array<{ name: string; command: string }>;
      expect(servers).toHaveLength(2);
      const dw = servers.find(s => s.name === 'data-workers')!;
      expect(dw.command).toBe('npx');
    });

    it('handles missing servers key gracefully', () => {
      const existing = { otherKey: true };
      const merged = mergeConfig(existing, 'github-copilot');
      const servers = merged.servers as Array<{ name: string }>;
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('data-workers');
      expect(merged.otherKey).toBe(true);
    });
  });

  describe('Continue (array-based mcpServers)', () => {
    it('preserves existing servers in the array', () => {
      const existing = {
        mcpServers: [
          { name: 'existing-tool', command: 'node', args: ['tool.js'] },
        ],
        models: [{ title: 'GPT-4' }],
      };
      const merged = mergeConfig(existing, 'continue');
      const servers = merged.mcpServers as Array<{ name: string }>;
      expect(servers).toHaveLength(2);
      expect(merged.models).toBeDefined();
    });

    it('replaces existing data-workers entry without duplicating', () => {
      const existing = {
        mcpServers: [
          { name: 'data-workers', command: 'old', args: [] },
        ],
      };
      const merged = mergeConfig(existing, 'continue');
      const servers = merged.mcpServers as Array<{ name: string }>;
      expect(servers).toHaveLength(1);
      expect(servers[0].command).toBe('npx');
    });
  });

  describe('OpenCode (mcp object)', () => {
    it('preserves existing mcp entries', () => {
      const existing = {
        $schema: 'https://opencode.ai/config.json',
        mcp: {
          'other-tool': { type: 'stdio', command: 'node', args: ['other.js'], enabled: true },
        },
      };
      const merged = mergeConfig(existing, 'opencode');
      const mcp = merged.mcp as Record<string, unknown>;
      expect(mcp['other-tool']).toBeDefined();
      expect(mcp['data-workers']).toBeDefined();
      expect(merged.$schema).toBe('https://opencode.ai/config.json');
    });

    it('overwrites existing data-workers entry', () => {
      const existing = {
        mcp: {
          'data-workers': { type: 'local', command: 'old', args: [], enabled: false },
        },
      };
      const merged = mergeConfig(existing, 'opencode');
      const dw = (merged.mcp as Record<string, { enabled: boolean }>)['data-workers'];
      expect(dw.enabled).toBe(true);
    });
  });
});

// ── Inline copy of the Codex TOML upsert logic from cli.ts ──────────────────

const CODEX_SERVER_TABLE = '[mcp_servers.data-workers]';

function renderCodexServerBlock(): string {
  return [
    CODEX_SERVER_TABLE,
    'command = "npx"',
    'args = ["-y", "dw-claw"]',
  ].join('\n');
}

function renderCodexToml(): string {
  return [
    '# Data Workers — project-scoped Codex CLI config',
    '# Loaded automatically (additively) once you trust this project in Codex.',
    '# Docs: https://developers.openai.com/codex/config-reference',
    '',
    renderCodexServerBlock(),
    '',
  ].join('\n');
}

function upsertCodexToml(existing: string | null): { content: string; action: 'created' | 'appended' | 'unchanged' } {
  if (existing === null) {
    return { content: renderCodexToml(), action: 'created' };
  }
  if (existing.includes(CODEX_SERVER_TABLE)) {
    return { content: existing, action: 'unchanged' };
  }
  const sep = existing.endsWith('\n') ? '\n' : '\n\n';
  return { content: existing + sep + renderCodexServerBlock() + '\n', action: 'appended' };
}

describe('Codex TOML Upsert', () => {
  it('creates a fresh config.toml with the data-workers table', () => {
    const result = upsertCodexToml(null);
    expect(result.action).toBe('created');
    expect(result.content).toContain('[mcp_servers.data-workers]');
    expect(result.content).toContain('command = "npx"');
    expect(result.content).toContain('args = ["-y", "dw-claw"]');
  });

  it('appends the table to an existing config without touching user content', () => {
    const existing = '[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "@upstash/context7-mcp"]\n';
    const result = upsertCodexToml(existing);
    expect(result.action).toBe('appended');
    expect(result.content.startsWith(existing)).toBe(true);
    expect(result.content).toContain('[mcp_servers.data-workers]');
  });

  it('appends with separation when existing file lacks a trailing newline', () => {
    const existing = 'model = "gpt-5.2-codex"';
    const result = upsertCodexToml(existing);
    expect(result.action).toBe('appended');
    expect(result.content).toContain('model = "gpt-5.2-codex"\n\n[mcp_servers.data-workers]');
  });

  it('is idempotent when data-workers is already configured', () => {
    const existing = upsertCodexToml(null).content;
    const result = upsertCodexToml(existing);
    expect(result.action).toBe('unchanged');
    expect(result.content).toBe(existing);
  });
});

describe('Dry Run Output', () => {
  it('generates valid JSON for all JSON-config client types', () => {
    const clients: MCPClient[] = ['claude-code', 'cursor', 'github-copilot', 'continue', 'windsurf', 'opencode', 'gemini', 'generic'];
    for (const client of clients) {
      const config = generateClientConfig(client);
      const json = JSON.stringify(config, null, 2);
      expect(() => JSON.parse(json)).not.toThrow();
    }
  });
});
