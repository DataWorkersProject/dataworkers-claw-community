/**
 * Iceberg Crawler.
 *
 * Discovers all tables across namespaces in an Iceberg REST Catalog,
 * extracts schema, partitioning, sort order, snapshot count, total size,
 * and computes freshness from the latest snapshot timestamp.
 */

import { BaseCrawler } from './base-crawler.js';
import type { CrawlResult, CrawlerConfig } from './base-crawler.js';
import type { DataAsset, ColumnInfo } from '../types.js';
import {
  IcebergConnector,
  type IcebergTableMetadata,
} from '@data-workers/iceberg-connector';

export interface IcebergCrawlerConfig extends CrawlerConfig {
  endpoint: string;
}

export class IcebergCrawler extends BaseCrawler {
  private connector: IcebergConnector;
  private endpoint: string;

  constructor(config: IcebergCrawlerConfig, connector: IcebergConnector) {
    super({ ...config, platform: 'iceberg' });
    this.connector = connector;
    this.endpoint = config.endpoint;
  }

  async crawl(): Promise<CrawlResult> {
    const start = Date.now();
    const errors: Array<{ source: string; error: string }> = [];

    // 1. Connect to the Iceberg REST catalog
    this.connector.connect(this.endpoint);

    let assets: DataAsset[];
    try {
      assets = await this.extractAssets();
    } catch (err) {
      errors.push({
        source: 'iceberg-crawler',
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        assetsDiscovered: 0,
        assetsUpdated: 0,
        assetsNew: 0,
        errors,
        durationMs: Date.now() - start,
      };
    }

    // Classify each discovered asset
    for (const asset of assets) {
      asset.tags = this.classifyAsset(asset);
    }

    return {
      assetsDiscovered: assets.length,
      assetsUpdated: 0,
      assetsNew: assets.length,
      errors,
      durationMs: Date.now() - start,
    };
  }

  async extractAssets(): Promise<DataAsset[]> {
    const assets: DataAsset[] = [];
    const now = Date.now();

    // 2. List all namespaces
    const namespaces = this.connector.listNamespaces();

    // 3. For each namespace, list all tables
    for (const ns of namespaces) {
      const namespaceName = ns.name.join('.');
      const tables = this.connector.listTables(namespaceName);

      // 4. For each table, extract metadata
      for (const table of tables) {
        const metadata = this.connector.getTableMetadata(namespaceName, table.name);
        const asset = this.convertToDataAsset(namespaceName, table.name, metadata, now);
        assets.push(asset);
      }
    }

    return assets;
  }

  /**
   * Convert Iceberg table metadata to the DataAsset format.
   */
  private convertToDataAsset(
    namespace: string,
    tableName: string,
    metadata: IcebergTableMetadata,
    now: number,
  ): DataAsset {
    // 5. Convert columns from IcebergSchema.fields
    const columns: ColumnInfo[] = metadata.schema.fields.map((field) => ({
      name: field.name,
      type: field.type,
      description: field.doc ?? '',
      nullable: !field.required,
      isPrimaryKey: false,
      tags: [],
    }));

    // Compute total size from the current snapshot
    const currentSnapshot = metadata.snapshots.find(
      (s) => s.snapshotId === metadata.currentSnapshotId,
    );
    const totalSize = currentSnapshot?.summary.totalSizeBytes ?? 0;

    // 6. Compute freshness from latest snapshot timestamp
    const latestSnapshotTs = currentSnapshot?.timestamp ?? 0;
    const freshnessScore = this.computeFreshnessScore(latestSnapshotTs, now);

    return {
      id: `iceberg:${namespace}.${tableName}`,
      customerId: this.config.customerId,
      name: tableName,
      type: 'table',
      platform: 'iceberg',
      database: namespace,
      description: `Iceberg table ${namespace}.${tableName}`,
      columns,
      tags: [],
      qualityScore: 1.0,
      freshnessScore,
      lastUpdated: latestSnapshotTs,
      lastCrawled: now,
      metadata: {
        partitionSpec: metadata.partitionSpec,
        sortOrder: metadata.sortOrder,
        snapshotCount: metadata.snapshots.length,
        totalSize,
        currentSnapshotId: metadata.currentSnapshotId,
      },
    };
  }

  /**
   * Compute a freshness score between 0 and 1 based on the latest snapshot age.
   * - Updated within 1 day  -> 1.0
   * - Updated within 7 days -> 0.7
   * - Updated within 30 days -> 0.4
   * - Older -> 0.1
   */
  private computeFreshnessScore(lastSnapshotTs: number, now: number): number {
    if (lastSnapshotTs === 0) return 0;
    const ageMs = now - lastSnapshotTs;
    const DAY = 86_400_000;
    if (ageMs <= DAY) return 1.0;
    if (ageMs <= 7 * DAY) return 0.7;
    if (ageMs <= 30 * DAY) return 0.4;
    return 0.1;
  }

  /**
   * Classify an asset with domain and sensitivity tags.
   * Extends base classification with Iceberg-specific domain hints.
   */
  override classifyAsset(asset: DataAsset): string[] {
    const tags = super.classifyAsset(asset);

    // Domain classification based on database/namespace
    const db = (asset.database ?? '').toLowerCase();
    if (db.includes('analytics') && !tags.includes('analytics')) {
      tags.push('analytics');
    }
    if (db.includes('raw') && !tags.includes('raw')) {
      tags.push('raw');
    }

    return tags;
  }
}
