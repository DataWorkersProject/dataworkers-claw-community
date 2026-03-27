/**
 * dw-connectors — Data Platform Connectors Agent
 *
 * MCP server exposing 83 tools for unified access to:
 * - Snowflake (4 tools): list databases, list tables, get DDL, get usage
 * - BigQuery (4 tools): list datasets, list tables, get schema, estimate cost
 * - dbt (4 tools): list models, get lineage, get test results, get run history
 * - Databricks (4 tools): list catalogs, list tables, get table, get query history
 * - AWS Glue (4 tools): list databases, list tables, get table, search tables
 * - Hive Metastore (4 tools): list databases, list tables, get table schema, get partitions
 * - OpenMetadata (5 tools): list tables, get table, search tables, get lineage, get quality tests
 * - OpenLineage (4 tools): list datasets, list jobs, get lineage graph, emit lineage event
 * - Catalog (3 tools): list all catalogs, search across catalogs, get table from any catalog
 * - DataHub (4 tools): search datasets, get dataset, get lineage, list domains
 * - Lake Formation (3 tools): list permissions, list tags, search by tags
 * - Azure Purview (4 tools): search entities, get entity, get lineage, list glossary
 * - Google Dataplex (4 tools): list lakes, list entities, get entity, search entries
 * - Apache Nessie (5 tools): list branches, list tables, get content, create branch, diff refs
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';

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


const server = new DataWorkersMCPServer({
  name: 'dw-connectors',
  version: '0.2.0',
  description: 'Data Platform Connectors — unified access to Snowflake, BigQuery, dbt, Databricks, Glue, Hive, OpenMetadata, OpenLineage, DataHub, Lake Formation, Purview, Dataplex, Nessie',
});

// Snowflake tools
server.registerTool(listSnowflakeDatabasesDefinition, listSnowflakeDatabasesHandler);
server.registerTool(listSnowflakeTablesDefinition, listSnowflakeTablesHandler);
server.registerTool(getSnowflakeTableDdlDefinition, getSnowflakeTableDdlHandler);
server.registerTool(getSnowflakeUsageDefinition, getSnowflakeUsageHandler);

// BigQuery tools
server.registerTool(listBigqueryDatasetsDefinition, listBigqueryDatasetsHandler);
server.registerTool(listBigqueryTablesDefinition, listBigqueryTablesHandler);
server.registerTool(getBigqueryTableSchemaDefinition, getBigqueryTableSchemaHandler);
server.registerTool(estimateBigqueryCostDefinition, estimateBigqueryCostHandler);

// dbt tools
server.registerTool(listDbtModelsDefinition, listDbtModelsHandler);
server.registerTool(getDbtModelLineageDefinition, getDbtModelLineageHandler);
server.registerTool(getDbtTestResultsDefinition, getDbtTestResultsHandler);
server.registerTool(getDbtRunHistoryDefinition, getDbtRunHistoryHandler);

// Databricks tools
server.registerTool(listDatabricksCatalogsDefinition, listDatabricksCatalogsHandler);
server.registerTool(listDatabricksTablesDefinition, listDatabricksTablesHandler);
server.registerTool(getDatabricksTableDefinition, getDatabricksTableHandler);
server.registerTool(getDatabricksQueryHistoryDefinition, getDatabricksQueryHistoryHandler);

// Catalog tools
server.registerTool(listAllCatalogsDefinition, listAllCatalogsHandler);
server.registerTool(searchAcrossCatalogsDefinition, searchAcrossCatalogsHandler);
server.registerTool(getTableFromAnyCatalogDefinition, getTableFromAnyCatalogHandler);

// AWS Glue tools
server.registerTool(listGlueDatabasesDefinition, listGlueDatabasesHandler);
server.registerTool(listGlueTablesDefinition, listGlueTablesHandler);
server.registerTool(getGlueTableDefinition, getGlueTableHandler);
server.registerTool(searchGlueTablesDefinition, searchGlueTablesHandler);

// Hive Metastore tools
server.registerTool(listHiveDatabasesDefinition, listHiveDatabasesHandler);
server.registerTool(listHiveTablesDefinition, listHiveTablesHandler);
server.registerTool(getHiveTableSchemaDefinition, getHiveTableSchemaHandler);
server.registerTool(getHivePartitionsDefinition, getHivePartitionsHandler);

// OpenMetadata tools
server.registerTool(listOmTablesDefinition, listOmTablesHandler);
server.registerTool(getOmTableDefinition, getOmTableHandler);
server.registerTool(searchOmTablesDefinition, searchOmTablesHandler);
server.registerTool(getOmLineageDefinition, getOmLineageHandler);
server.registerTool(getOmQualityTestsDefinition, getOmQualityTestsHandler);

// OpenLineage/Marquez tools
server.registerTool(listLineageDatasetsDefinition, listLineageDatasetsHandler);
server.registerTool(listLineageJobsDefinition, listLineageJobsHandler);
server.registerTool(getLineageGraphDefinition, getLineageGraphHandler);
server.registerTool(emitLineageEventDefinition, emitLineageEventHandler);

// DataHub tools
server.registerTool(searchDatahubDatasetsDefinition, searchDatahubDatasetsHandler);
server.registerTool(getDatahubDatasetDefinition, getDatahubDatasetHandler);
server.registerTool(getDatahubLineageDefinition, getDatahubLineageHandler);
server.registerTool(listDatahubDomainsDefinition, listDatahubDomainsHandler);

// Lake Formation tools
server.registerTool(listLfPermissionsDefinition, listLfPermissionsHandler);
server.registerTool(listLfTagsDefinition, listLfTagsHandler);
server.registerTool(searchLfByTagsDefinition, searchLfByTagsHandler);

// Azure Purview tools
server.registerTool(searchPurviewEntitiesDefinition, searchPurviewEntitiesHandler);
server.registerTool(getPurviewEntityDefinition, getPurviewEntityHandler);
server.registerTool(getPurviewLineageDefinition, getPurviewLineageHandler);
server.registerTool(listPurviewGlossaryDefinition, listPurviewGlossaryHandler);

// Google Dataplex tools
server.registerTool(listDataplexLakesDefinition, listDataplexLakesHandler);
server.registerTool(listDataplexEntitiesDefinition, listDataplexEntitiesHandler);
server.registerTool(getDataplexEntityDefinition, getDataplexEntityHandler);
server.registerTool(searchDataplexEntriesDefinition, searchDataplexEntriesHandler);

// Apache Nessie tools
server.registerTool(listNessieBranchesDefinition, listNessieBranchesHandler);
server.registerTool(listNessieTablesDefinition, listNessieTablesHandler);
server.registerTool(getNessieContentDefinition, getNessieContentHandler);
server.registerTool(createNessieBranchDefinition, createNessieBranchHandler);
server.registerTool(diffNessieRefsDefinition, diffNessieRefsHandler);


// Orchestration trigger tools (Pro tier)
server.registerTool(triggerAirflowDagDefinition, triggerAirflowDagHandler);
server.registerTool(triggerDagsterJobDefinition, triggerDagsterJobHandler);
server.registerTool(triggerPrefectFlowDefinition, triggerPrefectFlowHandler);
server.registerTool(triggerStepFunctionDefinition, triggerStepFunctionHandler);
server.registerTool(triggerAdfPipelineDefinition, triggerAdfPipelineHandler);
server.registerTool(triggerDbtCloudJobDefinition, triggerDbtCloudJobHandler);
server.registerTool(triggerComposerDagDefinition, triggerComposerDagHandler);

// Alerting tools (Pro tier)
server.registerTool(sendPagerdutyAlertDefinition, sendPagerdutyAlertHandler);
server.registerTool(sendSlackAlertDefinition, sendSlackAlertHandler);
server.registerTool(sendTeamsAlertDefinition, sendTeamsAlertHandler);
server.registerTool(sendOpsgenieAlertDefinition, sendOpsgenieAlertHandler);
server.registerTool(sendNewrelicAlertDefinition, sendNewrelicAlertHandler);

// Schema registry tools (Pro tier)
server.registerTool(registerKafkaSchemaDefinition, registerKafkaSchemaHandler);

// Quality suite tools (Pro tier)
server.registerTool(runGxSuiteDefinition, runGxSuiteHandler);
server.registerTool(runSodaSuiteDefinition, runSodaSuiteHandler);
server.registerTool(runMonteCarloSuiteDefinition, runMonteCarloSuiteHandler);

// ITSM tools (Pro tier)
server.registerTool(createServicenowTicketDefinition, createServicenowTicketHandler);
server.registerTool(updateServicenowTicketDefinition, updateServicenowTicketHandler);
server.registerTool(createJiraSmTicketDefinition, createJiraSmTicketHandler);
server.registerTool(updateJiraSmTicketDefinition, updateJiraSmTicketHandler);

// Alert resolution tools (Enterprise tier)
server.registerTool(resolvePagerdutyAlertDefinition, resolvePagerdutyAlertHandler);
server.registerTool(resolveOpsgenieAlertDefinition, resolveOpsgenieAlertHandler);
server.registerTool(resolveNewrelicAlertDefinition, resolveNewrelicAlertHandler);
server.registerTool(resolveSlackAlertDefinition, resolveSlackAlertHandler);
server.registerTool(resolveTeamsAlertDefinition, resolveTeamsAlertHandler);

// Kafka Connect & Stream Schema tools (Pro tier)
server.registerTool(getConnectorStatusDefinition, getConnectorStatusHandler);
server.registerTool(registerStreamSchemaDefinition, registerStreamSchemaHandler);

server.captureCapabilities();

export { server };
export default server;

// Stdio transport for standalone MCP server mode (OpenCode, etc.)
import { startStdioTransport } from '@data-workers/mcp-framework';

if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
