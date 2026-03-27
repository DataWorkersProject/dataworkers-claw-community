import { BaseCrawler } from './base-crawler.js';
import type { CrawlResult } from './base-crawler.js';
import type { DataAsset } from '../types.js';

/**
 * Snowflake Crawler (REQ-CTX-AG-001).
 * Extracts metadata from Snowflake INFORMATION_SCHEMA via MCP.
 */
export class SnowflakeCrawler extends BaseCrawler {
  async crawl(): Promise<CrawlResult> {
    const start = Date.now();
    const assets = await this.extractAssets();

    return {
      assetsDiscovered: assets.length,
      assetsUpdated: 0,
      assetsNew: assets.length,
      errors: [],
      durationMs: Date.now() - start,
    };
  }

  async extractAssets(): Promise<DataAsset[]> {
    // In production: query Snowflake INFORMATION_SCHEMA via MCP
    // SELECT table_catalog, table_schema, table_name, table_type,
    //        row_count, bytes, last_altered
    // FROM information_schema.tables
    return [];
  }
}
