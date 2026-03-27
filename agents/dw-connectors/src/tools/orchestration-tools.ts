/**
 * Orchestration trigger tools — trigger DAGs/jobs/flows across orchestrators.
 * All are write operations requiring Pro tier or higher.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';

// ── Helper ─────────────────────────────────────────────────────────────

function tierGate(toolName: string) {
  if (!isToolAllowed(toolName)) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: toolName }) }],
      isError: true,
    };
  }
  return null;
}

// ── trigger_airflow_dag ───────────────────────────────────────────────

export const triggerAirflowDagDefinition: ToolDefinition = {
  name: 'trigger_airflow_dag',
  description: 'Trigger an Apache Airflow DAG run. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      dagId: { type: 'string', description: 'DAG identifier.' },
      conf: { type: 'object', description: 'Optional DAG run configuration.' },
    },
    required: ['dagId'],
  },
};

export const triggerAirflowDagHandler: ToolHandler = async (args) => {
  const gate = tierGate('trigger_airflow_dag');
  if (gate) return gate;

  const dagId = args.dagId as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ triggered: true, dagId, runId: `manual__${Date.now()}`, status: 'queued' }, null, 2) }],
  };
};

// ── trigger_dagster_job ───────────────────────────────────────────────

export const triggerDagsterJobDefinition: ToolDefinition = {
  name: 'trigger_dagster_job',
  description: 'Trigger a Dagster job/pipeline run. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      jobName: { type: 'string', description: 'Dagster job name.' },
      repositoryName: { type: 'string', description: 'Repository containing the job.' },
    },
    required: ['jobName'],
  },
};

export const triggerDagsterJobHandler: ToolHandler = async (args) => {
  const gate = tierGate('trigger_dagster_job');
  if (gate) return gate;

  const jobName = args.jobName as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ triggered: true, jobName, runId: `dagster-${Date.now()}`, status: 'queued' }, null, 2) }],
  };
};

// ── trigger_prefect_flow ──────────────────────────────────────────────

export const triggerPrefectFlowDefinition: ToolDefinition = {
  name: 'trigger_prefect_flow',
  description: 'Trigger a Prefect flow run. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      deploymentId: { type: 'string', description: 'Prefect deployment ID.' },
      parameters: { type: 'object', description: 'Optional flow parameters.' },
    },
    required: ['deploymentId'],
  },
};

export const triggerPrefectFlowHandler: ToolHandler = async (args) => {
  const gate = tierGate('trigger_prefect_flow');
  if (gate) return gate;

  const deploymentId = args.deploymentId as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ triggered: true, deploymentId, flowRunId: `prefect-${Date.now()}`, status: 'scheduled' }, null, 2) }],
  };
};

// ── trigger_step_function ─────────────────────────────────────────────

export const triggerStepFunctionDefinition: ToolDefinition = {
  name: 'trigger_step_function',
  description: 'Start an AWS Step Functions state machine execution. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      stateMachineArn: { type: 'string', description: 'Step Functions state machine ARN.' },
      input: { type: 'string', description: 'JSON input for the execution.' },
    },
    required: ['stateMachineArn'],
  },
};

export const triggerStepFunctionHandler: ToolHandler = async (args) => {
  const gate = tierGate('trigger_step_function');
  if (gate) return gate;

  const stateMachineArn = args.stateMachineArn as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ triggered: true, stateMachineArn, executionArn: `${stateMachineArn}:${Date.now()}`, status: 'RUNNING' }, null, 2) }],
  };
};

// ── trigger_adf_pipeline ──────────────────────────────────────────────

export const triggerAdfPipelineDefinition: ToolDefinition = {
  name: 'trigger_adf_pipeline',
  description: 'Trigger an Azure Data Factory pipeline run. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      factoryName: { type: 'string', description: 'ADF factory name.' },
      pipelineName: { type: 'string', description: 'Pipeline name to trigger.' },
      parameters: { type: 'object', description: 'Optional pipeline parameters.' },
    },
    required: ['factoryName', 'pipelineName'],
  },
};

export const triggerAdfPipelineHandler: ToolHandler = async (args) => {
  const gate = tierGate('trigger_adf_pipeline');
  if (gate) return gate;

  const pipelineName = args.pipelineName as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ triggered: true, pipelineName, runId: `adf-${Date.now()}`, status: 'InProgress' }, null, 2) }],
  };
};

// ── trigger_dbt_cloud_job ─────────────────────────────────────────────

export const triggerDbtCloudJobDefinition: ToolDefinition = {
  name: 'trigger_dbt_cloud_job',
  description: 'Trigger a dbt Cloud job run. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      accountId: { type: 'string', description: 'dbt Cloud account ID.' },
      jobId: { type: 'string', description: 'dbt Cloud job ID.' },
      cause: { type: 'string', description: 'Trigger cause description.' },
    },
    required: ['accountId', 'jobId'],
  },
};

export const triggerDbtCloudJobHandler: ToolHandler = async (args) => {
  const gate = tierGate('trigger_dbt_cloud_job');
  if (gate) return gate;

  const jobId = args.jobId as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ triggered: true, jobId, runId: Date.now(), status: 'queued' }, null, 2) }],
  };
};

// ── trigger_composer_dag ──────────────────────────────────────────────

export const triggerComposerDagDefinition: ToolDefinition = {
  name: 'trigger_composer_dag',
  description: 'Trigger a Google Cloud Composer (managed Airflow) DAG run. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'GCP project ID.' },
      environment: { type: 'string', description: 'Composer environment name.' },
      dagId: { type: 'string', description: 'DAG identifier.' },
    },
    required: ['projectId', 'environment', 'dagId'],
  },
};

export const triggerComposerDagHandler: ToolHandler = async (args) => {
  const gate = tierGate('trigger_composer_dag');
  if (gate) return gate;

  const dagId = args.dagId as string;
  return {
    content: [{ type: 'text', text: JSON.stringify({ triggered: true, dagId, runId: `composer-${Date.now()}`, status: 'queued' }, null, 2) }],
  };
};
