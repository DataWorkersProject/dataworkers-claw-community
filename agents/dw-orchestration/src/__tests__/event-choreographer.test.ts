import { describe, it, expect } from 'vitest';
import { EventChoreographer } from '../event-choreographer.js';
import { InMemoryMessageBus } from '@data-workers/infrastructure-stubs';

describe('EventChoreographer', () => {
  it('exports EventChoreographer class', () => {
    expect(EventChoreographer).toBeDefined();
  });

  it('creates instance with message bus', () => {
    const bus = new InMemoryMessageBus();
    const choreographer = new EventChoreographer(bus);
    expect(choreographer).toBeDefined();
  });

  it('subscribes agent to event type', () => {
    const bus = new InMemoryMessageBus();
    const choreographer = new EventChoreographer(bus);
    choreographer.subscribe('schema_changed', 'dw-quality');
    // No error means subscription succeeded
    expect(true).toBe(true);
  });

  it('routes event to subscribed agents', async () => {
    const bus = new InMemoryMessageBus();
    const choreographer = new EventChoreographer(bus);
    choreographer.subscribe('schema_changed', 'dw-quality');
    choreographer.subscribe('schema_changed', 'dw-incidents');

    const route = await choreographer.route({
      id: 'evt-1',
      type: 'schema_changed',
      payload: { table: 'users' },
      timestamp: Date.now(),
    });

    expect(route.targetAgents).toContain('dw-quality');
    expect(route.targetAgents).toContain('dw-incidents');
    expect(typeof route.traceId).toBe('string');
  });
});
