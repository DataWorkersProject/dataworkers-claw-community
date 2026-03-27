import { describe, it, expect } from 'vitest';
import { HeartbeatMonitor } from '../heartbeat-monitor.js';
import { InMemoryKeyValueStore } from '@data-workers/infrastructure-stubs';

describe('HeartbeatMonitor', () => {
  it('exports HeartbeatMonitor class', () => {
    expect(HeartbeatMonitor).toBeDefined();
  });

  it('records a heartbeat', async () => {
    const kv = new InMemoryKeyValueStore();
    const monitor = new HeartbeatMonitor(kv);
    await monitor.beat('agent-pipelines');
    const statuses = await monitor.checkHealth();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].agentName).toBe('agent-pipelines');
    expect(statuses[0].alive).toBe(true);
  });

  it('reports dead agent when heartbeat expires', async () => {
    const kv = new InMemoryKeyValueStore();
    let time = 1000;
    const monitor = new HeartbeatMonitor(kv, () => time);
    await monitor.beat('agent-1');
    // Jump forward past TTL (15s)
    time += 20_000;
    const statuses = await monitor.checkHealth();
    expect(statuses[0].alive).toBe(false);
  });

  it('tracks multiple agents', async () => {
    const kv = new InMemoryKeyValueStore();
    const monitor = new HeartbeatMonitor(kv);
    await monitor.beat('agent-1');
    await monitor.beat('agent-2');
    const statuses = await monitor.checkHealth();
    expect(statuses).toHaveLength(2);
  });
});
