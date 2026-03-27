/**
 * OpenLineage/Marquez MCP tools — list datasets, list jobs, get lineage graph, emit lineage event.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { openlineage } from '../backends.js';

// ── list_lineage_datasets ────────────────────────────────────────────

export const listLineageDatasetsDefinition: ToolDefinition = {
  name: 'list_lineage_datasets',
  description: 'List datasets tracked in Marquez/OpenLineage for a namespace.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      namespace: { type: 'string', description: 'Marquez namespace.' },
    },
    required: ['customerId', 'namespace'],
  },
};

export const listLineageDatasetsHandler: ToolHandler = async (args) => {
  const namespace = args.namespace as string;
  try {
    const datasets = openlineage.listDatasets(namespace);
    return { content: [{ type: 'text', text: JSON.stringify(datasets, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── list_lineage_jobs ────────────────────────────────────────────────

export const listLineageJobsDefinition: ToolDefinition = {
  name: 'list_lineage_jobs',
  description: 'List data pipeline jobs tracked in Marquez/OpenLineage.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      namespace: { type: 'string', description: 'Marquez namespace.' },
    },
    required: ['customerId', 'namespace'],
  },
};

export const listLineageJobsHandler: ToolHandler = async (args) => {
  const namespace = args.namespace as string;
  try {
    const jobs = openlineage.listJobs(namespace);
    return { content: [{ type: 'text', text: JSON.stringify(jobs, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_lineage_graph ────────────────────────────────────────────────

export const getLineageGraphDefinition: ToolDefinition = {
  name: 'get_lineage_graph',
  description: 'Get the full lineage graph for a dataset or job in Marquez.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      nodeId: { type: 'string', description: 'Node ID (e.g., "dataset:namespace.name").' },
      depth: { type: 'number', description: 'Lineage depth (default: 5).' },
    },
    required: ['customerId', 'nodeId'],
  },
};

export const getLineageGraphHandler: ToolHandler = async (args) => {
  const nodeId = args.nodeId as string;
  const depth = args.depth as number | undefined;
  try {
    const graph = openlineage.getMarquezLineage(nodeId, depth);
    return { content: [{ type: 'text', text: JSON.stringify(graph, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── emit_lineage_event ───────────────────────────────────────────────

export const emitLineageEventDefinition: ToolDefinition = {
  name: 'emit_lineage_event',
  description: 'Emit an OpenLineage run event to track data pipeline execution.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      eventType: { type: 'string', description: 'Event type: START, RUNNING, COMPLETE, FAIL, ABORT.', enum: ['START', 'RUNNING', 'COMPLETE', 'FAIL', 'ABORT'] },
      jobNamespace: { type: 'string', description: 'Job namespace.' },
      jobName: { type: 'string', description: 'Job name.' },
      runId: { type: 'string', description: 'Run identifier.' },
    },
    required: ['customerId', 'eventType', 'jobNamespace', 'jobName', 'runId'],
  },
};

export const emitLineageEventHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('emit_lineage_event')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'emit_lineage_event' }) }],
      isError: true,
    };
  }

  const eventType = args.eventType as 'START' | 'RUNNING' | 'COMPLETE' | 'FAIL' | 'ABORT';
  const jobNamespace = args.jobNamespace as string;
  const jobName = args.jobName as string;
  const runId = args.runId as string;
  try {
    openlineage.emitRunEvent({
      eventType,
      eventTime: new Date().toISOString(),
      run: { runId },
      job: { namespace: jobNamespace, name: jobName },
      inputs: [],
      outputs: [],
      producer: 'data-workers',
    });
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, eventType, jobName, runId }) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
