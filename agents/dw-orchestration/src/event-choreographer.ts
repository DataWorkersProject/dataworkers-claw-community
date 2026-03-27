/**
 * EventChoreographer — Cross-agent event routing and choreography.
 *
 * Manages subscriptions and routes events between agents. Events carry
 * a traceId for distributed tracing. Uses InMemoryMessageBus for delivery.
 *
 * Event choreography implementation.
 */

import { InMemoryMessageBus } from '@data-workers/infrastructure-stubs';
import type { MessageBusEvent } from '@data-workers/infrastructure-stubs';
import type { EventRoute } from './types.js';

export class EventChoreographer {
  private messageBus: InMemoryMessageBus;
  private subscriptions: Map<string, Set<string>> = new Map();
  private routeHistory: EventRoute[] = [];

  constructor(messageBus: InMemoryMessageBus) {
    this.messageBus = messageBus;
  }

  /**
   * Subscribe an agent to a specific event type.
   * When events of this type are routed, the agent will receive them.
   */
  subscribe(eventType: string, agentName: string): void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType)!.add(agentName);
  }

  /**
   * Route an event to all subscribed agents.
   * Creates an EventRoute record with traceId for observability.
   * Returns the route record.
   */
  async route(event: MessageBusEvent): Promise<EventRoute> {
    const subscribers = this.subscriptions.get(event.type);
    const targetAgents = subscribers ? Array.from(subscribers) : [];
    const traceId = event.payload.traceId as string ?? `trace-${event.id}`;

    const routeRecord: EventRoute = {
      sourceEvent: event.type,
      targetAgents,
      traceId,
    };

    this.routeHistory.push(routeRecord);

    // Publish to each target agent's topic
    for (const agent of targetAgents) {
      await this.messageBus.publish(`agent:${agent}`, {
        ...event,
        payload: { ...event.payload, traceId, routedTo: agent },
      });
    }

    return routeRecord;
  }

  /**
   * Get all route subscriptions.
   * Returns a map of event type to subscribed agent names.
   */
  getRoutes(): Map<string, string[]> {
    const routes = new Map<string, string[]>();
    for (const [eventType, agents] of this.subscriptions) {
      routes.set(eventType, Array.from(agents));
    }
    return routes;
  }

  /**
   * Get the route history (all routed events).
   */
  getRouteHistory(): EventRoute[] {
    return [...this.routeHistory];
  }
}
