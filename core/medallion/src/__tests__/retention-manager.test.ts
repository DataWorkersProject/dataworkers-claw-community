import { describe, it, expect } from 'vitest';
import { RetentionManager } from '../retention-manager.js';

describe('RetentionManager', () => {
  it('exports RetentionManager class', () => {
    expect(RetentionManager).toBeDefined();
  });

  it('creates an instance', () => {
    const manager = new RetentionManager();
    expect(manager).toBeDefined();
  });

  it('sets and gets a policy', () => {
    const manager = new RetentionManager();
    manager.setPolicy({
      layer: 'bronze',
      table: 'events',
      retentionDays: 30,
      compactionEnabled: true,
      compactionIntervalHours: 6,
    });
    const policy = manager.getPolicy('bronze', 'events');
    expect(policy).toBeDefined();
    expect(policy.retentionDays).toBe(30);
  });

  it('falls back to layer default when no custom policy set', () => {
    const manager = new RetentionManager();
    const policy = manager.getPolicy('bronze', 'unknown_table');
    expect(policy).toBeDefined();
    expect(policy.layer).toBe('bronze');
  });
});
