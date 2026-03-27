/**
 * Stubbed Apache Nessie client.
 * Uses in-memory stores to simulate Nessie REST API v2.
 */

import type {
  INessieClient,
  NessieBranch,
  NessieEntry,
  NessieContentKey,
  NessieIcebergTable,
  NessieDiff,
  NessieCommit,
} from './types.js';

export class NessieStubClient implements INessieClient {
  private references: NessieBranch[] = [];
  private content: Map<string, NessieEntry[]> = new Map();
  private tables: Map<string, NessieIcebergTable> = new Map();
  private commits: Map<string, NessieCommit[]> = new Map();
  private seeded = false;

  /** Pre-load with realistic Nessie metadata. */
  seed(): void {
    if (this.seeded) return;

    const now = new Date().toISOString();

    // --- References (branches + tags) ---
    this.references = [
      { name: 'main', hash: 'abc123def456', type: 'BRANCH' },
      { name: 'develop', hash: 'def456ghi789', type: 'BRANCH' },
      { name: 'feature/experiment', hash: 'ghi789jkl012', type: 'BRANCH' },
      { name: 'v1.0.0', hash: 'aaa111bbb222', type: 'TAG' },
      { name: 'v1.1.0', hash: 'bbb222ccc333', type: 'TAG' },
      { name: 'v1.2.0', hash: 'ccc333ddd444', type: 'TAG' },
      { name: 'v2.0.0-rc1', hash: 'ddd444eee555', type: 'TAG' },
      { name: 'v2.0.0', hash: 'eee555fff666', type: 'TAG' },
    ];

    // --- Content (tables in branches) ---
    const mainEntries: NessieEntry[] = [
      { type: 'NAMESPACE', key: { elements: ['warehouse'] }, contentId: 'ns-001' },
      { type: 'NAMESPACE', key: { elements: ['warehouse', 'analytics'] }, contentId: 'ns-002' },
      { type: 'ICEBERG_TABLE', key: { elements: ['warehouse', 'analytics', 'customers'] }, contentId: 'tbl-001' },
      { type: 'ICEBERG_TABLE', key: { elements: ['warehouse', 'analytics', 'orders'] }, contentId: 'tbl-002' },
      { type: 'ICEBERG_TABLE', key: { elements: ['warehouse', 'analytics', 'products'] }, contentId: 'tbl-003' },
      { type: 'ICEBERG_TABLE', key: { elements: ['warehouse', 'analytics', 'daily_revenue'] }, contentId: 'tbl-004' },
      { type: 'ICEBERG_TABLE', key: { elements: ['warehouse', 'raw', 'events'] }, contentId: 'tbl-005' },
      { type: 'DELTA_LAKE_TABLE', key: { elements: ['warehouse', 'raw', 'clickstream'] }, contentId: 'tbl-006' },
    ];

    const developEntries: NessieEntry[] = [
      ...mainEntries,
      { type: 'ICEBERG_TABLE', key: { elements: ['warehouse', 'analytics', 'user_segments'] }, contentId: 'tbl-007' },
      { type: 'ICEBERG_TABLE', key: { elements: ['warehouse', 'analytics', 'marketing_metrics'] }, contentId: 'tbl-008' },
    ];

    this.content.set('main', mainEntries);
    this.content.set('develop', developEntries);
    this.content.set('feature/experiment', [
      ...developEntries,
    ]);

    // --- Tables ---
    this.tables.set('tbl-001', { id: 'tbl-001', metadataLocation: 's3://warehouse/analytics/customers/metadata/v1.metadata.json', snapshotId: 1001, schemaId: 1, specId: 1, sortOrderId: 0 });
    this.tables.set('tbl-002', { id: 'tbl-002', metadataLocation: 's3://warehouse/analytics/orders/metadata/v3.metadata.json', snapshotId: 3042, schemaId: 2, specId: 1, sortOrderId: 1 });
    this.tables.set('tbl-003', { id: 'tbl-003', metadataLocation: 's3://warehouse/analytics/products/metadata/v1.metadata.json', snapshotId: 500, schemaId: 1, specId: 1, sortOrderId: 0 });
    this.tables.set('tbl-004', { id: 'tbl-004', metadataLocation: 's3://warehouse/analytics/daily_revenue/metadata/v5.metadata.json', snapshotId: 5100, schemaId: 3, specId: 2, sortOrderId: 0 });
    this.tables.set('tbl-005', { id: 'tbl-005', metadataLocation: 's3://warehouse/raw/events/metadata/v2.metadata.json', snapshotId: 2050, schemaId: 1, specId: 1, sortOrderId: 0 });
    this.tables.set('tbl-006', { id: 'tbl-006', metadataLocation: 's3://warehouse/raw/clickstream/metadata/_delta_log/', snapshotId: 0, schemaId: 0, specId: 0, sortOrderId: 0 });
    this.tables.set('tbl-007', { id: 'tbl-007', metadataLocation: 's3://warehouse/analytics/user_segments/metadata/v1.metadata.json', snapshotId: 100, schemaId: 1, specId: 1, sortOrderId: 0 });
    this.tables.set('tbl-008', { id: 'tbl-008', metadataLocation: 's3://warehouse/analytics/marketing_metrics/metadata/v1.metadata.json', snapshotId: 50, schemaId: 1, specId: 1, sortOrderId: 0 });
    this.tables.set('tbl-009', { id: 'tbl-009', metadataLocation: 's3://warehouse/analytics/ab_test_results/metadata/v1.metadata.json', snapshotId: 25, schemaId: 1, specId: 1, sortOrderId: 0 });

    // --- Commit history ---
    this.commits.set('main', [
      { hash: 'abc123def456', message: 'Update daily_revenue schema', author: 'etl-bot', commitTime: now },
      { hash: 'abc123def455', message: 'Add products table', author: 'data-engineer', commitTime: new Date(Date.now() - 86400000).toISOString() },
      { hash: 'abc123def454', message: 'Initial schema for orders', author: 'data-engineer', commitTime: new Date(Date.now() - 86400000 * 2).toISOString() },
      { hash: 'abc123def453', message: 'Create analytics namespace', author: 'admin', commitTime: new Date(Date.now() - 86400000 * 3).toISOString() },
    ]);
    this.commits.set('develop', [
      { hash: 'def456ghi789', message: 'Add marketing_metrics table', author: 'data-analyst', commitTime: now },
      { hash: 'def456ghi788', message: 'Add user_segments table', author: 'data-scientist', commitTime: new Date(Date.now() - 86400000).toISOString() },
      ...this.commits.get('main')!,
    ]);

    this.seeded = true;
  }

  /** List all references (branches and tags). */
  listReferences(): NessieBranch[] {
    return this.references;
  }

  /** List content (entries) on a reference. */
  listContent(ref: string): NessieEntry[] {
    const entries = this.content.get(ref);
    if (!entries) {
      throw new Error(`Reference not found: ${ref}`);
    }
    return entries;
  }

  /** Get content (table metadata) at a reference for a key. */
  getContent(ref: string, key: NessieContentKey): NessieIcebergTable {
    const entries = this.content.get(ref);
    if (!entries) {
      throw new Error(`Reference not found: ${ref}`);
    }
    const keyStr = key.elements.join('.');
    const entry = entries.find((e) => e.key.elements.join('.') === keyStr);
    if (!entry) {
      throw new Error(`Content not found: ${keyStr} on ${ref}`);
    }
    const table = this.tables.get(entry.contentId);
    if (!table) {
      throw new Error(`Table metadata not found: ${entry.contentId}`);
    }
    return table;
  }

  /** Create a new branch from an existing reference. */
  createBranch(name: string, from: string): NessieBranch {
    const source = this.references.find((r) => r.name === from);
    if (!source) {
      throw new Error(`Source reference not found: ${from}`);
    }
    if (this.references.some((r) => r.name === name)) {
      throw new Error(`Branch already exists: ${name}`);
    }
    const newHash = `branch-${Date.now().toString(16)}`;
    const newBranch: NessieBranch = { name, hash: newHash, type: 'BRANCH' };
    this.references.push(newBranch);
    // Copy content from source and add a branch-init entry so diffs are non-empty
    const sourceContent = this.content.get(from) ?? [];
    const branchContentId = `tbl-branch-${name.replace(/[^a-z0-9]/gi, '-')}`;
    const branchEntry: NessieEntry = {
      type: 'ICEBERG_TABLE',
      key: { elements: ['warehouse', 'staging', name.replace(/\//g, '_') + '_init'] },
      contentId: branchContentId,
    };
    this.tables.set(branchContentId, {
      id: branchContentId,
      metadataLocation: `s3://warehouse/staging/${name.replace(/\//g, '_')}_init/metadata/v1.metadata.json`,
      snapshotId: 1,
      schemaId: 1,
      specId: 1,
      sortOrderId: 0,
    });
    this.content.set(name, [...sourceContent, branchEntry]);
    return newBranch;
  }

  /** Merge a branch into another. */
  mergeBranch(from: string, to: string): { hash: string } {
    const sourceRef = this.references.find((r) => r.name === from);
    const targetRef = this.references.find((r) => r.name === to);
    if (!sourceRef) throw new Error(`Source reference not found: ${from}`);
    if (!targetRef) throw new Error(`Target reference not found: ${to}`);

    // Simulate merge by copying content
    const sourceContent = this.content.get(from) ?? [];
    this.content.set(to, [...sourceContent]);
    const newHash = `merged-${Date.now().toString(16)}`;
    targetRef.hash = newHash;
    return { hash: newHash };
  }

  /** Get diff between two references. */
  diffRefs(from: string, to: string): NessieDiff[] {
    const fromContent = this.content.get(from);
    const toContent = this.content.get(to);
    if (!fromContent) throw new Error(`Reference not found: ${from}`);
    if (!toContent) throw new Error(`Reference not found: ${to}`);

    const diffs: NessieDiff[] = [];
    const fromKeys = new Map(fromContent.map((e) => [e.key.elements.join('.'), e]));
    const toKeys = new Map(toContent.map((e) => [e.key.elements.join('.'), e]));

    // Items in 'to' but not in 'from' (added)
    for (const [keyStr, entry] of toKeys) {
      if (!fromKeys.has(keyStr)) {
        diffs.push({ key: entry.key, from: null, to: entry.contentId });
      }
    }

    // Items in 'from' but not in 'to' (removed)
    for (const [keyStr, entry] of fromKeys) {
      if (!toKeys.has(keyStr)) {
        diffs.push({ key: entry.key, from: entry.contentId, to: null });
      }
    }

    return diffs;
  }

  /** Get commit log for a reference. */
  commitLog(ref: string): NessieCommit[] {
    const commits = this.commits.get(ref);
    if (!commits) {
      // Return empty if no commits recorded but reference exists
      if (this.references.some((r) => r.name === ref)) {
        return [];
      }
      throw new Error(`Reference not found: ${ref}`);
    }
    return commits;
  }
}
