/**
 * register_pipeline_asset MCP tool — registers a pipeline as a catalog asset.
 * Called by the pipeline agent after a pipeline is generated/deployed,
 * enabling cross-agent discovery and lineage tracking.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { graphDB } from '../backends.js';

export const registerPipelineAssetDefinition: ToolDefinition = {
  name: 'register_pipeline_asset',
  description: 'Register a pipeline as a catalog asset. Creates a graph node for the pipeline and edges to its source and target tables, enabling lineage tracking and cross-agent discovery.',
  inputSchema: {
    type: 'object',
    properties: {
      pipelineId: { type: 'string', description: 'Unique pipeline identifier.' },
      name: { type: 'string', description: 'Human-readable pipeline name.' },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            table: { type: 'string' },
          },
        },
        description: 'Source tables consumed by the pipeline.',
      },
      targets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            table: { type: 'string' },
          },
        },
        description: 'Target tables produced by the pipeline.',
      },
      owner: { type: 'string', description: 'Pipeline owner (user or service account).' },
      schedule: { type: 'string', description: 'Cron schedule expression.' },
      customerId: { type: 'string' },
    },
    required: ['pipelineId', 'name', 'customerId'],
  },
};

export const registerPipelineAssetHandler: ToolHandler = async (args) => {
  const pipelineId = args.pipelineId as string;
  const name = args.name as string;
  const customerId = args.customerId as string;
  const sources = (args.sources as Array<{ platform: string; table: string }>) ?? [];
  const targets = (args.targets as Array<{ platform: string; table: string }>) ?? [];
  const owner = (args.owner as string) ?? 'unknown';
  const schedule = args.schedule as string | undefined;

  try {
    // Create the pipeline node in the graph
    await graphDB.addNode({
      id: pipelineId,
      name,
      type: 'pipeline',
      platform: 'data-workers',
      customerId,
      properties: {
        owner,
        schedule,
        sources: sources.map(s => `${s.platform}.${s.table}`),
        targets: targets.map(t => `${t.platform}.${t.table}`),
        registeredAt: Date.now(),
      },
    });

    // Create edges from source tables to the pipeline
    for (const source of sources) {
      const sourceId = `${source.platform}.${source.table}`;
      // Ensure source node exists (create stub if needed)
      const existingSource = await graphDB.getNode(sourceId);
      if (!existingSource) {
        await graphDB.addNode({
          id: sourceId,
          name: source.table,
          type: 'table',
          platform: source.platform,
          customerId,
          properties: { autoRegistered: true },
        });
      }
      await graphDB.addEdge({
        source: sourceId,
        target: pipelineId,
        relationship: 'feeds_into',
        properties: { registeredAt: Date.now() },
      });
    }

    // Create edges from the pipeline to target tables
    for (const target of targets) {
      const targetId = `${target.platform}.${target.table}`;
      const existingTarget = await graphDB.getNode(targetId);
      if (!existingTarget) {
        await graphDB.addNode({
          id: targetId,
          name: target.table,
          type: 'table',
          platform: target.platform,
          customerId,
          properties: { autoRegistered: true },
        });
      }
      await graphDB.addEdge({
        source: pipelineId,
        target: targetId,
        relationship: 'produces',
        properties: { registeredAt: Date.now() },
      });
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          registered: true,
          pipelineId,
          name,
          sourcesLinked: sources.length,
          targetsLinked: targets.length,
          registeredAt: Date.now(),
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Failed to register pipeline asset: ${err instanceof Error ? err.message : String(err)}`,
          pipelineId,
        }, null, 2),
      }],
      isError: true,
    };
  }
};
