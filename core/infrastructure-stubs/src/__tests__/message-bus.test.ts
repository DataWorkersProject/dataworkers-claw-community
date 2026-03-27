import { describe, it, expect } from 'vitest';
import { InMemoryMessageBus, type MessageBusEvent } from '../message-bus.js';

function makeEvent(overrides: Partial<MessageBusEvent> = {}): MessageBusEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    type: 'test_event',
    payload: {},
    timestamp: Date.now(),
    customerId: 'cust-1',
    ...overrides,
  };
}

describe('InMemoryMessageBus', () => {
  it('publish stores event on topic', async () => {
    const bus = new InMemoryMessageBus();
    await bus.publish('topic-1', makeEvent());
    expect(await bus.getEvents('topic-1')).toHaveLength(1);
  });

  it('subscribe receives published events', async () => {
    const bus = new InMemoryMessageBus();
    const received: MessageBusEvent[] = [];
    await bus.subscribe('topic-1', (e) => received.push(e));
    await bus.publish('topic-1', makeEvent({ type: 'hello' }));
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('hello');
  });

  it('multiple subscribers all receive event', async () => {
    const bus = new InMemoryMessageBus();
    let count = 0;
    await bus.subscribe('topic-1', () => count++);
    await bus.subscribe('topic-1', () => count++);
    await bus.publish('topic-1', makeEvent());
    expect(count).toBe(2);
  });

  it('subscribers on different topics are isolated', async () => {
    const bus = new InMemoryMessageBus();
    const received: string[] = [];
    await bus.subscribe('topic-a', () => received.push('a'));
    await bus.subscribe('topic-b', () => received.push('b'));
    await bus.publish('topic-a', makeEvent());
    expect(received).toEqual(['a']);
  });

  it('getEvents returns empty array for unknown topic', async () => {
    const bus = new InMemoryMessageBus();
    expect(await bus.getEvents('nonexistent')).toEqual([]);
  });

  it('clear removes all topics and subscribers', async () => {
    const bus = new InMemoryMessageBus();
    await bus.publish('topic-1', makeEvent());
    await bus.subscribe('topic-1', () => {});
    await bus.clear();
    expect(await bus.getEvents('topic-1')).toEqual([]);
  });

  it('events are ordered by publish time', async () => {
    const bus = new InMemoryMessageBus();
    await bus.publish('topic-1', makeEvent({ id: 'first' }));
    await bus.publish('topic-1', makeEvent({ id: 'second' }));
    const events = await bus.getEvents('topic-1');
    expect(events[0].id).toBe('first');
    expect(events[1].id).toBe('second');
  });

  it('subscriber is called synchronously', async () => {
    const bus = new InMemoryMessageBus();
    let called = false;
    await bus.subscribe('topic-1', () => { called = true; });
    await bus.publish('topic-1', makeEvent());
    expect(called).toBe(true);
  });

  // --- request/reply via onRequest ---

  it('request/reply basic flow via onRequest', async () => {
    const bus = new InMemoryMessageBus();
    bus.onRequest('get-status', async (payload) => {
      const p = payload as Record<string, unknown>;
      return { status: 'ok', echo: p.value };
    });
    const result = await bus.request('get-status', { value: 42 });
    expect(result).toEqual({ status: 'ok', echo: 42 });
  });

  it('request times out when onRequest handler is slow', async () => {
    const bus = new InMemoryMessageBus();
    bus.onRequest('slow-topic', async () => {
      await new Promise((r) => setTimeout(r, 200));
      return { done: true };
    });
    await expect(bus.request('slow-topic', {}, 50)).rejects.toThrow(/timed out/);
  });

  it('request to unknown topic (no onRequest, no reply) times out', async () => {
    const bus = new InMemoryMessageBus();
    await expect(bus.request('nonexistent', {}, 50)).rejects.toThrow(/timed out/);
  });

  // --- unsubscribe ---

  it('unsubscribe stops receiving events', async () => {
    const bus = new InMemoryMessageBus();
    const received: MessageBusEvent[] = [];
    const handler = (e: MessageBusEvent) => received.push(e);
    await bus.subscribe('topic-1', handler);
    await bus.publish('topic-1', makeEvent({ id: 'before' }));
    expect(received).toHaveLength(1);

    bus.unsubscribe('topic-1', handler);
    await bus.publish('topic-1', makeEvent({ id: 'after' }));
    expect(received).toHaveLength(1); // still 1, handler was removed
  });

  it('unsubscribe on unknown topic does not throw', () => {
    const bus = new InMemoryMessageBus();
    expect(() => bus.unsubscribe('nope', () => {})).not.toThrow();
  });
});
