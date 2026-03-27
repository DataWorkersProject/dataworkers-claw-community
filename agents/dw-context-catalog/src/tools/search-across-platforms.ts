import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { InvalidParameterError, ServerToolCallError } from '@data-workers/mcp-framework';
import type { SearchResult } from '../types.js';
import { CatalogSearchEngine } from '../search/catalog-search.js';
import { vectorStore, fullTextSearch, graphDB, getCatalogRegistry } from '../backends.js';

export const searchAcrossPlatformsDefinition: ToolDefinition = {
  name: 'search_across_platforms',
  description: 'Federated cross-platform search across the data catalog and connected external catalogs. Returns matching datasets with relevance scores using hybrid retrieval (vector + BM25 + graph + connector). Supports filtering by platforms, type, tags, and quality score.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language search query.' },
      customerId: { type: 'string' },
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of platforms to search (e.g., ["snowflake", "bigquery"]). Omit to search all.',
      },
      platform: { type: 'string', description: 'Filter results by platform (snowflake, bigquery, etc.).' },
      type: { type: 'string', enum: ['table', 'view', 'model', 'pipeline', 'dashboard', 'metric'] },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags.' },
      limit: { type: 'number', description: 'Max results. Default: 20.' },
    },
    required: ['query', 'customerId'],
  },
};

// Module-level search engine with seeded backends + CatalogRegistry
const searchEngine = new CatalogSearchEngine(
  { vectorStore, fullTextSearch, graphDB },
  undefined,
  getCatalogRegistry(),
);

/**
 * Federated cross-platform search using hybrid retrieval
 * (vector + BM25 + graph + connector).
 * Post-filters results by platform, type, and tags if provided.
 */
export const searchAcrossPlatformsHandler: ToolHandler = async (args) => {
  try {
    if (!args.query || typeof args.query !== 'string' || (args.query as string).trim() === '') {
      throw new InvalidParameterError('Parameter "query" is required and must be a non-empty string.');
    }
    if (!args.customerId || typeof args.customerId !== 'string') {
      throw new InvalidParameterError('Parameter "customerId" is required and must be a string.');
    }

    const query = (args.query as string).toLowerCase();
    const customerId = args.customerId as string;
    const platforms = args.platforms as string[] | undefined;
    const platform = args.platform as string | undefined;
    const type = args.type as string | undefined;
    const tags = args.tags as string[] | undefined;
    const limit = (args.limit as number) ?? 20;

    // Fetch extra results when filters are active to avoid under-filling
    const hasFilters = !!(platform || type || (tags && tags.length > 0));
    const fetchLimit = hasFilters ? limit * 3 : limit;

    const searchResult = await searchEngine.search(query, customerId, fetchLimit, platforms);

    // Handle cold-start response
    if (!Array.isArray(searchResult)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          totalResults: 0,
          results: [],
          coldStart: true,
          message: searchResult.message,
        }, null, 2) }],
      };
    }

    // Post-filter by platform, type, tags
    let results: SearchResult[] = searchResult;

    if (platform) {
      results = results.filter(r => r.asset.platform.toLowerCase() === platform.toLowerCase());
    }
    if (type) {
      results = results.filter(r => r.asset.type === type);
    }
    if (tags && tags.length > 0) {
      results = results.filter(r =>
        tags.some(tag => r.asset.tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())),
      );
    }

    // Apply final limit after filtering
    results = results.slice(0, limit);

    return {
      content: [{ type: 'text', text: JSON.stringify({ totalResults: results.length, results }, null, 2) }],
    };
  } catch (error) {
    // Re-surface client errors with their structured metadata
    if (error instanceof InvalidParameterError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          totalResults: 0,
          results: [],
          error: { type: error.code, message: error.message, retryable: error.retryable },
        }, null, 2) }],
        isError: true,
      };
    }
    // Backend / connector failures → ServerToolCallError
    const wrapped = new ServerToolCallError(
      error instanceof Error ? error.message : String(error),
      'SEARCH_BACKEND_ERROR',
    );
    return {
      content: [{ type: 'text', text: JSON.stringify({
        totalResults: 0,
        results: [],
        error: { type: wrapped.code, message: wrapped.message, retryable: wrapped.retryable, degraded: true },
      }, null, 2) }],
      isError: true,
    };
  }
};
