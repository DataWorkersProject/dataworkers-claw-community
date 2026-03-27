import { describe, it, expect } from 'vitest';
import { RedlockManager } from '../redlock.js';

describe('RedlockManager (REQ-CONFL-001)', () => {
  it('acquire returns a valid lock result', async () => {
    const mgr = new RedlockManager(3, 30_000);
    const result = await mgr.acquire('resource:orders');
    expect(result.acquired).toBe(true);
    expect(result.lockKey).toBe('resource:orders');
    expect(result.token).toMatch(/^lock-/);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(result.quorum).toBe(true);
  });

  it('acquire uses default TTL when not specified', async () => {
    const mgr = new RedlockManager(3, 60_000);
    const before = Date.now();
    const result = await mgr.acquire('resource:test');
    // expiresAt should be ~60s from now
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 59_000);
    expect(result.expiresAt).toBeLessThanOrEqual(before + 61_000);
  });

  it('acquire uses custom TTL when specified', async () => {
    const mgr = new RedlockManager(3, 60_000);
    const before = Date.now();
    const result = await mgr.acquire('resource:test', 5_000);
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 4_000);
    expect(result.expiresAt).toBeLessThanOrEqual(before + 6_000);
  });

  it('acquire generates unique tokens per call', async () => {
    const mgr = new RedlockManager();
    const r1 = await mgr.acquire('resource:a');
    const r2 = await mgr.acquire('resource:b');
    expect(r1.token).not.toBe(r2.token);
  });

  it('release returns true', async () => {
    const mgr = new RedlockManager();
    const lock = await mgr.acquire('resource:test');
    const released = await mgr.release(lock.lockKey, lock.token);
    expect(released).toBe(true);
  });

  it('extend returns true', async () => {
    const mgr = new RedlockManager();
    const lock = await mgr.acquire('resource:test');
    const extended = await mgr.extend(lock.lockKey, lock.token, 10_000);
    expect(extended).toBe(true);
  });

  it('quorum calculation for 1 node', async () => {
    const mgr = new RedlockManager(1);
    const result = await mgr.acquire('resource:single');
    // quorum = floor(1/2) + 1 = 1
    expect(result.nodes).toBe(1);
    expect(result.quorum).toBe(true);
  });

  it('quorum calculation for 3 nodes', async () => {
    const mgr = new RedlockManager(3);
    const result = await mgr.acquire('resource:three');
    // quorum = floor(3/2) + 1 = 2
    expect(result.nodes).toBe(2);
    expect(result.quorum).toBe(true);
  });

  it('quorum calculation for 5 nodes', async () => {
    const mgr = new RedlockManager(5);
    const result = await mgr.acquire('resource:five');
    // quorum = floor(5/2) + 1 = 3
    expect(result.nodes).toBe(3);
    expect(result.quorum).toBe(true);
  });

  it('quorum calculation for 7 nodes', async () => {
    const mgr = new RedlockManager(7);
    const result = await mgr.acquire('resource:seven');
    // quorum = floor(7/2) + 1 = 4
    expect(result.nodes).toBe(4);
    expect(result.quorum).toBe(true);
  });

  it('default constructor uses 3 nodes and 300s TTL', async () => {
    const mgr = new RedlockManager();
    const before = Date.now();
    const result = await mgr.acquire('resource:defaults');
    // Default TTL is 300_000ms (5 minutes)
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 299_000);
    expect(result.nodes).toBe(2); // quorum of 3 nodes = 2
  });
});
