import { describe, it, expect, beforeEach } from 'vitest';
import { RedisContextStore } from '../redis-store.js';
import type { ContextEntry } from '../types.js';

describe('RedisContextStore', () => {
  let store: RedisContextStore;

  beforeEach(() => {
    store = new RedisContextStore({
      nodes: [
        { host: 'localhost', port: 6379 },
        { host: 'localhost', port: 6380 },
        { host: 'localhost', port: 6381 },
      ],
    });
  });

  // REQ-CTX-004: Customer keyspace isolation
  describe('Key Management', () => {
    it('builds tenant-isolated keys', () => {
      const key = store.buildKey('cust-123', 'agent:state');
      expect(key).toBe('customer:cust-123:agent:state');
    });

    it('validates key ownership', () => {
      expect(store.validateKeyOwnership('customer:cust-123:data', 'cust-123')).toBe(true);
      expect(store.validateKeyOwnership('customer:cust-456:data', 'cust-123')).toBe(false);
    });

    it('prevents cross-tenant key access', () => {
      const key1 = store.buildKey('tenant-a', 'secret');
      const key2 = store.buildKey('tenant-b', 'secret');
      expect(key1).not.toBe(key2);
      expect(store.validateKeyOwnership(key1, 'tenant-b')).toBe(false);
    });
  });

  // REQ-CTX-003: Failover buffering
  describe('Failover Management', () => {
    it('starts in disconnected state', () => {
      expect(store.getConnectionState()).toBe('disconnected');
    });

    it('connects successfully', async () => {
      await store.connect();
      expect(store.getConnectionState()).toBe('connected');
    });

    it('enters SUSPENDED on disconnect', () => {
      store.handleDisconnect();
      expect(store.getConnectionState()).toBe('suspended');
    });

    it('buffers operations during SUSPENDED', async () => {
      store.handleDisconnect();
      const entry: ContextEntry = {
        key: 'test',
        value: 'data',
        customerId: 'cust-1',
        agentId: 'agent-1',
        timestamp: Date.now(),
      };
      await store.set(entry);
      expect(store.getBufferSize()).toBe(1);
    });

    it('transitions to DEGRADED after 60s timeout', () => {
      store.handleDisconnect();
      // Simulate time passing
      (store as unknown as { suspendedAt: number }).suspendedAt = Date.now() - 61_000;
      const transitioned = store.checkFailoverTimeout();
      expect(transitioned).toBe(true);
      expect(store.getConnectionState()).toBe('degraded');
    });

    it('rejects writes in DEGRADED mode', async () => {
      store.handleDisconnect();
      (store as unknown as { suspendedAt: number }).suspendedAt = Date.now() - 61_000;
      store.checkFailoverTimeout();

      const entry: ContextEntry = {
        key: 'test',
        value: 'data',
        customerId: 'cust-1',
        agentId: 'agent-1',
        timestamp: Date.now(),
      };
      await expect(store.set(entry)).rejects.toThrow('DEGRADED');
    });

    it('replays buffer on reconnect', async () => {
      store.handleDisconnect();
      const entry: ContextEntry = {
        key: 'test',
        value: 'data',
        customerId: 'cust-1',
        agentId: 'agent-1',
        timestamp: Date.now(),
      };
      await store.set(entry);
      await store.set({ ...entry, key: 'test2' });
      expect(store.getBufferSize()).toBe(2);

      const replayed = await store.handleReconnect();
      expect(replayed).toBe(2);
      expect(store.getBufferSize()).toBe(0);
      expect(store.getConnectionState()).toBe('connected');
    });
  });

  // Checkpointing
  describe('Checkpointing', () => {
    it('saves checkpoints with versioning', async () => {
      await store.connect();
      await store.saveCheckpoint({
        agentId: 'agent-1',
        customerId: 'cust-1',
        state: 'EXECUTING',
        context: { progress: 50 },
        timestamp: Date.now(),
        version: 1,
      });
      // In real implementation, would verify the checkpoint was stored
    });

    it('buffers checkpoints during failover', async () => {
      store.handleDisconnect();
      await store.saveCheckpoint({
        agentId: 'agent-1',
        customerId: 'cust-1',
        state: 'EXECUTING',
        context: { progress: 50 },
        timestamp: Date.now(),
        version: 1,
      });
      expect(store.getBufferSize()).toBe(1);
    });
  });

  // Distributed locking
  describe('Distributed Locking', () => {
    it('acquires lock with token', async () => {
      await store.connect();
      const result = await store.acquireLock('cust-1', 'pipeline-deploy');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
    });
  });
});
