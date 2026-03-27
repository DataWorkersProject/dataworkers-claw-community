/**
 * get_connector_status — Get live status of a Kafka Connect connector.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';

export const getConnectorStatusDefinition: ToolDefinition = {
  name: 'get_connector_status',
  description: 'Get live status of a Kafka Connect connector including task states and worker assignment.',
  inputSchema: {
    type: 'object',
    properties: {
      connectorName: { type: 'string', description: 'Connector name to check.' },
      connectUrl: { type: 'string', description: 'Kafka Connect REST URL. Defaults to KAFKA_CONNECT_URL env var.' },
    },
    required: ['connectorName'],
  },
};

export const getConnectorStatusHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('get_connector_status')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing', tool: 'get_connector_status' }) }],
      isError: true,
    };
  }

  // Support parameter aliases: connectorName, connector, name
  const connectorName = (args.connectorName ?? args.connector ?? args.name) as string | undefined;
  const connectUrl = (args.connectUrl as string) ?? process.env.KAFKA_CONNECT_URL;

  if (!connectorName) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: 'Missing required parameter: connectorName',
      }, null, 2) }],
      isError: true,
    };
  }

  if (!connectUrl) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        connectorName, status: 'UNKNOWN', error: 'No KAFKA_CONNECT_URL configured. Set env var or pass connectUrl parameter.',
        stubFallback: true,
      }, null, 2) }],
    };
  }

  try {
    const res = await fetch(`${connectUrl}/connectors/${connectorName}/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (e) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        connectorName, status: 'ERROR', error: e instanceof Error ? e.message : String(e),
      }, null, 2) }],
    };
  }
};
