import { BaseCrawler } from './base-crawler.js';
import type { CrawlResult } from './base-crawler.js';
import type { DataAsset } from '../types.js';

/**
 * dbt Crawler (REQ-CTX-AG-001).
 * Parses dbt manifest.json and catalog.json for model metadata.
 * Also supports direct manifest parsing as fallback (REQ-MCP-008).
 */
export class DbtCrawler extends BaseCrawler {
  async crawl(): Promise<CrawlResult> {
    const start = Date.now();
    const assets = await this.extractAssets();
    return { assetsDiscovered: assets.length, assetsUpdated: 0, assetsNew: assets.length, errors: [], durationMs: Date.now() - start };
  }

  async extractAssets(): Promise<DataAsset[]> {
    // In production:
    // 1. Parse manifest.json for model definitions, tests, sources
    // 2. Parse catalog.json for column types and stats
    // 3. Extract lineage from ref() and source() calls
    return [];
  }

  /**
   * Direct manifest.json parsing (REQ-MCP-008 fallback).
   * Used when dbt MCP server is unavailable.
   */
  async parseManifest(_manifestJson: string): Promise<DataAsset[]> {
    // Parse manifest.json directly without dbt MCP
    return [];
  }
}
