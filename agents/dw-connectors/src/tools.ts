/**
 * dw-connectors — Exported tool definitions and handlers.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';

import {
  listSnowflakeDatabasesDefinition, listSnowflakeDatabasesHandler,
  listSnowflakeTablesDefinition, listSnowflakeTablesHandler,
  getSnowflakeTableDdlDefinition, getSnowflakeTableDdlHandler,
  getSnowflakeUsageDefinition, getSnowflakeUsageHandler,
} from './tools/snowflake-tools.js';

import {
  listBigqueryDatasetsDefinition, listBigqueryDatasetsHandler,
  listBigqueryTablesDefinition, listBigqueryTablesHandler,
  getBigqueryTableSchemaDefinition, getBigqueryTableSchemaHandler,
  estimateBigqueryCostDefinition, estimateBigqueryCostHandler,
} from './tools/bigquery-tools.js';

import {
  listDbtModelsDefinition, listDbtModelsHandler,
  getDbtModelLineageDefinition, getDbtModelLineageHandler,
  getDbtTestResultsDefinition, getDbtTestResultsHandler,
  getDbtRunHistoryDefinition, getDbtRunHistoryHandler,
} from './tools/dbt-tools.js';

import {
  listDatabricksCatalogsDefinition, listDatabricksCatalogsHandler,
  listDatabricksTablesDefinition, listDatabricksTablesHandler,
  getDatabricksTableDefinition, getDatabricksTableHandler,
  getDatabricksQueryHistoryDefinition, getDatabricksQueryHistoryHandler,
} from './tools/databricks-tools.js';

import {
  listAllCatalogsDefinition, listAllCatalogsHandler,
  searchAcrossCatalogsDefinition, searchAcrossCatalogsHandler,
  getTableFromAnyCatalogDefinition, getTableFromAnyCatalogHandler,
} from './tools/catalog-tools.js';

import {
  listGlueDatabasesDefinition, listGlueDatabasesHandler,
  listGlueTablesDefinition, listGlueTablesHandler,
  getGlueTableDefinition, getGlueTableHandler,
  searchGlueTablesDefinition, searchGlueTablesHandler,
} from './tools/glue-tools.js';

import {
  listHiveDatabasesDefinition, listHiveDatabasesHandler,
  listHiveTablesDefinition, listHiveTablesHandler,
  getHiveTableSchemaDefinition, getHiveTableSchemaHandler,
  getHivePartitionsDefinition, getHivePartitionsHandler,
} from './tools/hive-tools.js';

import {
  listOmTablesDefinition, listOmTablesHandler,
  getOmTableDefinition, getOmTableHandler,
  searchOmTablesDefinition, searchOmTablesHandler,
  getOmLineageDefinition, getOmLineageHandler,
  getOmQualityTestsDefinition, getOmQualityTestsHandler,
} from './tools/openmetadata-tools.js';

import {
  listLineageDatasetsDefinition, listLineageDatasetsHandler,
  listLineageJobsDefinition, listLineageJobsHandler,
  getLineageGraphDefinition, getLineageGraphHandler,
  emitLineageEventDefinition, emitLineageEventHandler,
} from './tools/openlineage-tools.js';

import {
  searchDatahubDatasetsDefinition, searchDatahubDatasetsHandler,
  getDatahubDatasetDefinition, getDatahubDatasetHandler,
  getDatahubLineageDefinition, getDatahubLineageHandler,
  listDatahubDomainsDefinition, listDatahubDomainsHandler,
} from './tools/datahub-tools.js';

import {
  listLfPermissionsDefinition, listLfPermissionsHandler,
  listLfTagsDefinition, listLfTagsHandler,
  searchLfByTagsDefinition, searchLfByTagsHandler,
} from './tools/lakeformation-tools.js';

import {
  searchPurviewEntitiesDefinition, searchPurviewEntitiesHandler,
  getPurviewEntityDefinition, getPurviewEntityHandler,
  getPurviewLineageDefinition, getPurviewLineageHandler,
  listPurviewGlossaryDefinition, listPurviewGlossaryHandler,
} from './tools/purview-tools.js';

import {
  listDataplexLakesDefinition, listDataplexLakesHandler,
  listDataplexEntitiesDefinition, listDataplexEntitiesHandler,
  getDataplexEntityDefinition, getDataplexEntityHandler,
  searchDataplexEntriesDefinition, searchDataplexEntriesHandler,
} from './tools/dataplex-tools.js';

import {
  listNessieBranchesDefinition, listNessieBranchesHandler,
  listNessieTablesDefinition, listNessieTablesHandler,
  getNessieContentDefinition, getNessieContentHandler,
  createNessieBranchDefinition, createNessieBranchHandler,
  diffNessieRefsDefinition, diffNessieRefsHandler,
} from './tools/nessie-tools.js';

import {
  triggerAirflowDagDefinition, triggerAirflowDagHandler,
  triggerDagsterJobDefinition, triggerDagsterJobHandler,
  triggerPrefectFlowDefinition, triggerPrefectFlowHandler,
  triggerStepFunctionDefinition, triggerStepFunctionHandler,
  triggerAdfPipelineDefinition, triggerAdfPipelineHandler,
  triggerDbtCloudJobDefinition, triggerDbtCloudJobHandler,
  triggerComposerDagDefinition, triggerComposerDagHandler,
} from './tools/orchestration-tools.js';

import {
  sendPagerdutyAlertDefinition, sendPagerdutyAlertHandler,
  sendSlackAlertDefinition, sendSlackAlertHandler,
  sendTeamsAlertDefinition, sendTeamsAlertHandler,
  sendOpsgenieAlertDefinition, sendOpsgenieAlertHandler,
  sendNewrelicAlertDefinition, sendNewrelicAlertHandler,
} from './tools/alerting-tools.js';

import {
  registerKafkaSchemaDefinition, registerKafkaSchemaHandler,
} from './tools/schema-registry-tools.js';

import {
  runGxSuiteDefinition, runGxSuiteHandler,
  runSodaSuiteDefinition, runSodaSuiteHandler,
  runMonteCarloSuiteDefinition, runMonteCarloSuiteHandler,
} from './tools/quality-suite-tools.js';

import {
  createServicenowTicketDefinition, createServicenowTicketHandler,
  updateServicenowTicketDefinition, updateServicenowTicketHandler,
  createJiraSmTicketDefinition, createJiraSmTicketHandler,
  updateJiraSmTicketDefinition, updateJiraSmTicketHandler,
} from './tools/itsm-tools.js';

import {
  resolvePagerdutyAlertDefinition, resolvePagerdutyAlertHandler,
  resolveOpsgenieAlertDefinition, resolveOpsgenieAlertHandler,
  resolveNewrelicAlertDefinition, resolveNewrelicAlertHandler,
  resolveSlackAlertDefinition, resolveSlackAlertHandler,
  resolveTeamsAlertDefinition, resolveTeamsAlertHandler,
} from './tools/alert-resolution-tools.js';

import {
  getConnectorStatusDefinition, getConnectorStatusHandler,
} from './tools/get-connector-status.js';

import {
  registerStreamSchemaDefinition, registerStreamSchemaHandler,
} from './tools/register-stream-schema.js';

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const connectorsTools: ToolEntry[] = [
  // Snowflake
  { definition: listSnowflakeDatabasesDefinition, handler: listSnowflakeDatabasesHandler },
  { definition: listSnowflakeTablesDefinition, handler: listSnowflakeTablesHandler },
  { definition: getSnowflakeTableDdlDefinition, handler: getSnowflakeTableDdlHandler },
  { definition: getSnowflakeUsageDefinition, handler: getSnowflakeUsageHandler },

  // BigQuery
  { definition: listBigqueryDatasetsDefinition, handler: listBigqueryDatasetsHandler },
  { definition: listBigqueryTablesDefinition, handler: listBigqueryTablesHandler },
  { definition: getBigqueryTableSchemaDefinition, handler: getBigqueryTableSchemaHandler },
  { definition: estimateBigqueryCostDefinition, handler: estimateBigqueryCostHandler },

  // dbt
  { definition: listDbtModelsDefinition, handler: listDbtModelsHandler },
  { definition: getDbtModelLineageDefinition, handler: getDbtModelLineageHandler },
  { definition: getDbtTestResultsDefinition, handler: getDbtTestResultsHandler },
  { definition: getDbtRunHistoryDefinition, handler: getDbtRunHistoryHandler },

  // Databricks
  { definition: listDatabricksCatalogsDefinition, handler: listDatabricksCatalogsHandler },
  { definition: listDatabricksTablesDefinition, handler: listDatabricksTablesHandler },
  { definition: getDatabricksTableDefinition, handler: getDatabricksTableHandler },
  { definition: getDatabricksQueryHistoryDefinition, handler: getDatabricksQueryHistoryHandler },

  // Catalog (cross-catalog)
  { definition: listAllCatalogsDefinition, handler: listAllCatalogsHandler },
  { definition: searchAcrossCatalogsDefinition, handler: searchAcrossCatalogsHandler },
  { definition: getTableFromAnyCatalogDefinition, handler: getTableFromAnyCatalogHandler },

  // AWS Glue
  { definition: listGlueDatabasesDefinition, handler: listGlueDatabasesHandler },
  { definition: listGlueTablesDefinition, handler: listGlueTablesHandler },
  { definition: getGlueTableDefinition, handler: getGlueTableHandler },
  { definition: searchGlueTablesDefinition, handler: searchGlueTablesHandler },

  // Hive Metastore
  { definition: listHiveDatabasesDefinition, handler: listHiveDatabasesHandler },
  { definition: listHiveTablesDefinition, handler: listHiveTablesHandler },
  { definition: getHiveTableSchemaDefinition, handler: getHiveTableSchemaHandler },
  { definition: getHivePartitionsDefinition, handler: getHivePartitionsHandler },

  // OpenMetadata
  { definition: listOmTablesDefinition, handler: listOmTablesHandler },
  { definition: getOmTableDefinition, handler: getOmTableHandler },
  { definition: searchOmTablesDefinition, handler: searchOmTablesHandler },
  { definition: getOmLineageDefinition, handler: getOmLineageHandler },
  { definition: getOmQualityTestsDefinition, handler: getOmQualityTestsHandler },

  // OpenLineage
  { definition: listLineageDatasetsDefinition, handler: listLineageDatasetsHandler },
  { definition: listLineageJobsDefinition, handler: listLineageJobsHandler },
  { definition: getLineageGraphDefinition, handler: getLineageGraphHandler },
  { definition: emitLineageEventDefinition, handler: emitLineageEventHandler },

  // DataHub
  { definition: searchDatahubDatasetsDefinition, handler: searchDatahubDatasetsHandler },
  { definition: getDatahubDatasetDefinition, handler: getDatahubDatasetHandler },
  { definition: getDatahubLineageDefinition, handler: getDatahubLineageHandler },
  { definition: listDatahubDomainsDefinition, handler: listDatahubDomainsHandler },

  // Lake Formation
  { definition: listLfPermissionsDefinition, handler: listLfPermissionsHandler },
  { definition: listLfTagsDefinition, handler: listLfTagsHandler },
  { definition: searchLfByTagsDefinition, handler: searchLfByTagsHandler },

  // Azure Purview
  { definition: searchPurviewEntitiesDefinition, handler: searchPurviewEntitiesHandler },
  { definition: getPurviewEntityDefinition, handler: getPurviewEntityHandler },
  { definition: getPurviewLineageDefinition, handler: getPurviewLineageHandler },
  { definition: listPurviewGlossaryDefinition, handler: listPurviewGlossaryHandler },

  // Google Dataplex
  { definition: listDataplexLakesDefinition, handler: listDataplexLakesHandler },
  { definition: listDataplexEntitiesDefinition, handler: listDataplexEntitiesHandler },
  { definition: getDataplexEntityDefinition, handler: getDataplexEntityHandler },
  { definition: searchDataplexEntriesDefinition, handler: searchDataplexEntriesHandler },

  // Apache Nessie
  { definition: listNessieBranchesDefinition, handler: listNessieBranchesHandler },
  { definition: listNessieTablesDefinition, handler: listNessieTablesHandler },
  { definition: getNessieContentDefinition, handler: getNessieContentHandler },
  { definition: createNessieBranchDefinition, handler: createNessieBranchHandler },
  { definition: diffNessieRefsDefinition, handler: diffNessieRefsHandler },

  // Orchestration triggers (Pro tier)
  { definition: triggerAirflowDagDefinition, handler: triggerAirflowDagHandler },
  { definition: triggerDagsterJobDefinition, handler: triggerDagsterJobHandler },
  { definition: triggerPrefectFlowDefinition, handler: triggerPrefectFlowHandler },
  { definition: triggerStepFunctionDefinition, handler: triggerStepFunctionHandler },
  { definition: triggerAdfPipelineDefinition, handler: triggerAdfPipelineHandler },
  { definition: triggerDbtCloudJobDefinition, handler: triggerDbtCloudJobHandler },
  { definition: triggerComposerDagDefinition, handler: triggerComposerDagHandler },

  // Alerting (Pro tier)
  { definition: sendPagerdutyAlertDefinition, handler: sendPagerdutyAlertHandler },
  { definition: sendSlackAlertDefinition, handler: sendSlackAlertHandler },
  { definition: sendTeamsAlertDefinition, handler: sendTeamsAlertHandler },
  { definition: sendOpsgenieAlertDefinition, handler: sendOpsgenieAlertHandler },
  { definition: sendNewrelicAlertDefinition, handler: sendNewrelicAlertHandler },

  // Schema registry (Pro tier)
  { definition: registerKafkaSchemaDefinition, handler: registerKafkaSchemaHandler },

  // Quality suites (Pro tier)
  { definition: runGxSuiteDefinition, handler: runGxSuiteHandler },
  { definition: runSodaSuiteDefinition, handler: runSodaSuiteHandler },
  { definition: runMonteCarloSuiteDefinition, handler: runMonteCarloSuiteHandler },

  // ITSM (Pro tier)
  { definition: createServicenowTicketDefinition, handler: createServicenowTicketHandler },
  { definition: updateServicenowTicketDefinition, handler: updateServicenowTicketHandler },
  { definition: createJiraSmTicketDefinition, handler: createJiraSmTicketHandler },
  { definition: updateJiraSmTicketDefinition, handler: updateJiraSmTicketHandler },

  // Alert resolution (Enterprise tier)
  { definition: resolvePagerdutyAlertDefinition, handler: resolvePagerdutyAlertHandler },
  { definition: resolveOpsgenieAlertDefinition, handler: resolveOpsgenieAlertHandler },
  { definition: resolveNewrelicAlertDefinition, handler: resolveNewrelicAlertHandler },
  { definition: resolveSlackAlertDefinition, handler: resolveSlackAlertHandler },
  { definition: resolveTeamsAlertDefinition, handler: resolveTeamsAlertHandler },

  // Kafka Connect & Stream Schema (Pro tier)
  { definition: getConnectorStatusDefinition, handler: getConnectorStatusHandler },
  { definition: registerStreamSchemaDefinition, handler: registerStreamSchemaHandler },
];
