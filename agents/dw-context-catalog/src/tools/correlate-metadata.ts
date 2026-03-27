/**
 * correlate_metadata — Cross-platform metadata enrichment.
 *
 * Resolves an asset across platforms via EntityResolver, queries each
 * matched platform for full metadata, and merges results with
 * newest-value-wins conflict resolution and provenance tracking.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { InvalidParameterError, ServerToolCallError } from '@data-workers/mcp-framework';
import type { IGraphDB, GraphNode } from '@data-workers/infrastructure-stubs';
import type { ICatalogProvider, TableMetadata, ColumnMetadata } from '@data-workers/connector-shared';
import { EntityResolver, type EntityMatch } from '../search/entity-resolver.js';
import { graphDB, getCatalogRegistry } from '../backends.js';

export const correlateMetadataDefinition: ToolDefinition = {
  name: 'correlate_metadata',
  description:
    'Cross-platform metadata enrichment. Resolves an asset across connected platforms using entity resolution, fetches full metadata from each, and merges into an enriched profile with provenance tracking and confidence scores.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: {
        type: 'string',
        description: 'Asset name or qualified name (e.g., "orders" or "analytics.public.orders"). Preferred parameter name.',
      },
      assetIdentifier: {
        type: 'string',
        description: '[Deprecated alias for assetId] Asset name or qualified name.',
      },
      customerId: {
        type: 'string',
        description: 'Customer/tenant ID. Defaults to "default".',
      },
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of platforms to search (e.g., ["snowflake", "bigquery"]). Omit to search all.',
      },
      entityType: {
        type: 'string',
        enum: ['table', 'view', 'model', 'pipeline', 'dashboard', 'metric'],
        description: 'Filter entity resolution to a specific asset type (e.g., "table"). Prevents cross-type matching.',
      },
    },
    required: [],
  },
};

/** A single platform's contribution to the enriched metadata. */
interface PlatformContribution {
  platform: string;
  assetId: string;
  fields: string[];
  confidence: number;
  updatedAt?: number;
}

/** Enriched metadata merged from all platforms. */
interface EnrichedMetadata {
  name?: string;
  description?: string;
  columns?: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    comment?: string;
    source: string;
  }>;
  tags?: string[];
  owner?: string;
  database?: string;
  schema?: string;
  type?: string;
  properties?: Record<string, unknown>;
  lastUpdated?: number;
}

interface CorrelateResult {
  assetId: string;
  enrichedMetadata: EnrichedMetadata;
  platformContributions: PlatformContribution[];
  entityResolution: {
    matches: EntityMatch[];
    method: string;
    confidence: number;
  };
}

// Module-level resolver wired to shared backends
const resolver = new EntityResolver(graphDB as IGraphDB, getCatalogRegistry());

/**
 * Try to fetch connector metadata for a platform asset.
 * Returns undefined when the connector is unavailable or the table is not found.
 */
async function fetchConnectorMetadata(
  platform: string,
  node: GraphNode,
): Promise<TableMetadata | undefined> {
  const registry = getCatalogRegistry();
  const registeredTypes = registry.list();

  // Find a matching registered connector for this platform
  const connectorType = registeredTypes.find(
    (t) => t.toLowerCase() === platform.toLowerCase(),
  );
  if (!connectorType) return undefined;

  try {
    const provider: ICatalogProvider = registry.create(connectorType);
    const namespace =
      (node.properties.schema as string) ??
      (node.properties.database as string) ??
      'default';
    return await provider.getTableMetadata(namespace, node.name);
  } catch {
    // Connector unavailable or table not found — graceful degradation
    return undefined;
  }
}

/**
 * Build enriched metadata from a graph node's properties.
 */
function metadataFromNode(node: GraphNode): Partial<EnrichedMetadata> {
  const props = node.properties;
  const meta: Partial<EnrichedMetadata> = {
    name: node.name,
    type: node.type,
  };

  if (props.description) meta.description = props.description as string;
  if (props.database) meta.database = props.database as string;
  if (props.schema) meta.schema = props.schema as string;
  if (props.owner) meta.owner = props.owner as string;
  if (props.tags && Array.isArray(props.tags)) meta.tags = props.tags as string[];
  if (props.columns && Array.isArray(props.columns)) {
    meta.columns = (props.columns as Array<Record<string, unknown>>).map((c) => ({
      name: (c.name as string) ?? '',
      type: (c.type as string) ?? 'unknown',
      nullable: c.nullable as boolean | undefined,
      comment: c.comment as string | undefined,
      source: node.platform,
    }));
  }
  if (props.updatedAt) meta.lastUpdated = props.updatedAt as number;

  return meta;
}

/**
 * Build enriched metadata from a connector TableMetadata response.
 */
function metadataFromConnector(
  table: TableMetadata,
  platform: string,
): Partial<EnrichedMetadata> {
  const meta: Partial<EnrichedMetadata> = {
    name: table.name,
  };

  if (table.namespace?.length) {
    meta.database = table.namespace[0];
    if (table.namespace.length > 1) meta.schema = table.namespace[1];
  }
  if (table.properties) meta.properties = { ...table.properties };
  if (table.schema?.length) {
    meta.columns = table.schema.map((c: ColumnMetadata) => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable,
      comment: c.comment,
      source: platform,
    }));
  }
  if (table.updatedAt) meta.lastUpdated = table.updatedAt;

  return meta;
}

/**
 * Merge a partial metadata contribution into the enriched result.
 * Newest-value-wins: if updatedAt is newer, the new value takes precedence for scalar fields.
 * Arrays (tags, columns) are union-merged.
 */
function mergeMetadata(
  target: EnrichedMetadata,
  source: Partial<EnrichedMetadata>,
  _sourceUpdatedAt?: number,
): string[] {
  const contributed: string[] = [];

  const targetUpdated = target.lastUpdated ?? 0;
  const sourceUpdated = source.lastUpdated ?? _sourceUpdatedAt ?? 0;
  const sourceIsNewer = sourceUpdated >= targetUpdated;

  // Scalar fields — newest wins
  if (source.name && (!target.name || sourceIsNewer)) {
    target.name = source.name;
    contributed.push('name');
  }
  if (source.description && (!target.description || sourceIsNewer)) {
    target.description = source.description;
    contributed.push('description');
  }
  if (source.owner && (!target.owner || sourceIsNewer)) {
    target.owner = source.owner;
    contributed.push('owner');
  }
  if (source.database && (!target.database || sourceIsNewer)) {
    target.database = source.database;
    contributed.push('database');
  }
  if (source.schema && (!target.schema || sourceIsNewer)) {
    target.schema = source.schema;
    contributed.push('schema');
  }
  if (source.type && (!target.type || sourceIsNewer)) {
    target.type = source.type;
    contributed.push('type');
  }
  if (source.lastUpdated && (!target.lastUpdated || sourceIsNewer)) {
    target.lastUpdated = source.lastUpdated;
  }

  // Tags — union merge
  if (source.tags?.length) {
    const existing = new Set(target.tags ?? []);
    for (const tag of source.tags) {
      existing.add(tag);
    }
    target.tags = Array.from(existing);
    contributed.push('tags');
  }

  // Columns — union merge by name, newest wins per column
  if (source.columns?.length) {
    const columnMap = new Map<string, (typeof source.columns)[0]>();
    for (const col of target.columns ?? []) {
      columnMap.set(col.name.toLowerCase(), col);
    }
    for (const col of source.columns) {
      const key = col.name.toLowerCase();
      if (!columnMap.has(key) || sourceIsNewer) {
        columnMap.set(key, col);
      }
    }
    target.columns = Array.from(columnMap.values());
    contributed.push('columns');
  }

  // Properties — merge
  if (source.properties) {
    target.properties = { ...(target.properties ?? {}), ...source.properties };
    contributed.push('properties');
  }

  return contributed;
}

export const correlateMetadataHandler: ToolHandler = async (args) => {
  try {
    // Accept assetId (standard), assetIdentifier, or tableIdentifier as aliases
    const rawIdentifier = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier) as string | undefined;
    if (!rawIdentifier || typeof rawIdentifier !== 'string') {
      throw new InvalidParameterError(
        'Parameter "assetId" (or alias "assetIdentifier") is required and must be a non-empty string.',
      );
    }

    const assetIdentifier = rawIdentifier.trim();
    const customerId = (args.customerId as string) ?? 'default';
    const platforms = args.platforms as string[] | undefined;
    const entityType = args.entityType as string | undefined;

    // Step 1: Resolve entity across platforms (pass entityType filter)
    const matches = await resolver.resolve(assetIdentifier, customerId, {
      platforms,
      maxCandidates: 10,
      minConfidence: 0.5,
      entityType,
    });

    if (matches.length === 0) {
      const result: CorrelateResult = {
        assetId: assetIdentifier,
        enrichedMetadata: {},
        platformContributions: [],
        entityResolution: { matches: [], method: 'none', confidence: 0 },
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    // Step 2: For each match, gather metadata from graph + connector
    const enriched: EnrichedMetadata = {};
    const contributions: PlatformContribution[] = [];

    // Sort matches by confidence descending; within same confidence, process all
    const sortedMatches = [...matches].sort((a, b) => b.confidence - a.confidence);

    for (const match of sortedMatches) {
      // Fetch graph node for full properties
      const node = await (graphDB as IGraphDB).getNode(match.assetId);
      if (!node) continue;

      // Metadata from graph node
      const graphMeta = metadataFromNode(node);
      const graphFields = mergeMetadata(enriched, graphMeta);

      // Metadata from connector (if available)
      const connectorMeta = await fetchConnectorMetadata(match.platform, node);
      let connectorFields: string[] = [];
      if (connectorMeta) {
        const cMeta = metadataFromConnector(connectorMeta, match.platform);
        connectorFields = mergeMetadata(enriched, cMeta);
      }

      const allFields = Array.from(new Set([...graphFields, ...connectorFields]));
      if (allFields.length > 0) {
        contributions.push({
          platform: match.platform,
          assetId: match.assetId,
          fields: allFields,
          confidence: match.confidence,
          updatedAt: (node.properties.updatedAt as number) ?? undefined,
        });
      }
    }

    // Determine primary resolution method (highest confidence match)
    const bestMatch = sortedMatches[0];

    const result: CorrelateResult = {
      assetId: assetIdentifier,
      enrichedMetadata: enriched,
      platformContributions: contributions,
      entityResolution: {
        matches: sortedMatches,
        method: bestMatch.method,
        confidence: bestMatch.confidence,
      },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                assetId: args.assetId ?? args.assetIdentifier ?? '',
                enrichedMetadata: {},
                platformContributions: [],
                entityResolution: { matches: [], method: 'none', confidence: 0 },
                error: { type: error.code, message: error.message, retryable: error.retryable },
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    const wrapped = new ServerToolCallError(
      error instanceof Error ? error.message : String(error),
      'CORRELATE_METADATA_ERROR',
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              assetId: args.assetId ?? args.assetIdentifier ?? '',
              enrichedMetadata: {},
              platformContributions: [],
              entityResolution: { matches: [], method: 'none', confidence: 0 },
              error: { type: wrapped.code, message: wrapped.message, retryable: wrapped.retryable },
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
};
