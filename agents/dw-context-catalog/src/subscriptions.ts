import { messageBus, kvStore } from './backends.js';

interface BusEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  customerId: string;
}

/**
 * Cross-agent event subscriptions for dw-context-catalog.
 * Registers stream topologies as catalog entities.
 */

// Subscribe to stream_configured events
messageBus.subscribe('stream_configured', (event: BusEvent) => {
  const payload = event.payload as Record<string, unknown>;
  // Register topology as catalog entity
  // TODO: Wire to catalog entity model when available
  kvStore.set(`catalog:topology:${payload.topologyId}`, JSON.stringify({
    type: 'stream_topology',
    topologyId: payload.topologyId,
    topic: payload.topic,
    sourceConnector: payload.sourceConnector,
    sinkConnector: payload.sinkConnector,
    registeredAt: event.timestamp,
  })).catch(() => {});
});

export const SUBSCRIPTIONS_INITIALIZED = true;
