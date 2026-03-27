/**
 * Policy evaluation cache using IKeyValueStore.
 *
 * Caches policy evaluation results for <100ms lookup times.
 * Cache key: `gov:policy_cache:{customerId}:{action}:{resource}:{agentId}`
 * Default TTL: 30 seconds.
 */

import type { IKeyValueStore } from '@data-workers/infrastructure-stubs';
import type { PolicyEvaluation } from '../policy-store.js';

const CACHE_PREFIX = 'gov:policy_cache';
const DEFAULT_TTL_MS = 30_000; // 30 seconds

function cacheKey(customerId: string, action: string, resource: string, agentId: string): string {
  return `${CACHE_PREFIX}:${customerId}:${action}:${resource}:${agentId}`;
}

export class PolicyCache {
  constructor(
    private kvStore: IKeyValueStore,
    private ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  /** Get a cached evaluation result, or null if not cached. */
  async get(
    customerId: string,
    action: string,
    resource: string,
    agentId: string,
  ): Promise<PolicyEvaluation | null> {
    const key = cacheKey(customerId, action, resource, agentId);
    const stored = await this.kvStore.get(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as PolicyEvaluation;
    } catch {
      return null;
    }
  }

  /** Cache an evaluation result. */
  async set(
    customerId: string,
    action: string,
    resource: string,
    agentId: string,
    evaluation: PolicyEvaluation,
  ): Promise<void> {
    const key = cacheKey(customerId, action, resource, agentId);
    await this.kvStore.set(key, JSON.stringify(evaluation), this.ttlMs);
  }

  /** Invalidate all cache entries for a customer. */
  async invalidate(customerId: string): Promise<void> {
    const keys = await this.kvStore.keys(`${CACHE_PREFIX}:${customerId}:*`);
    for (const key of keys) {
      await this.kvStore.delete(key);
    }
  }

  /** Invalidate all cache entries. */
  async invalidateAll(): Promise<void> {
    const keys = await this.kvStore.keys(`${CACHE_PREFIX}:*`);
    for (const key of keys) {
      await this.kvStore.delete(key);
    }
  }
}
