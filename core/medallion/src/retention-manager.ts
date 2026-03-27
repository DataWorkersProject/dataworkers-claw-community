/**
 * @data-workers/medallion — Retention Manager
 *
 * Compaction and retention policies per layer.
 * - Bronze: 90 days default, compact every 6h
 * - Silver: 365 days default, compact every 12h
 * - Gold: indefinite, compact weekly
 */

import type {
  MedallionLayer,
  RetentionPolicy,
  RetentionResult,
  CompactionResult,
} from './types.js';

const DEFAULT_POLICIES: Record<MedallionLayer, Omit<RetentionPolicy, 'table'>> = {
  bronze: {
    layer: 'bronze',
    retentionDays: 90,
    compactionEnabled: true,
    compactionIntervalHours: 6,
  },
  silver: {
    layer: 'silver',
    retentionDays: 365,
    compactionEnabled: true,
    compactionIntervalHours: 12,
  },
  gold: {
    layer: 'gold',
    retentionDays: -1, // indefinite
    compactionEnabled: true,
    compactionIntervalHours: 168, // weekly
  },
};

export class RetentionManager {
  private policies: Map<string, RetentionPolicy> = new Map();

  private key(layer: MedallionLayer, table: string): string {
    return `${layer}:${table}`;
  }

  /** Set a retention policy for a specific table. */
  setPolicy(policy: RetentionPolicy): void {
    this.policies.set(this.key(policy.layer, policy.table), policy);
  }

  /** Get the policy for a table, falling back to the layer default. */
  getPolicy(layer: MedallionLayer, table: string): RetentionPolicy {
    const custom = this.policies.get(this.key(layer, table));
    if (custom) return custom;
    return { ...DEFAULT_POLICIES[layer], table };
  }

  /** Get the default retention policy for a layer. */
  getDefaultPolicy(layer: MedallionLayer): RetentionPolicy {
    return { ...DEFAULT_POLICIES[layer], table: '*' };
  }

  /**
   * Apply retention policy: simulate purging expired data.
   * In-memory stub — returns simulated metrics.
   */
  applyRetention(policy: RetentionPolicy): RetentionResult {
    // Simulate retention purge
    const rowsPurged =
      policy.retentionDays === -1
        ? 0
        : Math.floor(Math.random() * 1000) + 100;
    const bytesFreed = rowsPurged * 256; // ~256 bytes per row

    return {
      layer: policy.layer,
      table: policy.table,
      rowsPurged,
      bytesFreed,
      timestamp: Date.now(),
    };
  }

  /**
   * Compact files for a table in a layer.
   * In-memory stub — returns simulated metrics.
   */
  compact(layer: MedallionLayer, table: string): CompactionResult {
    const filesCompacted = Math.floor(Math.random() * 50) + 5;
    const bytesReclaimed = filesCompacted * 1024 * 1024; // ~1MB per file

    return {
      layer,
      table,
      filesCompacted,
      bytesReclaimed,
      timestamp: Date.now(),
    };
  }
}
