/**
 * dbt MCP tools — list models, get lineage, get test results, get run history.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { dbt } from '../backends.js';

// ── list_dbt_models ─────────────────────────────────────────────────

export const listDbtModelsDefinition: ToolDefinition = {
  name: 'list_dbt_models',
  description: 'List all dbt models with their materialization type.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
    },
    required: ['customerId'],
  },
};

export const listDbtModelsHandler: ToolHandler = async (_args) => {
  try {
    const models = await dbt.listModels();
    return { content: [{ type: 'text', text: JSON.stringify(models, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_dbt_model_lineage ───────────────────────────────────────────

export const getDbtModelLineageDefinition: ToolDefinition = {
  name: 'get_dbt_model_lineage',
  description: 'Get upstream and downstream lineage edges for a dbt model.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      modelId: { type: 'string', description: 'Unique model identifier (e.g. model.project.name). Aliases: model, modelName.' },
      model: { type: 'string', description: 'Alias for modelId.' },
      modelName: { type: 'string', description: 'Alias for modelId.' },
    },
    required: ['customerId', 'modelId'],
  },
};

export const getDbtModelLineageHandler: ToolHandler = async (args) => {
  const modelId = (args.modelId ?? args.modelName ?? args.model) as string;

  try {
    const lineage = await dbt.getModelLineage(modelId);
    return { content: [{ type: 'text', text: JSON.stringify(lineage, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_dbt_test_results ────────────────────────────────────────────

export const getDbtTestResultsDefinition: ToolDefinition = {
  name: 'get_dbt_test_results',
  description: 'Get dbt test pass/fail results, optionally filtered by run ID.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      runId: { type: 'string', description: 'Optional run ID to filter results.' },
    },
    required: ['customerId'],
  },
};

export const getDbtTestResultsHandler: ToolHandler = async (args) => {
  const runId = args.runId as string | undefined;

  try {
    const results = await dbt.getTestResults(runId);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};

// ── get_dbt_run_history ─────────────────────────────────────────────

export const getDbtRunHistoryDefinition: ToolDefinition = {
  name: 'get_dbt_run_history',
  description: 'Get recent dbt run history, optionally limited.',
  inputSchema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer identifier.' },
      limit: { type: 'number', description: 'Maximum number of runs to return.' },
    },
    required: ['customerId'],
  },
};

export const getDbtRunHistoryHandler: ToolHandler = async (args) => {
  const limit = args.limit as number | undefined;

  try {
    const history = await dbt.getRunHistory(limit);
    return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) }],
      isError: true,
    };
  }
};
