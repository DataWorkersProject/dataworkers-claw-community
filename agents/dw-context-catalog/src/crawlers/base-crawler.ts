/**
 * Base Crawler (REQ-CTX-AG-001).
 *
 * Abstract base for data platform crawlers.
 * Each crawler connects via MCP to extract metadata.
 */

import type { DataAsset, ColumnInfo, AssetType } from '../types.js';
import type { GraphPersister, PersistResult } from './graph-persister.js';

export interface CrawlResult {
  assetsDiscovered: number;
  assetsUpdated: number;
  assetsNew: number;
  errors: Array<{ source: string; error: string }>;
  durationMs: number;
  /** Graph persistence result, populated when a GraphPersister is wired. */
  persistResult?: PersistResult;
}

export interface CrawlerConfig {
  platform: string;
  connectionId: string;
  customerId: string;
  databases?: string[];
  schemas?: string[];
  excludePatterns?: string[];
}

export abstract class BaseCrawler {
  protected config: CrawlerConfig;
  protected graphPersister?: GraphPersister;

  constructor(config: CrawlerConfig) {
    this.config = config;
  }

  /**
   * Wire a GraphPersister so crawled assets are automatically
   * persisted to the graph DB after extraction.
   */
  setGraphPersister(persister: GraphPersister): void {
    this.graphPersister = persister;
  }

  abstract crawl(): Promise<CrawlResult>;
  abstract extractAssets(): Promise<DataAsset[]>;

  /**
   * Persist extracted assets to the graph DB via the wired GraphPersister.
   * Called automatically by crawlAndPersist(), or can be called manually.
   */
  async persistAssets(assets: DataAsset[]): Promise<PersistResult | undefined> {
    if (!this.graphPersister || assets.length === 0) return undefined;
    return this.graphPersister.persistAssets(assets);
  }

  /**
   * Crawl and automatically persist discovered assets to the graph DB.
   * Combines crawl() + extractAssets() + graph persistence in one call.
   */
  async crawlAndPersist(): Promise<CrawlResult> {
    const result = await this.crawl();
    if (this.graphPersister) {
      const assets = await this.extractAssets();
      if (assets.length > 0) {
        result.persistResult = await this.graphPersister.persistAssets(assets);
      }
    }
    return result;
  }

  /**
   * Classify an asset with domain, sensitivity, and quality tags.
   */
  classifyAsset(asset: DataAsset): string[] {
    const tags: string[] = [];

    // Domain classification
    const name = asset.name.toLowerCase();
    if (/order|invoice|payment|revenue|price/.test(name)) tags.push('finance');
    if (/user|customer|account|profile/.test(name)) tags.push('customer');
    if (/event|click|page_view|session/.test(name)) tags.push('product');
    if (/employee|salary|hr_/.test(name)) tags.push('hr');

    // Sensitivity classification
    const hasPII = asset.columns?.some((c) =>
      /email|phone|ssn|address|name|dob|birth/.test(c.name.toLowerCase()),
    );
    if (hasPII) tags.push('pii', 'sensitive');

    // Type tags
    if (name.startsWith('stg_') || name.startsWith('staging_')) tags.push('staging');
    if (name.startsWith('dim_')) tags.push('dimension');
    if (name.startsWith('fct_') || name.startsWith('fact_')) tags.push('fact');
    if (name.startsWith('raw_')) tags.push('raw');

    return tags;
  }
}
