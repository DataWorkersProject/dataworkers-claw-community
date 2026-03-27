import { describe, it, expect } from 'vitest';
import { InMemoryKeyValueStore } from '../key-value-store.js';

describe('InMemoryKeyValueStore', () => {
  it('get returns null for nonexistent key', async () => {
    const kv = new InMemoryKeyValueStore();
    expect(await kv.get('missing')).toBeNull();
  });

  it('set and get a value', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('key1', 'value1');
    expect(await kv.get('key1')).toBe('value1');
  });

  it('set overwrites existing value', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('key1', 'old');
    await kv.set('key1', 'new');
    expect(await kv.get('key1')).toBe('new');
  });

  it('TTL expires the key', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('temp', 'value', 1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 5));
    expect(await kv.get('temp')).toBeNull();
  });

  it('key without TTL does not expire', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('permanent', 'value');
    expect(await kv.get('permanent')).toBe('value');
  });

  it('delete removes the key', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('key1', 'value1');
    expect(await kv.delete('key1')).toBe(true);
    expect(await kv.get('key1')).toBeNull();
  });

  it('delete returns false for nonexistent key', async () => {
    const kv = new InMemoryKeyValueStore();
    expect(await kv.delete('missing')).toBe(false);
  });

  it('exists returns true for existing key', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('key1', 'value1');
    expect(await kv.exists('key1')).toBe(true);
  });

  it('exists returns false for nonexistent key', async () => {
    const kv = new InMemoryKeyValueStore();
    expect(await kv.exists('missing')).toBe(false);
  });

  it('keys returns all keys without pattern', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('a', '1');
    await kv.set('b', '2');
    await kv.set('c', '3');
    expect(await kv.keys()).toHaveLength(3);
  });

  it('keys filters by prefix pattern', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('user:1', 'alice');
    await kv.set('user:2', 'bob');
    await kv.set('order:1', 'pizza');
    expect(await kv.keys('user:*')).toHaveLength(2);
    expect(await kv.keys('order:*')).toHaveLength(1);
  });

  it('keys with exact match pattern', async () => {
    const kv = new InMemoryKeyValueStore();
    await kv.set('exact', 'match');
    await kv.set('exact2', 'no');
    expect(await kv.keys('exact')).toHaveLength(1);
  });
});
