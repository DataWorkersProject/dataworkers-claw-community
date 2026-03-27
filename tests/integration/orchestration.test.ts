/**
 * Orchestration integration tests with real infra patterns.
 *
 * Tests:
 * 1. Message bus event propagation between agents
 * 2. Infrastructure factory creates correct adapters based on env vars
 * 3. Multiple agents sharing the same relational store see consistent data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryKeyValueStore,
  InMemoryRelationalStore,
  InMemoryMessageBus,
  InMemoryGraphDB,
  InMemoryVectorStore,
  InMemoryFullTextSearch,
  InMemoryLLMClient,
  InMemoryOrchestratorAPI,
  InMemoryWarehouseConnector,
  createKeyValueStore,
  createMessageBus,
  createRelationalStore,
  createGraphDB,
  createVectorStore,
  createFullTextSearch,
  createLLMClient,
  createWarehouseConnector,
  createOrchestratorAPI,
} from '../../core/infrastructure-stubs/src/index.js';
import type { MessageBusEvent } from '../../core/infrastructure-stubs/src/index.js';
import { TaskScheduler } from '../../agents/dw-orchestration/src/task-scheduler.js';
import { HeartbeatMonitor } from '../../agents/dw-orchestration/src/heartbeat-monitor.js';
import { AgentRegistry } from '../../agents/dw-orchestration/src/agent-registry.js';
import type { ScheduledTask, AgentInstance } from '../../agents/dw-orchestration/src/types.js';

// ---------------------------------------------------------------------------
// 1. Message bus event propagation between agents
// ---------------------------------------------------------------------------
describe('Message bus event propagation between agents', () => {
  let bus: InMemoryMessageBus;

  beforeEach(() => {
    bus = new InMemoryMessageBus();
  });

  it('event published by pipeline agent is received by incident agent subscriber', async () => {
    const received: MessageBusEvent[] = [];

    // Simulate incident agent subscribing to pipeline events
    await bus.subscribe('pipeline.events', (event) => {
      received.push(event);
    });

    // Simulate pipeline agent publishing a pipeline_created event
    const pipelineEvent: MessageBusEvent = {
      id: 'evt-pipe-prop-001',
      type: 'pipeline_created',
      payload: {
        pipelineId: 'pipe-1',
        pipelineName: 'daily_revenue_etl',
      },
      timestamp: Date.now(),
      customerId: 'cust-1',
    };
    await bus.publish('pipeline.events', pipelineEvent);

    // Allow async subscriber to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('pipeline_created');
    expect(received[0].payload.pipelineId).toBe('pipe-1');
  });

  it('multiple agents subscribe to different topics independently', async () => {
    const incidentReceived: MessageBusEvent[] = [];
    const costReceived: MessageBusEvent[] = [];
    const qualityReceived: MessageBusEvent[] = [];

    // Three different agent subscribers
    await bus.subscribe('incident.events', (evt) => incidentReceived.push(evt));
    await bus.subscribe('cost.events', (evt) => costReceived.push(evt));
    await bus.subscribe('quality.events', (evt) => qualityReceived.push(evt));

    // Publish to each topic
    await bus.publish('incident.events', {
      id: 'i1', type: 'incident_detected', payload: { severity: 'high' }, timestamp: Date.now(), customerId: 'c1',
    });
    await bus.publish('cost.events', {
      id: 'c1', type: 'cost_anomaly', payload: { spend: 15000 }, timestamp: Date.now(), customerId: 'c1',
    });
    await bus.publish('quality.events', {
      id: 'q1', type: 'quality_check_passed', payload: { score: 98 }, timestamp: Date.now(), customerId: 'c1',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(incidentReceived).toHaveLength(1);
    expect(costReceived).toHaveLength(1);
    expect(qualityReceived).toHaveLength(1);

    // Each subscriber only gets their own events
    expect(incidentReceived[0].type).toBe('incident_detected');
    expect(costReceived[0].type).toBe('cost_anomaly');
    expect(qualityReceived[0].type).toBe('quality_check_passed');
  });

  it('subscriber callback triggers downstream agent registration', async () => {
    const store = new InMemoryRelationalStore();
    const registry = new AgentRegistry(store);
    await registry.init();

    // Simulate: when an agent lifecycle event arrives, auto-register
    await bus.subscribe('agent.lifecycle', async (evt) => {
      if (evt.type === 'agent_registered') {
        await registry.register(evt.payload as unknown as AgentInstance);
      }
    });

    await bus.publish('agent.lifecycle', {
      id: 'evt-reg-1',
      type: 'agent_registered',
      payload: {
        name: 'dw-new-agent',
        status: 'active',
        lastHeartbeat: Date.now(),
        capabilities: ['analyze'],
        tenantConfig: {},
      },
      timestamp: Date.now(),
      customerId: 'system',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const agents = await registry.list();
    expect(agents.find((a) => a.name === 'dw-new-agent')).toBeDefined();
  });

  it('events flow from pipeline agent -> incident agent -> cost agent', async () => {
    const incidentEvents: MessageBusEvent[] = [];
    const costEvents: MessageBusEvent[] = [];

    // Incident agent subscribes to pipeline failures
    await bus.subscribe('pipeline.failures', async (evt) => {
      incidentEvents.push(evt);
      // Incident agent detects cost impact and publishes to cost topic
      await bus.publish('cost.impact', {
        id: `cost-from-${evt.id}`,
        type: 'cost_impact_detected',
        payload: {
          source: 'pipeline_failure',
          pipelineId: evt.payload.pipelineId,
          estimatedWaste: 500,
        },
        timestamp: Date.now(),
        customerId: evt.customerId,
      });
    });

    // Cost agent subscribes to cost impact events
    await bus.subscribe('cost.impact', (evt) => {
      costEvents.push(evt);
    });

    // Pipeline agent publishes a failure
    await bus.publish('pipeline.failures', {
      id: 'evt-fail-1',
      type: 'pipeline_failed',
      payload: { pipelineId: 'pipe-revenue', error: 'timeout' },
      timestamp: Date.now(),
      customerId: 'cust-1',
    });

    // Allow propagation through the chain
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(incidentEvents).toHaveLength(1);
    expect(costEvents).toHaveLength(1);
    expect(costEvents[0].type).toBe('cost_impact_detected');
    expect(costEvents[0].payload.pipelineId).toBe('pipe-revenue');
  });

  it('getEvents returns all published events for a topic', async () => {
    for (let i = 0; i < 5; i++) {
      await bus.publish('test.topic', {
        id: `evt-${i}`,
        type: 'test_event',
        payload: { index: i },
        timestamp: Date.now(),
        customerId: 'c1',
      });
    }

    const events = await bus.getEvents('test.topic');
    expect(events).toHaveLength(5);
    expect(events[0].id).toBe('evt-0');
    expect(events[4].id).toBe('evt-4');
  });
});

// ---------------------------------------------------------------------------
// 2. Infrastructure factory creates correct adapters based on env vars
// ---------------------------------------------------------------------------
describe('Infrastructure factory adapter selection', () => {
  // Without any env vars set, all factories should return InMemory instances

  it('createKeyValueStore returns InMemory when no REDIS_URL', async () => {
    const kv = await createKeyValueStore();
    expect(kv).toBeInstanceOf(InMemoryKeyValueStore);
  });

  it('createMessageBus returns InMemory when no KAFKA_BROKERS', async () => {
    const bus = await createMessageBus();
    expect(bus).toBeInstanceOf(InMemoryMessageBus);
  });

  it('createRelationalStore returns InMemory when no DATABASE_URL', async () => {
    const store = await createRelationalStore();
    expect(store).toBeInstanceOf(InMemoryRelationalStore);
  });

  it('createGraphDB returns InMemory when no NEO4J_URI', async () => {
    const graph = await createGraphDB();
    expect(graph).toBeInstanceOf(InMemoryGraphDB);
  });

  it('createVectorStore returns InMemory when no PGVECTOR_ENABLED', async () => {
    const vector = await createVectorStore();
    expect(vector).toBeInstanceOf(InMemoryVectorStore);
  });

  it('createFullTextSearch returns InMemory when no PG_FTS_ENABLED', async () => {
    const fts = await createFullTextSearch();
    expect(fts).toBeInstanceOf(InMemoryFullTextSearch);
  });

  it('createLLMClient returns InMemory when no API keys', async () => {
    const llm = await createLLMClient();
    expect(llm).toBeInstanceOf(InMemoryLLMClient);
  });

  it('createWarehouseConnector returns InMemory when no WAREHOUSE_TYPE', async () => {
    const wh = await createWarehouseConnector();
    expect(wh).toBeInstanceOf(InMemoryWarehouseConnector);
  });

  it('createOrchestratorAPI returns InMemory when no AIRFLOW_URL', async () => {
    const orch = await createOrchestratorAPI();
    expect(orch).toBeInstanceOf(InMemoryOrchestratorAPI);
  });

  it('all factory-created InMemory stores are functional', async () => {
    const kv = await createKeyValueStore();
    const bus = await createMessageBus();
    const store = await createRelationalStore();
    const graph = await createGraphDB();

    // KV store
    await kv.set('test-key', 'test-value');
    expect(await kv.get('test-key')).toBe('test-value');

    // Message bus
    await bus.publish('test-topic', {
      id: 'e1', type: 'test', payload: {}, timestamp: Date.now(), customerId: 'c1',
    });
    expect(await bus.getEvents('test-topic')).toHaveLength(1);

    // Relational store
    await store.createTable('test_table');
    await store.insert('test_table', { id: 1, name: 'test' });
    const rows = await store.query('test_table');
    expect(rows).toHaveLength(1);

    // Graph DB
    await graph.addNode({ id: 'n1', type: 'test', name: 'node1', platform: 'test', properties: {}, customerId: 'c1' });
    expect(await graph.getNode('n1')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Multiple agents sharing the same relational store see consistent data
// ---------------------------------------------------------------------------
describe('Multiple agents sharing the same relational store', () => {
  let sharedStore: InMemoryRelationalStore;

  beforeEach(async () => {
    sharedStore = new InMemoryRelationalStore();
    await sharedStore.createTable('shared_incidents');
    await sharedStore.createTable('shared_metrics');
  });

  it('incident agent writes, cost agent reads the same data', async () => {
    // Incident agent writes an incident record
    await sharedStore.insert('shared_incidents', {
      id: 'inc-shared-1',
      type: 'resource_exhaustion',
      severity: 'high',
      customerId: 'cust-1',
      affectedResource: 'warehouse_primary',
      detectedAt: Date.now(),
    });

    // Cost agent queries the same table
    const incidents = await sharedStore.query('shared_incidents', (r) => r.customerId === 'cust-1');
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe('resource_exhaustion');
    expect(incidents[0].affectedResource).toBe('warehouse_primary');
  });

  it('multiple agents writing to the same table produces consistent counts', async () => {
    // Pipeline agent writes metrics
    await sharedStore.insert('shared_metrics', { agentId: 'dw-pipelines', metric: 'pipelines_created', value: 5, customerId: 'c1' });
    await sharedStore.insert('shared_metrics', { agentId: 'dw-pipelines', metric: 'pipelines_failed', value: 1, customerId: 'c1' });

    // Incident agent writes metrics
    await sharedStore.insert('shared_metrics', { agentId: 'dw-incidents', metric: 'incidents_detected', value: 3, customerId: 'c1' });
    await sharedStore.insert('shared_metrics', { agentId: 'dw-incidents', metric: 'incidents_resolved', value: 2, customerId: 'c1' });

    // Cost agent writes metrics
    await sharedStore.insert('shared_metrics', { agentId: 'dw-cost', metric: 'tables_analyzed', value: 15, customerId: 'c1' });

    // All agents see consistent total count
    const allMetrics = await sharedStore.query('shared_metrics');
    expect(allMetrics).toHaveLength(5);

    // Agent-specific queries return correct subsets
    const pipelineMetrics = await sharedStore.query('shared_metrics', (r) => r.agentId === 'dw-pipelines');
    expect(pipelineMetrics).toHaveLength(2);

    const incidentMetrics = await sharedStore.query('shared_metrics', (r) => r.agentId === 'dw-incidents');
    expect(incidentMetrics).toHaveLength(2);

    const costMetrics = await sharedStore.query('shared_metrics', (r) => r.agentId === 'dw-cost');
    expect(costMetrics).toHaveLength(1);
  });

  it('writes from one agent are immediately visible to another', async () => {
    // Agent A writes
    await sharedStore.insert('shared_incidents', {
      id: 'inc-visibility-1',
      status: 'detected',
      customerId: 'c1',
    });

    // Agent B reads immediately
    const result = await sharedStore.query('shared_incidents', (r) => r.id === 'inc-visibility-1');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('detected');
  });

  it('count aggregation reflects writes from all agents', async () => {
    // Three agents each write records
    for (let i = 0; i < 3; i++) {
      await sharedStore.insert('shared_metrics', { agentId: 'dw-pipelines', value: i, customerId: 'c1' });
    }
    for (let i = 0; i < 2; i++) {
      await sharedStore.insert('shared_metrics', { agentId: 'dw-incidents', value: i, customerId: 'c1' });
    }
    await sharedStore.insert('shared_metrics', { agentId: 'dw-cost', value: 0, customerId: 'c1' });

    const total = await sharedStore.count('shared_metrics');
    expect(total).toBe(6);

    const pipelinesCount = await sharedStore.count('shared_metrics', (r) => r.agentId === 'dw-pipelines');
    expect(pipelinesCount).toBe(3);
  });

  it('ordering works consistently across agent writes', async () => {
    const now = Date.now();
    await sharedStore.insert('shared_incidents', { id: 'inc-3', detectedAt: now - 1000, customerId: 'c1' });
    await sharedStore.insert('shared_incidents', { id: 'inc-1', detectedAt: now - 3000, customerId: 'c1' });
    await sharedStore.insert('shared_incidents', { id: 'inc-2', detectedAt: now - 2000, customerId: 'c1' });

    const sorted = await sharedStore.query(
      'shared_incidents',
      undefined,
      { column: 'detectedAt', direction: 'asc' },
    );
    expect(sorted[0].id).toBe('inc-1');
    expect(sorted[1].id).toBe('inc-2');
    expect(sorted[2].id).toBe('inc-3');
  });
});

// ---------------------------------------------------------------------------
// Cross-component orchestration workflow
// ---------------------------------------------------------------------------
describe('Cross-component orchestration workflow', () => {
  it('failed heartbeat triggers task redistribution', async () => {
    const kv = new InMemoryKeyValueStore();
    let currentTime = Date.now();
    const monitor = new HeartbeatMonitor(kv, () => currentTime);
    const scheduler = new TaskScheduler(kv);
    const relStore = new InMemoryRelationalStore();
    const registry = new AgentRegistry(relStore);
    await registry.init();

    // Register agents
    await registry.register({ name: 'dw-pipelines', status: 'active', lastHeartbeat: currentTime, capabilities: [], tenantConfig: {} });
    await registry.register({ name: 'dw-backup', status: 'active', lastHeartbeat: currentTime, capabilities: [], tenantConfig: {} });

    // Submit tasks and heartbeats
    await monitor.beat('dw-pipelines');
    await monitor.beat('dw-backup');
    const task: ScheduledTask = { id: 't1', priority: 1, agentName: 'dw-pipelines', payload: {}, customerId: 'c1', createdAt: currentTime, status: 'queued' };
    await scheduler.submit(task);

    // Agent dies
    currentTime += 20_000;
    await monitor.beat('dw-backup');

    const failed = await monitor.getFailedAgents();
    expect(failed).toContain('dw-pipelines');

    // Redistribute tasks
    const redistributed = await scheduler.redistributeTasks('dw-pipelines', 'dw-backup');
    expect(redistributed).toBe(1);

    // Backup agent can now pick up the task
    const pickedUp = await scheduler.dequeue('dw-backup');
    expect(pickedUp).not.toBeNull();
    expect(pickedUp!.id).toBe('t1');
  });
});
