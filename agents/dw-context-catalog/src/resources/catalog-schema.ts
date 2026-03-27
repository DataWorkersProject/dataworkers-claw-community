/**
 * MCP Resource: Catalog Schema
 *
 * Static JSON resource describing the DataAsset schema used by the catalog agent.
 * Read-only metadata for clients to understand the data model.
 */

import type { ResourceDefinition, ResourceHandler } from '@data-workers/mcp-framework';

const schemaContent = JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'DataAsset',
  description: 'Core data asset entity in the Data Workers catalog',
  type: 'object',
  required: ['id', 'customerId', 'name', 'type', 'platform', 'description', 'tags', 'qualityScore', 'freshnessScore', 'lastUpdated', 'lastCrawled', 'metadata'],
  properties: {
    id: { type: 'string', description: 'Unique asset identifier' },
    customerId: { type: 'string', description: 'Owning customer/tenant ID' },
    name: { type: 'string', description: 'Fully qualified asset name (e.g. db.schema.table)' },
    type: {
      type: 'string',
      enum: ['table', 'view', 'model', 'pipeline', 'dashboard', 'metric', 'source'],
      description: 'Asset type classification',
    },
    platform: { type: 'string', description: 'Source platform (snowflake, bigquery, dbt, etc.)' },
    database: { type: 'string', description: 'Database name (optional)' },
    schema: { type: 'string', description: 'Schema name (optional)' },
    description: { type: 'string', description: 'Human-readable asset description' },
    columns: {
      type: 'array',
      description: 'Column-level metadata',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', description: 'SQL data type' },
          description: { type: 'string' },
          nullable: { type: 'boolean' },
          isPrimaryKey: { type: 'boolean' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'type', 'description', 'nullable', 'isPrimaryKey', 'tags'],
      },
    },
    tags: { type: 'array', items: { type: 'string' }, description: 'Classification tags' },
    owner: { type: 'string', description: 'Asset owner (optional)' },
    qualityScore: { type: 'number', minimum: 0, maximum: 1, description: 'Composite quality score (0-1)' },
    freshnessScore: { type: 'number', minimum: 0, maximum: 1, description: 'Freshness score (0-1)' },
    lastUpdated: { type: 'number', description: 'Epoch ms of last data update' },
    lastCrawled: { type: 'number', description: 'Epoch ms of last catalog crawl' },
    metadata: { type: 'object', description: 'Platform-specific metadata' },
  },
}, null, 2);

export const catalogSchemaDefinition: ResourceDefinition = {
  uri: 'catalog://schema/data-asset',
  name: 'DataAsset Schema',
  description: 'JSON Schema definition for the DataAsset entity — the core data model used by the catalog agent for all indexed assets.',
  mimeType: 'application/json',
};

export const catalogSchemaHandler: ResourceHandler = async (_uri: string) => ({
  contents: [{
    uri: 'catalog://schema/data-asset',
    mimeType: 'application/json',
    text: schemaContent,
  }],
});
