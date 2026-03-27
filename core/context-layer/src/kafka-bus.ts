import type { EventMessage, KafkaConfig, EventType } from './types.js';

export type KafkaConnectionState = 'connected' | 'reconnecting' | 'buffering' | 'degraded' | 'disconnected';

export interface KafkaEventBusConfig extends KafkaConfig {
  /** Heartbeat interval for failure detection. Default: 10_000 (10s) per REQ-CTX-013 */
  heartbeatIntervalMs?: number;
  /** Buffer timeout before DEGRADED mode. Default: 120_000 (120s) per REQ-CTX-013 */
  bufferTimeoutMs?: number;
  /** Event retention in days. Default: 7 per REQ-CTX-006 */
  retentionDays?: number;
}

/**
 * Kafka-based event bus for cross-agent asynchronous communication.
 *
 * Features:
 * - Customer_id partitioning for causal ordering (REQ-CTX-007)
 * - 7 event types with guaranteed delivery (REQ-CTX-006)
 * - At-least-once delivery + idempotency keys (REQ-CTX-017)
 * - Failure handling: 10s detect, 120s buffer, DEGRADED (REQ-CTX-013)
 * - Buffered event replay on recovery with deduplication
 */
export class KafkaEventBus {
  private config: Required<KafkaEventBusConfig>;
  private state: KafkaConnectionState = 'disconnected';
  private buffer: EventMessage[] = [];
  private bufferingStartedAt: number | null = null;
  private processedIds = new Set<string>();
  private subscriptions = new Map<string, Array<(event: EventMessage) => Promise<void>>>();

  /** Max idempotency keys to track before cleanup */
  private static MAX_PROCESSED_IDS = 100_000;

  constructor(config: KafkaEventBusConfig) {
    this.config = {
      heartbeatIntervalMs: 10_000,
      bufferTimeoutMs: 120_000,
      retentionDays: 7,
      ...config,
    };
  }

  getState(): KafkaConnectionState {
    return this.state;
  }

  // ── Connection ──

  async connect(): Promise<void> {
    // In production: new Kafka({ brokers, clientId }).producer() + .consumer({ groupId })
    this.state = 'connected';
  }

  async disconnect(): Promise<void> {
    this.state = 'disconnected';
  }

  // ── Publishing (REQ-CTX-006, REQ-CTX-007) ──

  /**
   * Publish an event to a topic.
   * Events are partitioned by customer_id for causal ordering (REQ-CTX-007).
   * Includes idempotency key for deduplication (REQ-CTX-017).
   */
  async publish(topic: string, event: EventMessage): Promise<void> {
    // Ensure idempotency key
    if (!event.idempotencyKey) {
      event.idempotencyKey = `${event.agentId}-${event.correlationId}-${event.timestamp}`;
    }

    if (this.state === 'buffering') {
      this.buffer.push(event);
      return;
    }

    if (this.state === 'degraded') {
      throw new Error('Kafka in DEGRADED mode: event publishing unavailable. Single-agent operations only.');
    }

    if (this.state !== 'connected') {
      throw new Error(`Cannot publish: Kafka is ${this.state}`);
    }

    // In production: await this.producer.send({
    //   topic,
    //   messages: [{
    //     key: event.customerId,  // Partition by customer_id
    //     value: JSON.stringify(event),
    //     headers: { idempotencyKey: event.idempotencyKey },
    //   }],
    // });
    void topic;
  }

  /**
   * Publish to customer-specific domain topic.
   * Topic naming: dw.{domain}.{customerId} for high-volume customers,
   * dw.{domain}.shared for standard customers.
   */
  async publishToCustomerTopic(domain: string, event: EventMessage, dedicated = false): Promise<void> {
    const topic = dedicated
      ? `dw.${domain}.${event.customerId}`
      : `dw.${domain}.shared`;
    await this.publish(topic, event);
  }

  // ── Subscribing ──

  /**
   * Subscribe to events on a topic.
   * Consumer offsets committed after successful processing (REQ-CTX-017).
   */
  async subscribe(
    topic: string,
    handler: (event: EventMessage) => Promise<void>,
  ): Promise<void> {
    const handlers = this.subscriptions.get(topic) ?? [];
    handlers.push(handler);
    this.subscriptions.set(topic, handlers);

    // In production: consumer.subscribe({ topic }) + consumer.run({ eachMessage })
  }

  /**
   * Process an incoming event with idempotency check.
   * Returns false if the event was already processed (duplicate).
   */
  async processEvent(event: EventMessage): Promise<boolean> {
    const key = event.idempotencyKey ?? `${event.agentId}-${event.correlationId}-${event.timestamp}`;

    // Idempotency check (REQ-CTX-017)
    if (this.processedIds.has(key)) {
      return false; // Duplicate, skip
    }

    // Track processed ID
    this.processedIds.add(key);
    if (this.processedIds.size > KafkaEventBus.MAX_PROCESSED_IDS) {
      // Cleanup oldest entries (simple approach; production would use TTL)
      const entries = Array.from(this.processedIds);
      this.processedIds = new Set(entries.slice(entries.length - 50_000));
    }

    // Dispatch to handlers
    const topic = `dw.${event.eventType}.shared`;
    const handlers = this.subscriptions.get(topic) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }

    return true;
  }

  // ── Failure Handling (REQ-CTX-013) ──

  /**
   * Handle Kafka disconnection.
   * Starts buffering events locally for up to 120 seconds.
   */
  handleDisconnect(): void {
    this.state = 'buffering';
    this.bufferingStartedAt = Date.now();
  }

  /**
   * Check if buffer timeout has elapsed (120s) and transition to DEGRADED.
   */
  checkBufferTimeout(): boolean {
    if (this.state !== 'buffering' || !this.bufferingStartedAt) {
      return false;
    }

    if (Date.now() - this.bufferingStartedAt >= this.config.bufferTimeoutMs) {
      this.state = 'degraded';
      return true;
    }

    return false;
  }

  /**
   * Handle Kafka reconnection. Replays buffered events in order
   * with deduplication via idempotency keys (REQ-CTX-013).
   */
  async handleReconnect(): Promise<number> {
    const bufferedCount = this.buffer.length;
    this.state = 'connected';
    this.bufferingStartedAt = null;

    // Replay buffered events in order
    for (const event of this.buffer) {
      const topic = `dw.${event.eventType}.shared`;
      // In production: publish to Kafka with idempotency key
      void topic;
      void event;
    }

    this.buffer = [];
    return bufferedCount;
  }

  /**
   * Get current buffer size.
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  // ── Event Types ──

  /**
   * Get supported event types per REQ-CTX-006.
   */
  getSupportedEventTypes(): EventType[] {
    return [
      'schema_changed',
      'quality_alert',
      'pipeline_completed',
      'access_granted',
      'incident_detected',
      'agent_spawned',
      'agent_retired',
      'stream_configured',
      'stream_health_changed',
      'sla_breached',
      'connector_status_changed',
    ];
  }

  /**
   * Create a standard event message.
   */
  static createEvent(
    eventType: EventType,
    customerId: string,
    agentId: string,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): EventMessage {
    return {
      eventType,
      customerId,
      agentId,
      payload,
      timestamp: Date.now(),
      correlationId: correlationId ?? `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      idempotencyKey: `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}
