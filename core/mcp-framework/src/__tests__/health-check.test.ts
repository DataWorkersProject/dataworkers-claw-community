import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthChecker } from '../health-check.js';

describe('HealthChecker', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker('test-agent', 5);
  });

  it('returns healthy with no checks registered', async () => {
    const status = await checker.getHealthStatus();
    expect(status.agent).toBe('test-agent');
    expect(status.status).toBe('healthy');
    expect(status.tools).toBe(5);
    expect(status.checks).toEqual([]);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
    expect(status.timestamp).toBeDefined();
  });

  it('returns healthy when all checks pass', async () => {
    checker.register('database', () => ({ name: 'database', status: 'ok' }));
    checker.register('cache', async () => ({ name: 'cache', status: 'ok' }));

    const status = await checker.getHealthStatus();
    expect(status.status).toBe('healthy');
    expect(status.checks).toHaveLength(2);
    expect(status.checks.every((c) => c.status === 'ok')).toBe(true);
  });

  it('returns degraded when any check warns', async () => {
    checker.register('database', () => ({ name: 'database', status: 'ok' }));
    checker.register('cache', () => ({
      name: 'cache',
      status: 'warn',
      message: 'high latency',
    }));

    const status = await checker.getHealthStatus();
    expect(status.status).toBe('degraded');
  });

  it('returns unhealthy when any check fails', async () => {
    checker.register('database', () => ({ name: 'database', status: 'fail', message: 'down' }));
    checker.register('cache', () => ({ name: 'cache', status: 'ok' }));

    const status = await checker.getHealthStatus();
    expect(status.status).toBe('unhealthy');
  });

  it('fail takes priority over warn', async () => {
    checker.register('a', () => ({ name: 'a', status: 'warn' }));
    checker.register('b', () => ({ name: 'b', status: 'fail' }));

    const status = await checker.getHealthStatus();
    expect(status.status).toBe('unhealthy');
  });

  it('catches check functions that throw and reports them as fail', async () => {
    checker.register('broken', async () => {
      throw new Error('connection refused');
    });

    const status = await checker.getHealthStatus();
    expect(status.status).toBe('unhealthy');
    expect(status.checks).toHaveLength(1);
    expect(status.checks[0].status).toBe('fail');
    expect(status.checks[0].message).toBe('connection refused');
  });

  it('unregister removes a check', async () => {
    checker.register('temp', () => ({ name: 'temp', status: 'fail' }));
    expect(checker.unregister('temp')).toBe(true);

    const status = await checker.getHealthStatus();
    expect(status.status).toBe('healthy');
    expect(status.checks).toHaveLength(0);
  });

  it('unregister returns false for unknown check', () => {
    expect(checker.unregister('nope')).toBe(false);
  });

  it('setToolCount updates the reported tool count', async () => {
    checker.setToolCount(12);
    const status = await checker.getHealthStatus();
    expect(status.tools).toBe(12);
  });

  it('uptime increases over time', async () => {
    // Use fake timers to advance time
    vi.useFakeTimers();
    const ch = new HealthChecker('timed', 0);
    vi.advanceTimersByTime(5000);
    const status = await ch.getHealthStatus();
    expect(status.uptime).toBeGreaterThanOrEqual(5000);
    vi.useRealTimers();
  });

  it('runs checks concurrently', async () => {
    const order: string[] = [];

    checker.register('slow', async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push('slow');
      return { name: 'slow', status: 'ok' };
    });
    checker.register('fast', async () => {
      order.push('fast');
      return { name: 'fast', status: 'ok' };
    });

    const status = await checker.getHealthStatus();
    expect(status.checks).toHaveLength(2);
    // fast should finish before slow since they run concurrently
    expect(order[0]).toBe('fast');
  });

  it('replaces a check when registered with the same name', async () => {
    checker.register('db', () => ({ name: 'db', status: 'fail' }));
    checker.register('db', () => ({ name: 'db', status: 'ok' }));

    const status = await checker.getHealthStatus();
    expect(status.checks).toHaveLength(1);
    expect(status.checks[0].status).toBe('ok');
  });
});
