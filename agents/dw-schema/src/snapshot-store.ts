/**
 * Schema snapshot store backed by IKeyValueStore (cache with configurable TTL)
 * and IWarehouseConnector (durable schema storage).
 *
 * Uses interfaces instead of concrete InMemory types so production adapters
 * (Redis, real warehouse) work transparently.
 */

import type { IKeyValueStore, IWarehouseConnector, ColumnDef } from '@data-workers/infrastructure-stubs';
import { createHash } from 'crypto';
import { loadSchemaAgentConfig } from './types.js';

const config = loadSchemaAgentConfig();

/**
 * Build a snapshot cache key using SHA-256 hashing to avoid key collisions
 * and normalize key length.
 */
function buildSnapshotKey(customerId: string, source: string, database: string, schema: string, table: string): string {
  const raw = `${customerId}:${source}:${database}.${schema}.${table}`;
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return `schema-snapshot:${hash}:${raw}`;
}

export class SnapshotStore {
  /** LRU tracking: ordered keys from least-recently-used to most-recently-used. */
  private lruKeys: string[] = [];

  constructor(
    private kvStore: IKeyValueStore,
    private warehouse: IWarehouseConnector,
  ) {}

  /**
   * Get the most recent schema snapshot for a table.
   * Checks the cache first, then falls back to the warehouse connector.
   */
  async getSnapshot(customerId: string, source: string, database: string, schema: string, table: string): Promise<ColumnDef[] | null> {
    const key = buildSnapshotKey(customerId, source, database, schema, table);
    const cached = await this.kvStore.get(key);
    if (cached) {
      this.touchLru(key);
      return JSON.parse(cached) as ColumnDef[];
    }
    return null;
  }

  /**
   * Save a schema snapshot to both cache and durable store.
   * Enforces LRU eviction when the cache exceeds maxEntries.
   */
  async saveSnapshot(customerId: string, source: string, database: string, schema: string, table: string, columns: ColumnDef[]): Promise<void> {
    const key = buildSnapshotKey(customerId, source, database, schema, table);
    await this.kvStore.set(key, JSON.stringify(columns), config.snapshotCacheTtlMs);
    this.touchLru(key);
    await this.evictIfNeeded();
  }

  /**
   * Move a key to the most-recently-used position.
   */
  private touchLru(key: string): void {
    const idx = this.lruKeys.indexOf(key);
    if (idx !== -1) {
      this.lruKeys.splice(idx, 1);
    }
    this.lruKeys.push(key);
  }

  /**
   * Evict least-recently-used entries when cache exceeds max entries.
   */
  private async evictIfNeeded(): Promise<void> {
    while (this.lruKeys.length > config.snapshotCacheMaxEntries) {
      const evictKey = this.lruKeys.shift();
      if (evictKey) {
        await this.kvStore.delete(evictKey);
      }
    }
  }
}
