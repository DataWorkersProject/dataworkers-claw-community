import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryQuotaManager } from '../memory-quota.js';

describe('MemoryQuotaManager', () => {
  let manager: MemoryQuotaManager;

  beforeEach(() => {
    manager = new MemoryQuotaManager();
  });

  it('initializes customer with tier-based quota', () => {
    const quota = manager.initCustomer('cust-1', 'growth');
    expect(quota.maxBytes).toBe(512 * 1024 * 1024); // 512MB
    expect(quota.currentBytes).toBe(0);
    expect(quota.usagePercent).toBe(0);
  });

  it('enterprise tier gets 2GB quota', () => {
    const quota = manager.initCustomer('cust-2', 'enterprise');
    expect(quota.maxBytes).toBe(2 * 1024 * 1024 * 1024);
  });

  it('tracks memory usage', () => {
    manager.initCustomer('cust-1', 'growth');
    const quota = manager.updateUsage('cust-1', 400 * 1024 * 1024); // 400MB
    expect(quota).not.toBeNull();
    expect(quota!.usagePercent).toBeCloseTo(78.125, 1);
  });

  it('detects need for eviction at 90%', () => {
    manager.initCustomer('cust-1', 'growth');
    manager.updateUsage('cust-1', 461 * 1024 * 1024); // ~90% of 512MB
    expect(manager.needsEviction('cust-1')).toBe(true);
  });

  it('no eviction needed below 90%', () => {
    manager.initCustomer('cust-1', 'growth');
    manager.updateUsage('cust-1', 400 * 1024 * 1024); // ~78%
    expect(manager.needsEviction('cust-1')).toBe(false);
  });

  it('checks if write fits within quota', () => {
    manager.initCustomer('cust-1', 'growth');
    manager.updateUsage('cust-1', 500 * 1024 * 1024); // 500MB of 512MB
    expect(manager.canWrite('cust-1', 10 * 1024 * 1024)).toBe(true); // 10MB fits
    expect(manager.canWrite('cust-1', 20 * 1024 * 1024)).toBe(false); // 20MB doesn't
  });

  it('supports custom quotas', () => {
    manager.initCustomer('cust-1', 'enterprise');
    manager.setCustomQuota('cust-1', 4 * 1024 * 1024 * 1024); // 4GB
    const quota = manager.getQuota('cust-1');
    expect(quota!.maxBytes).toBe(4 * 1024 * 1024 * 1024);
  });

  it('alerts at 90% usage', () => {
    manager.initCustomer('cust-1', 'growth');
    manager.updateUsage('cust-1', 461 * 1024 * 1024);
    expect(manager.shouldAlert('cust-1')).toBe(true);
  });

  it('lists customers over threshold', () => {
    manager.initCustomer('cust-1', 'growth');
    manager.initCustomer('cust-2', 'growth');
    manager.updateUsage('cust-1', 470 * 1024 * 1024); // ~92%
    manager.updateUsage('cust-2', 200 * 1024 * 1024); // ~39%

    const overThreshold = manager.getCustomersOverThreshold(90);
    expect(overThreshold).toHaveLength(1);
    expect(overThreshold[0].customerId).toBe('cust-1');
  });

  it('unrestricted for unknown customers', () => {
    expect(manager.canWrite('unknown', 1_000_000_000)).toBe(true);
  });
});
