/**
 * dw-quality — Quality Monitoring Agent
 *
 * MCP server exposing 4 quality monitoring tools:
 * - run_quality_check: execute profiling on a dataset
 * - get_quality_score: retrieve real-time quality score (0-100)
 * - set_sla: define data SLAs in YAML format
 * - get_anomalies: list detected anomalies with classification
 *
 * See REQ-QUAL-001 through REQ-QUAL-006.
 */

import { DataWorkersMCPServer } from '@data-workers/mcp-framework';
import { withMiddleware } from '@data-workers/enterprise';
import { runQualityCheckDefinition, runQualityCheckHandler } from './tools/run-quality-check.js';
import { getQualityScoreDefinition, getQualityScoreHandler } from './tools/get-quality-score.js';
import { setSLADefinition, setSLAHandler } from './tools/set-sla.js';
import { getAnomaliesDefinition, getAnomaliesHandler } from './tools/get-anomalies.js';
import { createQualityTestsForPipelineDefinition, createQualityTestsForPipelineHandler } from './tools/create-quality-tests-for-pipeline.js';
import { getQualitySummaryDefinition, getQualitySummaryHandler } from './tools/get-quality-summary.js';

const AGENT_ID = 'dw-quality';

const server = new DataWorkersMCPServer({
  name: AGENT_ID,
  version: '0.1.0',
  description: 'Quality Monitoring Agent — profiling, scoring, SLAs, anomaly detection, auto-remediation',
});

server.registerTool(runQualityCheckDefinition, withMiddleware(AGENT_ID, 'run_quality_check', runQualityCheckHandler));
server.registerTool(getQualityScoreDefinition, withMiddleware(AGENT_ID, 'get_quality_score', getQualityScoreHandler));
server.registerTool(setSLADefinition, withMiddleware(AGENT_ID, 'set_sla', setSLAHandler));
server.registerTool(getAnomaliesDefinition, withMiddleware(AGENT_ID, 'get_anomalies', getAnomaliesHandler));
server.registerTool(createQualityTestsForPipelineDefinition, withMiddleware(AGENT_ID, 'create_quality_tests_for_pipeline', createQualityTestsForPipelineHandler));
server.registerTool(getQualitySummaryDefinition, withMiddleware(AGENT_ID, 'get_quality_summary', getQualitySummaryHandler));

server.captureCapabilities();

export { server };
export default server;

// Stdio transport for standalone MCP server mode (OpenCode, etc.)
import { startStdioTransport } from '@data-workers/mcp-framework';

if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
