/**
 * dw-context-catalog — Data Context & Catalog Agent
 *
 * MCP server exposing 6 data catalog tools:
 * - search_datasets: NL search over catalog
 * - get_lineage: Column-level lineage traversal
 * - resolve_metric: Metric disambiguation
 * - list_semantic_definitions: Semantic layer browsing
 * - get_documentation: Auto-generated asset docs
 * - check_freshness: Data freshness/SLA checks
 *
 * See REQ-CTX-AG-001 through REQ-CTX-AG-009.
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';
import type { ToolDefinition, ToolHandler, ToolResult, ContentBlock } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';

// ── Resources (static metadata, ) ──
import { catalogSchemaDefinition, catalogSchemaHandler } from './resources/catalog-schema.js';
import { supportedPlatformsDefinition, supportedPlatformsHandler } from './resources/supported-platforms.js';
import { qualityDimensionsDefinition, qualityDimensionsHandler } from './resources/quality-dimensions.js';

// ── Prompts (guided workflows, ) ──
import { discoverMyDataDefinition, discoverMyDataHandler } from './prompts/discover-my-data.js';
import { traceThisColumnDefinition, traceThisColumnHandler } from './prompts/trace-this-column.js';
import { assessChangeImpactDefinition, assessChangeImpactHandler } from './prompts/assess-change-impact.js';

import { searchDatasetsDefinition, searchDatasetsHandler } from './tools/search-datasets.js';
import { searchAcrossPlatformsDefinition, searchAcrossPlatformsHandler } from './tools/search-across-platforms.js';
import { getLineageDefinition, getLineageHandler } from './tools/get-lineage.js';
import { resolveMetricDefinition, resolveMetricHandler } from './tools/resolve-metric.js';
import { listSemanticDefinitionsDefinition, listSemanticDefinitionsHandler } from './tools/list-semantic-definitions.js';
import { getDocumentationDefinition, getDocumentationHandler } from './tools/get-documentation.js';
import { generateDocumentationDefinition, generateDocumentationHandler } from './tools/generate-documentation.js';
import { checkFreshnessDefinition, checkFreshnessHandler } from './tools/check-freshness.js';
import { getContextDefinition, getContextHandler } from './tools/get-context.js';
import { assessImpactDefinition, assessImpactHandler } from './tools/assess-impact.js';
import { blastRadiusAnalysisDefinition, blastRadiusAnalysisHandler } from './tools/blast-radius-analysis.js';
import { traceCrossPlatformLineageDefinition, traceCrossPlatformLineageHandler } from './tools/trace-cross-platform-lineage.js';
import { explainTableDefinition, explainTableHandler } from './tools/explain-table.js';
import { detectDeadAssetsDefinition, detectDeadAssetsHandler } from './tools/detect-dead-assets.js';
import { correlateMetadataDefinition, correlateMetadataHandler } from './tools/correlate-metadata.js';
import { updateLineageDefinition, updateLineageHandler } from './tools/update-lineage.js';
import { flagDocumentationGapDefinition, flagDocumentationGapHandler } from './tools/flag-documentation-gap.js';
import { autoTagDatasetDefinition, autoTagDatasetHandler } from './tools/auto-tag-dataset.js';
import { getTableSchemaForSqlDefinition, getTableSchemaForSqlHandler } from './tools/get-table-schema-for-sql.js';

// ── Context Intelligence tools ──
import { defineBusinessRuleDefinition, defineBusinessRuleHandler } from './tools/define-business-rule.js';
import { queryRulesDefinition, queryRulesHandler } from './tools/query-rules.js';
import { importTribalKnowledgeDefinition, importTribalKnowledgeHandler } from './tools/import-tribal-knowledge.js';
import { updateBusinessRuleDefinition, updateBusinessRuleHandler } from './tools/update-business-rule.js';
import { markAuthoritativeDefinition, markAuthoritativeHandler } from './tools/mark-authoritative.js';
import { getAuthoritativeSourceDefinition, getAuthoritativeSourceHandler } from './tools/get-authoritative-source.js';
import { revokeAuthorityDefinition, revokeAuthorityHandler } from './tools/revoke-authority.js';
import { analyzeQueryHistoryDefinition, analyzeQueryHistoryHandler } from './tools/analyze-query-history.js';
import { identifyGoldenPathDefinition, identifyGoldenPathHandler } from './tools/identify-golden-path.js';
import { correctResponseDefinition, correctResponseHandler } from './tools/correct-response.js';
import { checkStalenessDefinition, checkStalenessHandler } from './tools/check-staleness.js';
import { flagStaleContextDefinition, flagStaleContextHandler } from './tools/flag-stale-context.js';
import { ingestUnstructuredContextDefinition, ingestUnstructuredContextHandler } from './tools/ingest-unstructured-context.js';
import { runDataStewardDefinition, runDataStewardHandler } from './tools/run-data-steward.js';

// ── Tool Alias / Deprecation Support ──

const AGENT_ID = 'dw-context-catalog';

/**
 * Creates a deprecated alias handler that wraps the real handler and appends
 * a deprecation notice to the response. Old tool names continue to work
 * identically but clients are informed of the new name.
 */
function createDeprecatedAliasHandler(
  realHandler: ToolHandler,
  oldName: string,
  newName: string,
): ToolHandler {
  return async (args: Record<string, unknown>): Promise<ToolResult> => {
    const result = await realHandler(args);

    // Append deprecation notice to the first text content block
    const content = (result.content as any[]).map((block: { type: string; text?: string; [key: string]: unknown }) => {
      if (block.type === 'text' && block.text) {
        try {
          const parsed = JSON.parse(block.text);
          return {
            ...block,
            text: JSON.stringify({
              ...parsed,
              _deprecated: {
                oldName,
                newName,
                message: `'${oldName}' is deprecated. Use '${newName}' instead.`,
                removeBy: 'v3.0',
              },
            }, null, 2),
          };
        } catch {
          // Not JSON — append as plain text
          return {
            ...block,
            text: block.text + `\n\n[DEPRECATED] '${oldName}' is deprecated. Use '${newName}' instead. Will be removed in v3.0.`,
          };
        }
      }
      return block;
    });

    return { ...result, content: content as ContentBlock[] };
  };
}

/**
 * Creates a new ToolDefinition with a different name but identical schema
 * and a description noting it replaces the old name.
 */
function createAliasDefinition(
  original: ToolDefinition,
  newName: string,
): ToolDefinition {
  return {
    ...original,
    name: newName,
    description: original.description,
  };
}

// ── Alias mapping: oldName → newName (remaining aliases handled by loop below) ──
const toolAliases: Array<{
  oldDef: ToolDefinition;
  oldHandler: ToolHandler;
  newName: string;
}> = [];

const server = new DataWorkersMCPServer({
  name: AGENT_ID,
  version: '0.2.0',
  description: 'Data Context & Catalog Agent — crawl, index, document, lineage, search, context, impact analysis',
});

// Register tools that have NO alias (unchanged)
server.registerTool(resolveMetricDefinition, withMiddleware(AGENT_ID, 'resolve_metric', resolveMetricHandler));
server.registerTool(listSemanticDefinitionsDefinition, withMiddleware(AGENT_ID, 'list_semantic_definitions', listSemanticDefinitionsHandler));
server.registerTool(checkFreshnessDefinition, withMiddleware(AGENT_ID, 'check_freshness', checkFreshnessHandler));
// get_context deprecated in favor of explain_table
server.registerTool(getContextDefinition, withMiddleware(AGENT_ID, 'get_context', getContextHandler));

// Register explain_table — the Hero Tool
server.registerTool(explainTableDefinition, withMiddleware(AGENT_ID, 'explain_table', explainTableHandler));

// Register upgraded search_across_platforms (federated cross-platform search)
server.registerTool(searchAcrossPlatformsDefinition, withMiddleware(AGENT_ID, 'search_across_platforms', searchAcrossPlatformsHandler));

// Old search_datasets still works but shows deprecation notice pointing to search_across_platforms
server.registerTool(
  searchDatasetsDefinition,
  withMiddleware(AGENT_ID, 'search_datasets', createDeprecatedAliasHandler(searchDatasetsHandler, 'search_datasets', 'search_across_platforms')),
);

// Register upgraded trace_cross_platform_lineage (unified cross-platform lineage)
server.registerTool(traceCrossPlatformLineageDefinition, withMiddleware(AGENT_ID, 'trace_cross_platform_lineage', traceCrossPlatformLineageHandler));

// Old get_lineage still works but shows deprecation notice pointing to trace_cross_platform_lineage
server.registerTool(
  getLineageDefinition,
  withMiddleware(AGENT_ID, 'get_lineage', createDeprecatedAliasHandler(getLineageHandler, 'get_lineage', 'trace_cross_platform_lineage')),
);

// Register upgraded blast_radius_analysis (column-level, cross-platform, PR diff)
server.registerTool(blastRadiusAnalysisDefinition, withMiddleware(AGENT_ID, 'blast_radius_analysis', blastRadiusAnalysisHandler));

// Old assess_impact still works but shows deprecation notice pointing to blast_radius_analysis
server.registerTool(
  assessImpactDefinition,
  withMiddleware(AGENT_ID, 'assess_impact', createDeprecatedAliasHandler(assessImpactHandler, 'assess_impact', 'blast_radius_analysis')),
);

// Register upgraded generate_documentation with provenance & connector support
server.registerTool(generateDocumentationDefinition, withMiddleware(AGENT_ID, 'generate_documentation', generateDocumentationHandler));

// Old get_documentation still works but shows deprecation notice pointing to generate_documentation
server.registerTool(
  getDocumentationDefinition,
  withMiddleware(AGENT_ID, 'get_documentation', createDeprecatedAliasHandler(getDocumentationHandler, 'get_documentation', 'generate_documentation')),
);

// Register correlate_metadata — cross-platform enrichment
server.registerTool(correlateMetadataDefinition, withMiddleware(AGENT_ID, 'correlate_metadata', correlateMetadataHandler));

// Register detect_dead_assets — orphaned table/column/DAG finder
server.registerTool(detectDeadAssetsDefinition, withMiddleware(AGENT_ID, 'detect_dead_assets', detectDeadAssetsHandler));

// Register update_lineage — additive lineage edge management with soft-delete
server.registerTool(updateLineageDefinition, withMiddleware(AGENT_ID, 'update_lineage', updateLineageHandler));

// Register flag_documentation_gap — missing/stale doc scanner
server.registerTool(flagDocumentationGapDefinition, withMiddleware(AGENT_ID, 'flag_documentation_gap', flagDocumentationGapHandler));

// Register auto_tag_dataset — enterprise write tool with rollback
server.registerTool(autoTagDatasetDefinition, withMiddleware(AGENT_ID, 'auto_tag_dataset', autoTagDatasetHandler));

// Register get_table_schema_for_sql — schema info for SQL generation
server.registerTool(getTableSchemaForSqlDefinition, withMiddleware(AGENT_ID, 'get_table_schema_for_sql', getTableSchemaForSqlHandler));

// ── Business rule tools ──
server.registerTool(defineBusinessRuleDefinition, withMiddleware(AGENT_ID, 'define_business_rule', defineBusinessRuleHandler));
server.registerTool(queryRulesDefinition, withMiddleware(AGENT_ID, 'query_rules', queryRulesHandler));
server.registerTool(importTribalKnowledgeDefinition, withMiddleware(AGENT_ID, 'import_tribal_knowledge', importTribalKnowledgeHandler));
server.registerTool(updateBusinessRuleDefinition, withMiddleware(AGENT_ID, 'update_business_rule', updateBusinessRuleHandler));

// ── Authority designation tools ──
server.registerTool(markAuthoritativeDefinition, withMiddleware(AGENT_ID, 'mark_authoritative', markAuthoritativeHandler));
server.registerTool(getAuthoritativeSourceDefinition, withMiddleware(AGENT_ID, 'get_authoritative_source', getAuthoritativeSourceHandler));
server.registerTool(revokeAuthorityDefinition, withMiddleware(AGENT_ID, 'revoke_authority', revokeAuthorityHandler));

// ── Query history & golden path tools ──
server.registerTool(analyzeQueryHistoryDefinition, withMiddleware(AGENT_ID, 'analyze_query_history', analyzeQueryHistoryHandler));
server.registerTool(identifyGoldenPathDefinition, withMiddleware(AGENT_ID, 'identify_golden_path', identifyGoldenPathHandler));

// ── Correction, staleness & feedback tools ──
server.registerTool(correctResponseDefinition, withMiddleware(AGENT_ID, 'correct_response', correctResponseHandler));
server.registerTool(checkStalenessDefinition, withMiddleware(AGENT_ID, 'check_staleness', checkStalenessHandler));
server.registerTool(flagStaleContextDefinition, withMiddleware(AGENT_ID, 'flag_stale_context', flagStaleContextHandler));

// ── Unstructured context ingestion ──
server.registerTool(ingestUnstructuredContextDefinition, withMiddleware(AGENT_ID, 'ingest_unstructured_context', ingestUnstructuredContextHandler));

// ── Enterprise data steward workflow ──
server.registerTool(runDataStewardDefinition, withMiddleware(AGENT_ID, 'run_data_steward', runDataStewardHandler));

// Register aliased tools: both old (deprecated) and new names
for (const { oldDef, oldHandler, newName } of toolAliases) {
  // New canonical name — returns clean results
  server.registerTool(createAliasDefinition(oldDef, newName), withMiddleware(AGENT_ID, newName, oldHandler));

  // Old name — still works but appends deprecation notice
  server.registerTool(oldDef, withMiddleware(AGENT_ID, oldDef.name, createDeprecatedAliasHandler(oldHandler, oldDef.name, newName)));
}

// ── Resources ──
server.registerResource(catalogSchemaDefinition, catalogSchemaHandler);
server.registerResource(supportedPlatformsDefinition, supportedPlatformsHandler);
server.registerResource(qualityDimensionsDefinition, qualityDimensionsHandler);

// ── Prompts ──
server.registerPrompt(discoverMyDataDefinition, discoverMyDataHandler);
server.registerPrompt(traceThisColumnDefinition, traceThisColumnHandler);
server.registerPrompt(assessChangeImpactDefinition, assessChangeImpactHandler);

server.captureCapabilities();

export { server };
export default server;

// Stdio transport for standalone MCP server mode (OpenCode, etc.)
import { startStdioTransport } from '@data-workers/mcp-framework';

if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
