import { BaseCrawler } from './base-crawler.js';
import type { CrawlResult } from './base-crawler.js';
import type { DataAsset } from '../types.js';

/**
 * BigQuery Crawler (REQ-CTX-AG-001).
 * Extracts metadata from BigQuery INFORMATION_SCHEMA via MCP.
 */
export class BigQueryCrawler extends BaseCrawler {
  async crawl(): Promise<CrawlResult> {
    const start = Date.now();
    const assets = await this.extractAssets();
    return { assetsDiscovered: assets.length, assetsUpdated: 0, assetsNew: assets.length, errors: [], durationMs: Date.now() - start };
  }

  async extractAssets(): Promise<DataAsset[]> {
    // In production: query BigQuery INFORMATION_SCHEMA via MCP
    return [];
  }
}
