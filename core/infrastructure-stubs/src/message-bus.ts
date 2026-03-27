/**
 * In-memory message bus stub for development and testing.
 * Simulates Kafka-like pub/sub with topic-based event routing.
 */

export interface MessageBusEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  customerId: string;
}

type EventHandler = (event: MessageBusEvent) => void;

import type { IMessageBus } from './interfaces/index.js';

export class InMemoryMessageBus implements IMessageBus {
  private topics: Map<string, MessageBusEvent[]> = new Map();
  private subscribers: Map<string, EventHandler[]> = new Map();
  private requestHandlers = new Map<string, (payload: unknown) => Promise<unknown>>();
  private maxEventsPerTopic = 1000;

  /**
   * Publish an event to a topic.
   * Stores the event and notifies all subscribers.
   */
  async publish(topic: string, event: MessageBusEvent): Promise<void> {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, []);
    }
    const events = this.topics.get(topic)!;
    events.push(event);
    if (events.length > this.maxEventsPerTopic) events.shift();

    const handlers = this.subscribers.get(topic);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  /**
   * Subscribe to events on a topic.
   * The handler is called for each new event published to the topic.
   */
  async subscribe(topic: string, handler: EventHandler): Promise<void> {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }
    this.subscribers.get(topic)!.push(handler);
  }

  /**
   * Unsubscribe a handler from a topic.
   */
  unsubscribe(topic: string, handler: EventHandler): void {
    const handlers = this.subscribers.get(topic);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  /**
   * Get all events published to a topic.
   * Useful for testing and audit.
   */
  async getEvents(topic: string): Promise<MessageBusEvent[]> {
    return this.topics.get(topic) ?? [];
  }

  /**
   * Request/reply pattern.
   * If an onRequest handler is registered for the topic, invokes it directly.
   * Otherwise falls back to correlation-id based pub/sub on `${topic}_reply`.
   * Rejects with a timeout error if no reply arrives within timeoutMs.
   */
  async request(
    topic: string,
    payload: Record<string, unknown>,
    timeoutMs = 5000,
  ): Promise<Record<string, unknown>> {
    // Fast path: if an onRequest handler is registered, call it directly
    const directHandler = this.requestHandlers.get(topic);
    if (directHandler) {
      const result = await Promise.race([
        directHandler(payload),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Request to '${topic}' timed out after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      return result as Record<string, unknown>;
    }

    // Fallback: correlation-id based pub/sub
    const correlationId = `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const replyTopic = `${topic}_reply`;

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Request to '${topic}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Subscribe for the reply
      const replyHandler = (event: MessageBusEvent) => {
        if (event.payload.correlationId === correlationId && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve(event.payload);
        }
      };

      // Register reply handler
      if (!this.subscribers.has(replyTopic)) {
        this.subscribers.set(replyTopic, []);
      }
      this.subscribers.get(replyTopic)!.push(replyHandler);

      // Publish the request
      this.publish(topic, {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'request',
        payload: { ...payload, correlationId },
        timestamp: Date.now(),
        customerId: (payload.customerId as string) ?? 'system',
      }).catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  /**
   * Register a handler for request/reply on a topic.
   * When request() is called, if a matching onRequest handler exists,
   * it is invoked directly (bypassing correlation-id pub/sub).
   */
  onRequest(topic: string, handler: (payload: unknown) => Promise<unknown>): void {
    this.requestHandlers.set(topic, handler);
  }

  /**
   * Clear all topics and subscribers.
   */
  async clear(): Promise<void> {
    this.topics.clear();
    this.subscribers.clear();
    this.requestHandlers.clear();
  }

  /**
   * No-op seed for interface conformance.
   */
  seed(): void {
    // No seed data required for message bus
  }
}
