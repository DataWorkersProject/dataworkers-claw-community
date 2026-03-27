/**
 * data-context-mcp — Standalone MCP server for data context & catalog.
 *
 * Registers all tools from dw-context-catalog with license-tier gating:
 * - Read-only tools: available on all tiers (community, pro, enterprise)
 * - Write tools: gated to pro+ via DW_LICENSE_TIER env var
 * - Admin tools: gated to enterprise via DW_LICENSE_TIER env var
 *
 * Uses InMemory backends by default so there are zero external dependencies
 * for first-time users. Set connector env vars (SNOWFLAKE_ACCOUNT, etc.)
 * to connect to real data platforms.
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';

// ── Tool imports from dw-context-catalog ──

// Read-only tools (free tier)
import { searchDatasetsDefinition, searchDatasetsHandler } from '../../../agents/dw-context-catalog/src/tools/search-datasets.js';
import { searchAcrossPlatformsDefinition, searchAcrossPlatformsHandler } from '../../../agents/dw-context-catalog/src/tools/search-across-platforms.js';
import { getLineageDefinition, getLineageHandler } from '../../../agents/dw-context-catalog/src/tools/get-lineage.js';
import { resolveMetricDefinition, resolveMetricHandler } from '../../../agents/dw-context-catalog/src/tools/resolve-metric.js';
import { listSemanticDefinitionsDefinition, listSemanticDefinitionsHandler } from '../../../agents/dw-context-catalog/src/tools/list-semantic-definitions.js';
import { getDocumentationDefinition, getDocumentationHandler } from '../../../agents/dw-context-catalog/src/tools/get-documentation.js';
import { checkFreshnessDefinition, checkFreshnessHandler } from '../../../agents/dw-context-catalog/src/tools/check-freshness.js';
import { getContextDefinition, getContextHandler } from '../../../agents/dw-context-catalog/src/tools/get-context.js';
import { assessImpactDefinition, assessImpactHandler } from '../../../agents/dw-context-catalog/src/tools/assess-impact.js';
import { blastRadiusAnalysisDefinition, blastRadiusAnalysisHandler } from '../../../agents/dw-context-catalog/src/tools/blast-radius-analysis.js';
import { traceCrossPlatformLineageDefinition, traceCrossPlatformLineageHandler } from '../../../agents/dw-context-catalog/src/tools/trace-cross-platform-lineage.js';
import { explainTableDefinition, explainTableHandler } from '../../../agents/dw-context-catalog/src/tools/explain-table.js';
import { detectDeadAssetsDefinition, detectDeadAssetsHandler } from '../../../agents/dw-context-catalog/src/tools/detect-dead-assets.js';
import { correlateMetadataDefinition, correlateMetadataHandler } from '../../../agents/dw-context-catalog/src/tools/correlate-metadata.js';
import { getTableSchemaForSqlDefinition, getTableSchemaForSqlHandler } from '../../../agents/dw-context-catalog/src/tools/get-table-schema-for-sql.js';
import { queryRulesDefinition, queryRulesHandler } from '../../../agents/dw-context-catalog/src/tools/query-rules.js';
import { getAuthoritativeSourceDefinition, getAuthoritativeSourceHandler } from '../../../agents/dw-context-catalog/src/tools/get-authoritative-source.js';
import { analyzeQueryHistoryDefinition, analyzeQueryHistoryHandler } from '../../../agents/dw-context-catalog/src/tools/analyze-query-history.js';
import { identifyGoldenPathDefinition, identifyGoldenPathHandler } from '../../../agents/dw-context-catalog/src/tools/identify-golden-path.js';
import { checkStalenessDefinition, checkStalenessHandler } from '../../../agents/dw-context-catalog/src/tools/check-staleness.js';

// Write tools (pro+ tier)
import { generateDocumentationDefinition, generateDocumentationHandler } from '../../../agents/dw-context-catalog/src/tools/generate-documentation.js';
import { updateLineageDefinition, updateLineageHandler } from '../../../agents/dw-context-catalog/src/tools/update-lineage.js';
import { autoTagDatasetDefinition, autoTagDatasetHandler } from '../../../agents/dw-context-catalog/src/tools/auto-tag-dataset.js';
import { flagDocumentationGapDefinition, flagDocumentationGapHandler } from '../../../agents/dw-context-catalog/src/tools/flag-documentation-gap.js';
import { defineBusinessRuleDefinition, defineBusinessRuleHandler } from '../../../agents/dw-context-catalog/src/tools/define-business-rule.js';
import { importTribalKnowledgeDefinition, importTribalKnowledgeHandler } from '../../../agents/dw-context-catalog/src/tools/import-tribal-knowledge.js';
import { updateBusinessRuleDefinition, updateBusinessRuleHandler } from '../../../agents/dw-context-catalog/src/tools/update-business-rule.js';
import { markAuthoritativeDefinition, markAuthoritativeHandler } from '../../../agents/dw-context-catalog/src/tools/mark-authoritative.js';
import { revokeAuthorityDefinition, revokeAuthorityHandler } from '../../../agents/dw-context-catalog/src/tools/revoke-authority.js';
import { correctResponseDefinition, correctResponseHandler } from '../../../agents/dw-context-catalog/src/tools/correct-response.js';
import { flagStaleContextDefinition, flagStaleContextHandler } from '../../../agents/dw-context-catalog/src/tools/flag-stale-context.js';

// Admin tools (enterprise tier)
import { ingestUnstructuredContextDefinition, ingestUnstructuredContextHandler } from '../../../agents/dw-context-catalog/src/tools/ingest-unstructured-context.js';
import { runDataStewardDefinition, runDataStewardHandler } from '../../../agents/dw-context-catalog/src/tools/run-data-steward.js';

// ── Resources ──
import { catalogSchemaDefinition, catalogSchemaHandler } from '../../../agents/dw-context-catalog/src/resources/catalog-schema.js';
import { supportedPlatformsDefinition, supportedPlatformsHandler } from '../../../agents/dw-context-catalog/src/resources/supported-platforms.js';
import { qualityDimensionsDefinition, qualityDimensionsHandler } from '../../../agents/dw-context-catalog/src/resources/quality-dimensions.js';

// ── Prompts ──
import { discoverMyDataDefinition, discoverMyDataHandler } from '../../../agents/dw-context-catalog/src/prompts/discover-my-data.js';
import { traceThisColumnDefinition, traceThisColumnHandler } from '../../../agents/dw-context-catalog/src/prompts/trace-this-column.js';
import { assessChangeImpactDefinition, assessChangeImpactHandler } from '../../../agents/dw-context-catalog/src/prompts/assess-change-impact.js';

const AGENT_ID = 'dw-context-catalog';

/**
 * Create and configure the standalone data-context MCP server.
 * All tools are registered with enterprise middleware and license-tier gating
 * is enforced at the framework level via createGatedHandler.
 */
export function createServer(): DataWorkersMCPServer {
  const server = new DataWorkersMCPServer({
    name: 'data-context-mcp',
    version: '0.1.0',
    description:
      'Standalone Data Context & Catalog MCP server — search, lineage, docs, impact analysis. ' +
      'Free tier: 20 read-only tools. Pro tier: +11 write tools. Enterprise: +2 admin tools.',
  });

  // ── Read-only tools (available on all tiers) ──
  server.registerTool(searchDatasetsDefinition, withMiddleware(AGENT_ID, 'search_datasets', searchDatasetsHandler));
  server.registerTool(searchAcrossPlatformsDefinition, withMiddleware(AGENT_ID, 'search_across_platforms', searchAcrossPlatformsHandler));
  server.registerTool(getLineageDefinition, withMiddleware(AGENT_ID, 'get_lineage', getLineageHandler));
  server.registerTool(resolveMetricDefinition, withMiddleware(AGENT_ID, 'resolve_metric', resolveMetricHandler));
  server.registerTool(listSemanticDefinitionsDefinition, withMiddleware(AGENT_ID, 'list_semantic_definitions', listSemanticDefinitionsHandler));
  server.registerTool(getDocumentationDefinition, withMiddleware(AGENT_ID, 'get_documentation', getDocumentationHandler));
  server.registerTool(checkFreshnessDefinition, withMiddleware(AGENT_ID, 'check_freshness', checkFreshnessHandler));
  server.registerTool(getContextDefinition, withMiddleware(AGENT_ID, 'get_context', getContextHandler));
  server.registerTool(assessImpactDefinition, withMiddleware(AGENT_ID, 'assess_impact', assessImpactHandler));
  server.registerTool(blastRadiusAnalysisDefinition, withMiddleware(AGENT_ID, 'blast_radius_analysis', blastRadiusAnalysisHandler));
  server.registerTool(traceCrossPlatformLineageDefinition, withMiddleware(AGENT_ID, 'trace_cross_platform_lineage', traceCrossPlatformLineageHandler));
  server.registerTool(explainTableDefinition, withMiddleware(AGENT_ID, 'explain_table', explainTableHandler));
  server.registerTool(detectDeadAssetsDefinition, withMiddleware(AGENT_ID, 'detect_dead_assets', detectDeadAssetsHandler));
  server.registerTool(correlateMetadataDefinition, withMiddleware(AGENT_ID, 'correlate_metadata', correlateMetadataHandler));
  server.registerTool(getTableSchemaForSqlDefinition, withMiddleware(AGENT_ID, 'get_table_schema_for_sql', getTableSchemaForSqlHandler));
  server.registerTool(queryRulesDefinition, withMiddleware(AGENT_ID, 'query_rules', queryRulesHandler));
  server.registerTool(getAuthoritativeSourceDefinition, withMiddleware(AGENT_ID, 'get_authoritative_source', getAuthoritativeSourceHandler));
  server.registerTool(analyzeQueryHistoryDefinition, withMiddleware(AGENT_ID, 'analyze_query_history', analyzeQueryHistoryHandler));
  server.registerTool(identifyGoldenPathDefinition, withMiddleware(AGENT_ID, 'identify_golden_path', identifyGoldenPathHandler));
  server.registerTool(checkStalenessDefinition, withMiddleware(AGENT_ID, 'check_staleness', checkStalenessHandler));

  // ── Write tools (pro+ tier — gated by framework via tool-gate.ts) ──
  server.registerTool(generateDocumentationDefinition, withMiddleware(AGENT_ID, 'generate_documentation', generateDocumentationHandler));
  server.registerTool(updateLineageDefinition, withMiddleware(AGENT_ID, 'update_lineage', updateLineageHandler));
  server.registerTool(autoTagDatasetDefinition, withMiddleware(AGENT_ID, 'auto_tag_dataset', autoTagDatasetHandler));
  server.registerTool(flagDocumentationGapDefinition, withMiddleware(AGENT_ID, 'flag_documentation_gap', flagDocumentationGapHandler));
  server.registerTool(defineBusinessRuleDefinition, withMiddleware(AGENT_ID, 'define_business_rule', defineBusinessRuleHandler));
  server.registerTool(importTribalKnowledgeDefinition, withMiddleware(AGENT_ID, 'import_tribal_knowledge', importTribalKnowledgeHandler));
  server.registerTool(updateBusinessRuleDefinition, withMiddleware(AGENT_ID, 'update_business_rule', updateBusinessRuleHandler));
  server.registerTool(markAuthoritativeDefinition, withMiddleware(AGENT_ID, 'mark_authoritative', markAuthoritativeHandler));
  server.registerTool(revokeAuthorityDefinition, withMiddleware(AGENT_ID, 'revoke_authority', revokeAuthorityHandler));
  server.registerTool(correctResponseDefinition, withMiddleware(AGENT_ID, 'correct_response', correctResponseHandler));
  server.registerTool(flagStaleContextDefinition, withMiddleware(AGENT_ID, 'flag_stale_context', flagStaleContextHandler));

  // ── Admin tools (enterprise tier — gated by framework via tool-gate.ts) ──
  server.registerTool(ingestUnstructuredContextDefinition, withMiddleware(AGENT_ID, 'ingest_unstructured_context', ingestUnstructuredContextHandler));
  server.registerTool(runDataStewardDefinition, withMiddleware(AGENT_ID, 'run_data_steward', runDataStewardHandler));

  // ── Resources ──
  server.registerResource(catalogSchemaDefinition, catalogSchemaHandler);
  server.registerResource(supportedPlatformsDefinition, supportedPlatformsHandler);
  server.registerResource(qualityDimensionsDefinition, qualityDimensionsHandler);

  // ── Prompts ──
  server.registerPrompt(discoverMyDataDefinition, discoverMyDataHandler);
  server.registerPrompt(traceThisColumnDefinition, traceThisColumnHandler);
  server.registerPrompt(assessChangeImpactDefinition, assessChangeImpactHandler);

  server.captureCapabilities();

  return server;
}
