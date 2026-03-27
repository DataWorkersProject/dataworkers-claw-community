/**
 * ingest_unstructured_context — Ingest unstructured context from external sources.
 * Pro/Enterprise write tool.
 *
 * Stub implementation — crawler interfaces defined but not connected to real services.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { businessRuleStore } from '../backends.js';
import type { BusinessRuleRecord } from '@data-workers/infrastructure-stubs';
import { randomUUID } from 'node:crypto';

// ── Crawler interfaces (stubs) ──

export interface CrawlerConfig {
  source: string;
  connectionUrl?: string;
  apiToken?: string;
  channels?: string[];
  spaces?: string[];
  repos?: string[];
}

export interface CrawledDocument {
  id: string;
  source: string;
  title: string;
  content: string;
  url?: string;
  author?: string;
  timestamp: number;
  assetReferences: string[];
}

/** Base crawler interface for unstructured context sources. */
export abstract class BaseCrawlerStub {
  constructor(protected config: CrawlerConfig) {}
  abstract crawl(): Promise<CrawledDocument[]>;
  abstract extractAssetReferences(content: string): string[];
}

/** Slack crawler stub — would crawl Slack channels for data context. */
export class SlackCrawlerStub extends BaseCrawlerStub {
  async crawl(): Promise<CrawledDocument[]> {
    // Stub: returns empty in non-production
    return [];
  }
  extractAssetReferences(content: string): string[] {
    // Simple pattern: look for table-like references
    const matches = content.match(/\b\w+\.\w+\.\w+\b/g) || [];
    return [...new Set(matches)];
  }
}

/** Confluence crawler stub — would crawl Confluence spaces for documentation. */
export class ConfluenceCrawlerStub extends BaseCrawlerStub {
  async crawl(): Promise<CrawledDocument[]> {
    return [];
  }
  extractAssetReferences(content: string): string[] {
    const matches = content.match(/\b\w+\.\w+\.\w+\b/g) || [];
    return [...new Set(matches)];
  }
}

/** GitHub crawler stub — would crawl GitHub repos for READMEs, issues, PRs with data context. */
export class GitHubCrawlerStub extends BaseCrawlerStub {
  async crawl(): Promise<CrawledDocument[]> {
    return [];
  }
  extractAssetReferences(content: string): string[] {
    const matches = content.match(/\b\w+\.\w+\.\w+\b/g) || [];
    return [...new Set(matches)];
  }
}

// ── Tool Definition ──

export const ingestUnstructuredContextDefinition: ToolDefinition = {
  name: 'ingest_unstructured_context',
  description:
    'Ingest unstructured context from external sources (Slack, Confluence, GitHub) and ' +
    'convert discovered knowledge into business rules. Enterprise tier required. ' +
    'Currently a stub — crawler implementations are not connected to real services.',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        enum: ['slack', 'confluence', 'github', 'manual'],
        description: 'Source of unstructured context.',
      },
      customerId: { type: 'string', description: 'Customer/tenant ID. Defaults to cust-1.' },
      content: { type: 'string', description: 'For manual source: the unstructured text to ingest.' },
      assetId: { type: 'string', description: 'Asset ID to associate the context with.' },
      author: { type: 'string', description: 'Author or source attribution.' },
    },
    required: ['source'],
  },
};

export const ingestUnstructuredContextHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('ingest_unstructured_context')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'enterprise_feature', message: 'This feature requires Data Workers Enterprise. Visit https://dataworkers.io/pricing', tool: 'ingest_unstructured_context' }) }],
      isError: true,
    };
  }

  const source = args.source as string;
  const customerId = (args.customerId as string) || 'cust-1';
  const content = args.content as string | undefined;
  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string | undefined;
  const author = (args.author as string) || `${source}-crawler`;

  if (source === 'manual' && content && assetId) {
    // For manual ingestion, create a business rule directly
    const rule: BusinessRuleRecord = {
      id: `rule-${randomUUID().slice(0, 8)}`,
      customerId,
      assetId,
      ruleType: 'tribal_knowledge',
      content,
      author,
      confidence: 0.6,
      source: 'unstructured_ingestion',
      conditions: [],
      createdAt: Date.now(),
      lastConfirmedAt: Date.now(),
      deprecated: false,
    };
    await businessRuleStore.addRule(rule);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          source: 'manual',
          rulesCreated: 1,
          ruleIds: [rule.id],
          message: `Ingested manual context as business rule for '${assetId}'.`,
        }, null, 2),
      }],
    };
  }

  // For automated crawlers — stub response
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        source,
        rulesCreated: 0,
        message: `${source} crawler is a stub. No real crawling performed. ` +
          'Configure crawler credentials and enable in production.',
        availableCrawlers: ['slack', 'confluence', 'github'],
        stub: true,
      }, null, 2),
    }],
  };
};
