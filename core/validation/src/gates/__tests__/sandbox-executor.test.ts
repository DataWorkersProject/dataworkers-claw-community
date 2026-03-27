import { describe, it, expect } from 'vitest';
import { SandboxExecutor } from '../sandbox-executor.js';

describe('SandboxExecutor', () => {
  it('exports SandboxExecutor class', () => {
    expect(SandboxExecutor).toBeDefined();
  });

  it('creates instance with default config', () => {
    const executor = new SandboxExecutor();
    expect(executor).toBeDefined();
  });

  it('creates instance with custom config', () => {
    const executor = new SandboxExecutor({
      timeoutMs: 10_000,
      maxMemoryMB: 128,
      allowNetwork: false,
    });
    expect(executor).toBeDefined();
  });

  it('executes SQL in sandbox', async () => {
    const executor = new SandboxExecutor();
    const result = await executor.execute('SELECT 1', 'sql');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.executionTimeMs).toBe('number');
    expect(result.resourceUsage).toBeDefined();
  });
});
