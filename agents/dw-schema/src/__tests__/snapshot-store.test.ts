import { describe, it, expect } from 'vitest';
import { SnapshotStore } from '../snapshot-store.js';
import { InMemoryKeyValueStore, InMemoryWarehouseConnector } from '@data-workers/infrastructure-stubs';
import type { IKeyValueStore, IWarehouseConnector } from '@data-workers/infrastructure-stubs';

describe('SnapshotStore', () => {
  it('exports SnapshotStore class', () => {
    expect(SnapshotStore).toBeDefined();
  });

  it('returns null for missing snapshot', async () => {
    const kv: IKeyValueStore = new InMemoryKeyValueStore();
    const wh: IWarehouseConnector = new InMemoryWarehouseConnector();
    const store = new SnapshotStore(kv, wh);
    const result = await store.getSnapshot('cust-1', 'snowflake', 'db', 'public', 'users');
    expect(result).toBeNull();
  });

  it('saves and retrieves a snapshot', async () => {
    const kv: IKeyValueStore = new InMemoryKeyValueStore();
    const wh: IWarehouseConnector = new InMemoryWarehouseConnector();
    const store = new SnapshotStore(kv, wh);
    const columns = [
      { name: 'id', type: 'INTEGER', nullable: false },
      { name: 'name', type: 'VARCHAR', nullable: true },
    ];
    await store.saveSnapshot('cust-1', 'snowflake', 'db', 'public', 'users', columns);
    const result = await store.getSnapshot('cust-1', 'snowflake', 'db', 'public', 'users');
    expect(result).toHaveLength(2);
    expect(result![0].name).toBe('id');
  });

  it('accepts interface types (not just concrete InMemory types)', async () => {
    // Verify SnapshotStore works with IKeyValueStore and IWarehouseConnector interfaces
    const kv: IKeyValueStore = new InMemoryKeyValueStore();
    const wh: IWarehouseConnector = new InMemoryWarehouseConnector();
    // This should compile and work without issues
    const store = new SnapshotStore(kv, wh);
    expect(store).toBeDefined();
  });
});
