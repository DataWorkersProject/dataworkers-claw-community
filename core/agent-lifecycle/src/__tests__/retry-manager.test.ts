import { describe, it, expect } from 'vitest';
import { RetryManager } from '../retry-manager.js';

describe('RetryManager', () => {
  it('allows retries up to max', () => {
    const rm = new RetryManager({ maxAttempts: 3 });
    expect(rm.canRetry()).toBe(true);
    rm.recordAttempt();
    rm.recordAttempt();
    rm.recordAttempt();
    expect(rm.canRetry()).toBe(false);
  });

  it('provides correct backoff delays', () => {
    const rm = new RetryManager({ backoffMs: [1000, 4000, 16000] });
    expect(rm.getBackoffMs()).toBe(1000);
    rm.recordAttempt();
    expect(rm.getBackoffMs()).toBe(4000);
    rm.recordAttempt();
    expect(rm.getBackoffMs()).toBe(16000);
    rm.recordAttempt();
    // Beyond array: uses last value
    expect(rm.getBackoffMs()).toBe(16000);
  });

  it('resets attempt count', () => {
    const rm = new RetryManager();
    rm.recordAttempt();
    rm.recordAttempt();
    rm.reset();
    expect(rm.getAttemptCount()).toBe(0);
    expect(rm.canRetry()).toBe(true);
  });

  it('executeWithRetry succeeds on first try', async () => {
    const rm = new RetryManager();
    let calls = 0;
    const result = await rm.executeWithRetry(async () => {
      calls++;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('executeWithRetry retries on failure', async () => {
    const rm = new RetryManager({ maxAttempts: 3, backoffMs: [10, 10, 10] });
    let calls = 0;
    const result = await rm.executeWithRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('executeWithRetry throws after max retries', async () => {
    const rm = new RetryManager({ maxAttempts: 2, backoffMs: [10, 10] });
    await expect(
      rm.executeWithRetry(async () => {
        throw new Error('persistent failure');
      }),
    ).rejects.toThrow('persistent failure');
  });
});
