import { describe, it, expect, beforeEach } from 'vitest';
import { KafkaEventBus } from '../kafka-bus.js';
import type { EventMessage } from '../types.js';

function createTestEvent(overrides?: Partial<EventMessage>): EventMessage {
  return {
    eventType: 'pipeline_completed',
    customerId: 'cust-1',
    agentId: 'dw-pipelines',
    payload: { pipelineId: 'pipe-1' },
    timestamp: Date.now(),
    correlationId: `corr-${Date.now()}`,
    ...overrides,
  };
}

describe('KafkaEventBus', () => {
  let bus: KafkaEventBus;

  beforeEach(async () => {
    bus = new KafkaEventBus({
      brokers: ['localhost:9092'],
      clientId: 'test-client',
      groupId: 'test-group',
      bufferTimeoutMs: 100, // Short for testing
    });
    await bus.connect();
  });

  // REQ-CTX-006: Event types
  it('supports all registered event types', () => {
    const types = bus.getSupportedEventTypes();
    expect(types.length).toBeGreaterThanOrEqual(7);
    expect(types).toContain('schema_changed');
    expect(types).toContain('quality_alert');
    expect(types).toContain('pipeline_completed');
    expect(types).toContain('incident_detected');
  });

  // Publishing
  it('publishes events when connected', async () => {
    await bus.publish('dw.pipeline.shared', createTestEvent());
    // No error = success
  });

  it('auto-generates idempotency key', async () => {
    const event = createTestEvent();
    delete event.idempotencyKey;
    await bus.publish('test', event);
    expect(event.idempotencyKey).toBeDefined();
  });

  // REQ-CTX-017: Idempotency
  it('deduplicates events by idempotency key', async () => {
    const event = createTestEvent({ idempotencyKey: 'dedup-1' });
    const first = await bus.processEvent(event);
    const second = await bus.processEvent(event);
    expect(first).toBe(true);
    expect(second).toBe(false); // Duplicate rejected
  });

  // Subscription
  it('dispatches events to subscribers', async () => {
    let received: EventMessage | null = null;
    await bus.subscribe('dw.pipeline_completed.shared', async (event) => {
      received = event;
    });

    const event = createTestEvent();
    await bus.processEvent(event);
    expect(received).not.toBeNull();
    expect(received!.eventType).toBe('pipeline_completed');
  });

  // REQ-CTX-013: Failure handling
  it('buffers events on disconnect', async () => {
    bus.handleDisconnect();
    expect(bus.getState()).toBe('buffering');

    await bus.publish('test', createTestEvent());
    await bus.publish('test', createTestEvent());
    expect(bus.getBufferSize()).toBe(2);
  });

  it('transitions to DEGRADED after buffer timeout', async () => {
    bus.handleDisconnect();
    // Simulate time passing
    (bus as unknown as { bufferingStartedAt: number }).bufferingStartedAt = Date.now() - 200;
    const transitioned = bus.checkBufferTimeout();
    expect(transitioned).toBe(true);
    expect(bus.getState()).toBe('degraded');
  });

  it('rejects publishing in DEGRADED mode', async () => {
    bus.handleDisconnect();
    (bus as unknown as { bufferingStartedAt: number }).bufferingStartedAt = Date.now() - 200;
    bus.checkBufferTimeout();

    await expect(bus.publish('test', createTestEvent())).rejects.toThrow('DEGRADED');
  });

  it('replays buffered events on reconnect', async () => {
    bus.handleDisconnect();
    await bus.publish('test', createTestEvent());
    await bus.publish('test', createTestEvent());
    await bus.publish('test', createTestEvent());

    const replayed = await bus.handleReconnect();
    expect(replayed).toBe(3);
    expect(bus.getBufferSize()).toBe(0);
    expect(bus.getState()).toBe('connected');
  });

  // Static helpers
  it('creates standard events', () => {
    const event = KafkaEventBus.createEvent(
      'incident_detected',
      'cust-1',
      'dw-incidents',
      { severity: 'critical' },
    );
    expect(event.eventType).toBe('incident_detected');
    expect(event.customerId).toBe('cust-1');
    expect(event.idempotencyKey).toBeDefined();
  });
});
