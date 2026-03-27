import { describe, it, expect } from 'vitest';
import { TimeoutManager } from '../timeout-manager.js';

describe('TimeoutManager', () => {
  it('returns correct timeout per phase', () => {
    const tm = new TimeoutManager();
    expect(tm.getTimeoutForPhase('PLANNING')).toBe(30_000);
    expect(tm.getTimeoutForPhase('EXECUTING', false)).toBe(300_000);
    expect(tm.getTimeoutForPhase('EXECUTING', true)).toBe(1_800_000);
    expect(tm.getTimeoutForPhase('VALIDATING')).toBe(120_000);
    expect(tm.getTimeoutForPhase('IDLE')).toBe(0);
  });

  it('returns LLM timeout of 60s', () => {
    const tm = new TimeoutManager();
    expect(tm.getLlmTimeout()).toBe(60_000);
  });

  it('accepts custom timeouts', () => {
    const tm = new TimeoutManager({ planningMs: 10_000, llmCallMs: 30_000 });
    expect(tm.getTimeoutForPhase('PLANNING')).toBe(10_000);
    expect(tm.getLlmTimeout()).toBe(30_000);
  });

  it('withPhaseTimeout enforces timeout', async () => {
    const tm = new TimeoutManager({ planningMs: 50 });
    await expect(
      tm.withPhaseTimeout('PLANNING', async () => {
        await new Promise((r) => setTimeout(r, 200));
        return 'done';
      }),
    ).rejects.toThrow('timed out');
  });

  it('withPhaseTimeout completes within timeout', async () => {
    const tm = new TimeoutManager({ planningMs: 500 });
    const result = await tm.withPhaseTimeout('PLANNING', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('withLlmTimeout enforces timeout', async () => {
    const tm = new TimeoutManager({ llmCallMs: 50 });
    await expect(
      tm.withLlmTimeout(async () => {
        await new Promise((r) => setTimeout(r, 200));
      }),
    ).rejects.toThrow('timed out');
  });
});
