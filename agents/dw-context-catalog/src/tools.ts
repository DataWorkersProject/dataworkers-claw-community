/**
 * dw-context-catalog — Exported tool definitions and handlers.
 *
 * Exports all canonical tool definitions. Deprecated aliases are NOT included
 * here — the standalone index.ts handles alias registration with deprecation
 * wrappers. The unified server registers only canonical tools.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

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

// Context Intelligence tools
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

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const contextCatalogTools: ToolEntry[] = [
  // Core search & discovery
  { definition: searchDatasetsDefinition, handler: searchDatasetsHandler },
  { definition: searchAcrossPlatformsDefinition, handler: searchAcrossPlatformsHandler },
  { definition: resolveMetricDefinition, handler: resolveMetricHandler },
  { definition: listSemanticDefinitionsDefinition, handler: listSemanticDefinitionsHandler },
  { definition: checkFreshnessDefinition, handler: checkFreshnessHandler },
  { definition: getContextDefinition, handler: getContextHandler },

  // Hero tool
  { definition: explainTableDefinition, handler: explainTableHandler },

  // Lineage
  { definition: getLineageDefinition, handler: getLineageHandler },
  { definition: traceCrossPlatformLineageDefinition, handler: traceCrossPlatformLineageHandler },
  { definition: updateLineageDefinition, handler: updateLineageHandler },

  // Impact analysis
  { definition: assessImpactDefinition, handler: assessImpactHandler },
  { definition: blastRadiusAnalysisDefinition, handler: blastRadiusAnalysisHandler },

  // Documentation
  { definition: getDocumentationDefinition, handler: getDocumentationHandler },
  { definition: generateDocumentationDefinition, handler: generateDocumentationHandler },
  { definition: flagDocumentationGapDefinition, handler: flagDocumentationGapHandler },

  // Asset management
  { definition: detectDeadAssetsDefinition, handler: detectDeadAssetsHandler },
  { definition: correlateMetadataDefinition, handler: correlateMetadataHandler },
  { definition: autoTagDatasetDefinition, handler: autoTagDatasetHandler },
  { definition: getTableSchemaForSqlDefinition, handler: getTableSchemaForSqlHandler },

  // Business rules & tribal knowledge
  { definition: defineBusinessRuleDefinition, handler: defineBusinessRuleHandler },
  { definition: queryRulesDefinition, handler: queryRulesHandler },
  { definition: importTribalKnowledgeDefinition, handler: importTribalKnowledgeHandler },
  { definition: updateBusinessRuleDefinition, handler: updateBusinessRuleHandler },

  // Authority designation
  { definition: markAuthoritativeDefinition, handler: markAuthoritativeHandler },
  { definition: getAuthoritativeSourceDefinition, handler: getAuthoritativeSourceHandler },
  { definition: revokeAuthorityDefinition, handler: revokeAuthorityHandler },

  // Query history & golden path
  { definition: analyzeQueryHistoryDefinition, handler: analyzeQueryHistoryHandler },
  { definition: identifyGoldenPathDefinition, handler: identifyGoldenPathHandler },

  // Correction, staleness & feedback
  { definition: correctResponseDefinition, handler: correctResponseHandler },
  { definition: checkStalenessDefinition, handler: checkStalenessHandler },
  { definition: flagStaleContextDefinition, handler: flagStaleContextHandler },

  // Unstructured context
  { definition: ingestUnstructuredContextDefinition, handler: ingestUnstructuredContextHandler },

  // Enterprise steward
  { definition: runDataStewardDefinition, handler: runDataStewardHandler },
];
