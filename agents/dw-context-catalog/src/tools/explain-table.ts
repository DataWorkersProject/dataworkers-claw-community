/**
 * explain_table MCP tool — the Hero Tool.
 *
 * "Tell me everything about this table" in a single call.
 * Composes search, entity resolution, lineage, freshness, quality,
 * cost, incident data, documentation, and trust score into one
 * comprehensive response.
 *
 * Uses Promise.allSettled so individual section failures never
 * blow up the whole response — they degrade gracefully.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { InvalidParameterError, ServerToolCallError } from '@data-workers/mcp-framework';
import { graphDB, catalogRegistry } from '../backends.js';
import { EntityResolver } from '../search/entity-resolver.js';
import { FreshnessTracker } from '../search/freshness-tracker.js';
import { DocumentationGenerator } from '../search/documentation-generator.js';
import { TrustScorer } from '../search/trust-scorer.js';
import { traceAcrossPlatforms } from '../search/lineage-api.js';
import type { TrustScore } from '../search/trust-scorer.js';
import type { Documentation } from '../types.js';
import type { CrossPlatformLineageResult } from '../search/lineage-api.js';
import type { IGraphDB, GraphNode } from '@data-workers/infrastructure-stubs';

// ── Shared service instances ──

const freshnessTracker = new FreshnessTracker();
const docGenerator = new DocumentationGenerator();
const trustScorer = new TrustScorer(freshnessTracker);
const entityResolver = new EntityResolver(graphDB as IGraphDB, catalogRegistry);

// ── Types ──

interface SectionResult<T> {
  available: true;
  data: T;
  durationMs: number;
  source: string;
}

interface SectionUnavailable {
  available: false;
  reason: string;
  durationMs?: number;
}

type Section<T> = SectionResult<T> | SectionUnavailable;

interface LineageSummary {
  upstream: Array<{ id: string; name: string; type: string; platform: string; depth: number }>;
  downstream: Array<{ id: string; name: string; type: string; platform: string; depth: number }>;
  crossPlatformEdges: number;
  platformsQueried: string[];
}

interface FreshnessSummary {
  lastUpdated: number;
  freshnessScore: number;
  slaCompliant: boolean;
  ageHours: number;
  alert?: string;
}

interface DocumentationSummary {
  description: string;
  columns?: Array<{ name: string; description: string; type: string }>;
  lineageSummary: string;
  qualityScore: number;
  confidence: number;
}

interface QualityPlaceholder {
  overallScore?: number;
  dimensionScores?: Record<string, number>;
  ruleResults?: unknown[];
}

interface CostPlaceholder {
  monthlyEstimate?: number;
  currency?: string;
  breakdown?: Record<string, number>;
}

interface IncidentPlaceholder {
  activeIncidents?: number;
  recentIncidents?: unknown[];
  mttr?: number;
}

export interface ExplainTableResult {
  found: boolean;
  tableIdentifier?: string;
  message?: string;
  asset?: {
    id: string;
    name: string;
    type: string;
    platform: string;
    customerId: string;
    database?: string;
    schema?: string;
    properties: Record<string, unknown>;
  };
  schema?: {
    columns: Array<{ name: string; type: string }>;
    columnCount: number;
  };
  lineage?: Section<LineageSummary>;
  freshness?: Section<FreshnessSummary>;
  documentation?: Section<DocumentationSummary>;
  trustScore?: Section<TrustScore>;
  quality?: Section<QualityPlaceholder>;
  cost?: Section<CostPlaceholder>;
  incidents?: Section<IncidentPlaceholder>;
  classifiedTags?: string[];
  metadata: {
    generatedAt: number;
    totalDurationMs: number;
    sectionsRequested: string[];
    sectionsAvailable: string[];
    sectionsFailed: string[];
    platformsQueried: string[];
    provenance: Record<string, string>;
  };
}

// ── Constants ──

const SECTION_TIMEOUT_MS = 5000;

// ── Tool Definition ──

export const explainTableDefinition: ToolDefinition = {
  name: 'explain_table',
  description:
    'The hero tool: tell me everything about a table in one call. ' +
    'Composes entity resolution, schema, lineage, freshness, quality, cost, ' +
    'incidents, documentation, and trust score into a single comprehensive response. ' +
    'Any section that times out or fails is omitted gracefully.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: {
        type: 'string',
        description: 'Table name, qualified name (db.schema.table), or natural-language search query. Preferred parameter name.',
      },
      tableIdentifier: {
        type: 'string',
        description: '[Deprecated alias for assetId] Table name, qualified name, or search query.',
      },
      customerId: {
        type: 'string',
        description: 'Customer/tenant ID. Defaults to cust-001.',
      },
      includeLineage: {
        type: 'boolean',
        description: 'Include upstream/downstream lineage (default true).',
      },
      includeQuality: {
        type: 'boolean',
        description: 'Include data quality section (default true).',
      },
      includeCost: {
        type: 'boolean',
        description: 'Include cost estimation section (default true).',
      },
      includeIncidents: {
        type: 'boolean',
        description: 'Include incident history section (default true).',
      },
      slimMode: {
        type: 'boolean',
        description: 'When true, trim response for smaller LLM context windows (default false).',
      },
    },
    required: [],
  },
};

// ── Helpers ──

/**
 * Race a promise against a timeout. Returns the result or throws on timeout.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Wrap a section-producing async function with timeout and error handling.
 */
async function runSection<T>(
  name: string,
  source: string,
  fn: () => Promise<T>,
): Promise<Section<T>> {
  const start = Date.now();
  try {
    const data = await withTimeout(fn(), SECTION_TIMEOUT_MS);
    return { available: true, data, durationMs: Date.now() - start, source };
  } catch (err) {
    const reason = err instanceof Error && err.message === 'timeout' ? 'timeout' : (err instanceof Error ? err.message : String(err));
    return { available: false, reason, durationMs: Date.now() - start };
  }
}

// ── Handler ──

export const explainTableHandler: ToolHandler = async (args) => {
  const startTime = Date.now();

  // Accept assetId (standard), tableIdentifier, or assetIdentifier as aliases
  const tableIdentifier = (args.assetId ?? args.tableIdentifier ?? args.assetIdentifier) as string;
  const customerId = (args.customerId as string) || 'cust-001';
  const includeLineage = args.includeLineage !== false;
  const includeQuality = args.includeQuality !== false;
  const includeCost = args.includeCost !== false;
  const includeIncidents = args.includeIncidents !== false;
  const slimMode = args.slimMode === true;

  if (!tableIdentifier || typeof tableIdentifier !== 'string') {
    throw new InvalidParameterError('Parameter "tableIdentifier" is required and must be a string.');
  }

  try {
    // ── Step 1: Resolve the table ──
    // Try direct graph lookup first, then entity resolver for fuzzy/qualified matching
    let node: GraphNode | undefined;

    node = (await graphDB.getNode(tableIdentifier)) ?? undefined;
    if (!node) {
      const byName = await graphDB.findByName(tableIdentifier, customerId);
      node = byName[0] ?? undefined;
    }

    // If still not found, try entity resolver for fuzzy matching (filter to table/view/model types)
    if (!node) {
      const matches = await entityResolver.resolve(tableIdentifier, customerId, {
        maxCandidates: 1,
        minConfidence: 0.5,
        entityType: undefined, // accept table, view, or model — but exact name match is preferred via sort
      });
      if (matches.length > 0) {
        node = (await graphDB.getNode(matches[0].assetId)) ?? undefined;
      }
    }

    if (!node || node.customerId !== customerId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            found: false,
            tableIdentifier,
            message: `No table found matching '${tableIdentifier}' for customer '${customerId}'. Try a different name or run a crawler.`,
            metadata: {
              generatedAt: Date.now(),
              totalDurationMs: Date.now() - startTime,
              sectionsRequested: [],
              sectionsAvailable: [],
              sectionsFailed: [],
              platformsQueried: [],
              provenance: {},
            },
          } satisfies ExplainTableResult, null, 2),
        }],
      };
    }

    // ── Step 2: Extract schema from node ──
    const columns = (node.properties.columns as Array<{ name: string; type: string }>) ?? [];

    // ── Step 3: Run all sections in parallel with Promise.allSettled ──
    const sectionsRequested: string[] = ['freshness', 'documentation', 'trustScore'];
    if (includeLineage) sectionsRequested.push('lineage');
    if (includeQuality) sectionsRequested.push('quality');
    if (includeCost) sectionsRequested.push('cost');
    if (includeIncidents) sectionsRequested.push('incidents');

    const [
      lineageResult,
      freshnessResult,
      documentationResult,
      trustScoreResult,
      qualityResult,
      costResult,
      incidentsResult,
    ] = await Promise.allSettled([
      // Lineage
      includeLineage
        ? runSection<LineageSummary>('lineage', 'lineage-api', async () => {
            const lineage: CrossPlatformLineageResult = await traceAcrossPlatforms(
              node.id,
              {
                customerId,
                direction: 'both',
                maxDepth: 2,
                includeColumnLineage: false,
                includeOrchestration: false,
              },
              graphDB as IGraphDB,
              catalogRegistry,
            );
            return {
              upstream: lineage.upstream.map(u => ({
                id: u.id, name: u.name, type: u.type, platform: u.platform, depth: u.depth,
              })),
              downstream: lineage.downstream.map(d => ({
                id: d.id, name: d.name, type: d.type, platform: d.platform, depth: d.depth,
              })),
              crossPlatformEdges: lineage.crossPlatformEdges.length,
              platformsQueried: lineage.platformsQueried,
            };
          })
        : Promise.resolve<Section<LineageSummary>>({ available: false, reason: 'excluded_by_request' }),

      // Freshness
      runSection<FreshnessSummary>('freshness', 'freshness-tracker', async () => {
        const f = await freshnessTracker.checkFreshness(node.id, customerId);
        return {
          lastUpdated: f.lastUpdated,
          freshnessScore: f.freshnessScore,
          slaCompliant: f.slaCompliant,
          ageHours: f.ageHours,
          alert: f.alert,
        };
      }),

      // Documentation
      runSection<DocumentationSummary>('documentation', 'documentation-generator', async () => {
        const doc: Documentation = await docGenerator.generateDocumentation(node.id, customerId);
        return {
          description: doc.description,
          columns: doc.columns,
          lineageSummary: doc.lineageSummary,
          qualityScore: doc.qualityScore,
          confidence: doc.confidence,
        };
      }),

      // Trust score
      runSection<TrustScore>('trustScore', 'trust-scorer', async () => {
        return trustScorer.computeTrustScore(node.id, customerId, graphDB as IGraphDB);
      }),

      // Quality — cross-agent placeholder
      includeQuality
        ? Promise.resolve<Section<QualityPlaceholder>>({
            available: false,
            // TODO: Wire cross-agent call to dw-quality agent when agent mesh is available
            reason: 'cross_agent_not_wired',
          })
        : Promise.resolve<Section<QualityPlaceholder>>({ available: false, reason: 'excluded_by_request' }),

      // Cost — cross-agent placeholder
      includeCost
        ? Promise.resolve<Section<CostPlaceholder>>({
            available: false,
            // TODO: Wire cross-agent call to dw-cost agent when agent mesh is available
            reason: 'cross_agent_not_wired',
          })
        : Promise.resolve<Section<CostPlaceholder>>({ available: false, reason: 'excluded_by_request' }),

      // Incidents — cross-agent placeholder
      includeIncidents
        ? Promise.resolve<Section<IncidentPlaceholder>>({
            available: false,
            // TODO: Wire cross-agent call to dw-incidents agent when agent mesh is available
            reason: 'cross_agent_not_wired',
          })
        : Promise.resolve<Section<IncidentPlaceholder>>({ available: false, reason: 'excluded_by_request' }),
    ]);

    // ── Step 4: Unwrap allSettled results ──
    const unwrap = <T>(settled: PromiseSettledResult<Section<T>>, name: string): Section<T> => {
      if (settled.status === 'fulfilled') return settled.value;
      return { available: false, reason: settled.reason?.message ?? 'unknown_error' };
    };

    const lineage = unwrap(lineageResult, 'lineage');
    const freshness = unwrap(freshnessResult, 'freshness');
    const documentation = unwrap(documentationResult, 'documentation');
    const trustScore = unwrap(trustScoreResult, 'trustScore');
    const quality = unwrap(qualityResult, 'quality');
    const cost = unwrap(costResult, 'cost');
    const incidents = unwrap(incidentsResult, 'incidents');

    // ── Step 5: Build classification tags ──
    const tags: string[] = [];
    if (node.type) tags.push(`type:${node.type}`);
    if (node.platform) tags.push(`platform:${node.platform}`);

    if (lineage.available) {
      const data = lineage.data;
      if (data.upstream.length === 0) tags.push('classification:source');
      else if (data.downstream.length === 0) tags.push('classification:terminal');
      else tags.push('classification:intermediate');
      if (data.downstream.some(d => d.type === 'dashboard')) tags.push('feeds:dashboards');
    }

    // ── Step 6: Collect metadata ──
    const sectionsAvailable: string[] = [];
    const sectionsFailed: string[] = [];
    const provenance: Record<string, string> = {};
    const allPlatformsQueried = new Set<string>([node.platform]);

    const checkSection = (name: string, section: Section<unknown>) => {
      if (section.available) {
        sectionsAvailable.push(name);
        provenance[name] = (section as SectionResult<unknown>).source;
      } else {
        const reason = (section as SectionUnavailable).reason;
        if (reason !== 'excluded_by_request') {
          sectionsFailed.push(name);
          provenance[name] = `unavailable:${reason}`;
        }
      }
    };

    checkSection('lineage', lineage);
    checkSection('freshness', freshness);
    checkSection('documentation', documentation);
    checkSection('trustScore', trustScore);
    checkSection('quality', quality);
    checkSection('cost', cost);
    checkSection('incidents', incidents);

    if (lineage.available) {
      for (const p of lineage.data.platformsQueried) allPlatformsQueried.add(p);
    }

    // ── Step 7: Compose result ──
    const result: ExplainTableResult = {
      found: true,
      asset: {
        id: node.id,
        name: node.name,
        type: node.type,
        platform: node.platform,
        customerId: node.customerId,
        database: node.properties.database as string | undefined,
        schema: node.properties.schema as string | undefined,
        properties: slimMode ? {} : node.properties,
      },
      schema: columns.length > 0
        ? {
            columns: slimMode ? columns.slice(0, 20) : columns,
            columnCount: columns.length,
          }
        : undefined,
      lineage: includeLineage ? (slimMode && lineage.available
        ? {
            ...lineage,
            data: {
              ...lineage.data,
              upstream: lineage.data.upstream.slice(0, 10),
              downstream: lineage.data.downstream.slice(0, 10),
            },
          }
        : lineage) : undefined,
      freshness,
      documentation,
      trustScore,
      quality: includeQuality ? quality : undefined,
      cost: includeCost ? cost : undefined,
      incidents: includeIncidents ? incidents : undefined,
      classifiedTags: tags,
      metadata: {
        generatedAt: Date.now(),
        totalDurationMs: Date.now() - startTime,
        sectionsRequested,
        sectionsAvailable,
        sectionsFailed,
        platformsQueried: Array.from(allPlatformsQueried),
        provenance,
      },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const wrapped = err instanceof ServerToolCallError
      ? err
      : new ServerToolCallError(
          err instanceof Error ? err.message : String(err),
          'EXPLAIN_TABLE_ERROR',
        );
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: wrapped.message,
          code: wrapped.code,
          retryable: wrapped.retryable,
        }),
      }],
      isError: true,
    };
  }
};
