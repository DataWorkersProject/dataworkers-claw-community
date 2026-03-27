import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { SearchResult } from '../types.js';
import { CatalogSearchEngine } from '../search/catalog-search.js';
import { vectorStore, fullTextSearch, graphDB } from '../backends.js';

export const searchDatasetsDefinition: ToolDefinition = {
  name: 'search_datasets',
  description: 'Search the data catalog using natural language. Returns matching datasets with relevance scores. Supports filtering by platform, type, tags, and quality score.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language search query.' },
      customerId: { type: 'string' },
      platform: { type: 'string', description: 'Filter by platform (snowflake, bigquery, etc.).' },
      type: { type: 'string', enum: ['table', 'view', 'model', 'pipeline', 'dashboard', 'metric'] },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags.' },
      limit: { type: 'number', description: 'Max results. Default: 20.' },
    },
    required: ['query', 'customerId'],
  },
};

// Module-level search engine with seeded backends
const searchEngine = new CatalogSearchEngine({
  vectorStore,
  fullTextSearch,
  graphDB,
});

/**
 * Search the data catalog using hybrid retrieval (vector + BM25 + graph).
 * Post-filters results by platform, type, and tags if provided.
 * Fetches extra results to compensate for post-filtering to avoid under-filling.
 */
export const searchDatasetsHandler: ToolHandler = async (args) => {
  try {
    const query = (args.query as string).toLowerCase();
    const customerId = args.customerId as string;
    const platform = args.platform as string | undefined;
    const type = args.type as string | undefined;
    const tags = args.tags as string[] | undefined;
    const limit = (args.limit as number) ?? 20;

    // Fetch extra results when filters are active to avoid under-filling
    const hasFilters = !!(platform || type || (tags && tags.length > 0));
    const fetchLimit = hasFilters ? limit * 3 : limit;

    const searchResult = await searchEngine.search(query, customerId, fetchLimit);

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
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({
        totalResults: 0,
        results: [],
        error: { type: 'search_error', message, degraded: true },
      }, null, 2) }],
      isError: true,
    };
  }
};
