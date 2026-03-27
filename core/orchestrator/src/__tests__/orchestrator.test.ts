import { describe, it, expect } from 'vitest';
import { TaskScheduler } from '../task-scheduler.js';
import { AgentRegistry } from '../agent-registry.js';
import { HealthMonitor } from '../health-monitor.js';
import { DependencyDiscoverer } from '../dependency-discoverer.js';

describe('TaskScheduler (REQ-ORCH-001)', () => {
  it('schedules by priority', () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue({ id: 't1', agentId: 'dw-cost', customerId: 'c1', priority: 7, payload: {} });
    scheduler.enqueue({ id: 't2', agentId: 'dw-incidents', customerId: 'c1', priority: 1, payload: {} });
    const next = scheduler.dequeue();
    expect(next?.agentId).toBe('dw-incidents'); // Higher priority (lower number)
  });

  it('respects SLA deadlines within same priority', () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue({ id: 't1', agentId: 'a1', customerId: 'c1', priority: 5, slaDeadline: Date.now() + 60000, payload: {} });
    scheduler.enqueue({ id: 't2', agentId: 'a2', customerId: 'c1', priority: 5, slaDeadline: Date.now() + 10000, payload: {} });
    const next = scheduler.dequeue();
    expect(next?.id).toBe('t2'); // Earlier deadline
  });

  it('tracks running and queued counts', () => {
    const scheduler = new TaskScheduler({ maxConcurrentTasks: 2 });
    scheduler.enqueue({ id: 't1', agentId: 'a1', customerId: 'c1', priority: 1, payload: {} });
    scheduler.enqueue({ id: 't2', agentId: 'a2', customerId: 'c1', priority: 2, payload: {} });
    scheduler.dequeue();
    expect(scheduler.getRunningCount()).toBe(1);
    expect(scheduler.getQueueSize()).toBe(1);
  });
});

describe('AgentRegistry (REQ-ORCH-005, REQ-ARCH-007)', () => {
  it('registers and lists agents', () => {
    const registry = new AgentRegistry();
    registry.register({ agentId: 'dw-pipelines', name: 'Pipeline Agent', version: '0.1.0', status: 'active', mcpEndpoint: 'localhost:3001', toolCount: 4 });
    registry.register({ agentId: 'dw-incidents', name: 'Incident Agent', version: '0.1.0', status: 'active', mcpEndpoint: 'localhost:3002', toolCount: 4 });
    expect(registry.listAgents()).toHaveLength(2);
    expect(registry.listActiveAgents()).toHaveLength(2);
  });

  it('supports per-tenant agent toggles', () => {
    const registry = new AgentRegistry();
    registry.register({ agentId: 'dw-cost', name: 'Cost Agent', version: '0.1.0', status: 'active', mcpEndpoint: 'localhost:3003', toolCount: 4 });
    registry.setTenantConfig('dw-cost', 'cust-1', true);
    registry.setTenantConfig('dw-cost', 'cust-2', false);
    expect(registry.isEnabledForTenant('dw-cost', 'cust-1')).toBe(true);
    expect(registry.isEnabledForTenant('dw-cost', 'cust-2')).toBe(false);
  });
});

describe('HealthMonitor (REQ-ORCH-002, REQ-ORCH-003)', () => {
  it('tracks agent health', () => {
    const monitor = new HealthMonitor();
    monitor.recordHealthCheck('dw-pipelines', true, 50);
    expect(monitor.isHealthy('dw-pipelines')).toBe(true);
  });

  it('detects unhealthy agents after failures', () => {
    const monitor = new HealthMonitor(3);
    monitor.recordHealthCheck('dw-incidents', false, 0);
    monitor.recordHealthCheck('dw-incidents', false, 0);
    monitor.recordHealthCheck('dw-incidents', false, 0);
    expect(monitor.isHealthy('dw-incidents')).toBe(false);
    expect(monitor.getUnhealthyAgents()).toHaveLength(1);
  });

  it('resets on success', () => {
    const monitor = new HealthMonitor(3);
    monitor.recordHealthCheck('dw-quality', false, 0);
    monitor.recordHealthCheck('dw-quality', false, 0);
    monitor.recordHealthCheck('dw-quality', true, 30);
    expect(monitor.isHealthy('dw-quality')).toBe(true);
  });
});

describe('DependencyDiscoverer (REQ-ORCH-004)', () => {
  it('discovers read-after-write dependencies', () => {
    const discoverer = new DependencyDiscoverer();
    discoverer.recordAccess('dw-pipelines', 'orders_table', 'write');
    discoverer.recordAccess('dw-quality', 'orders_table', 'read');
    const deps = discoverer.discover();
    expect(deps).toHaveLength(1);
    expect(deps[0].sourceAgent).toBe('dw-pipelines');
    expect(deps[0].targetAgent).toBe('dw-quality');
    expect(deps[0].type).toBe('read_after_write');
  });

  it('does not duplicate dependencies', () => {
    const discoverer = new DependencyDiscoverer();
    discoverer.recordAccess('a1', 'res1', 'write');
    discoverer.recordAccess('a2', 'res1', 'read');
    discoverer.discover();
    discoverer.recordAccess('a1', 'res1', 'write');
    discoverer.recordAccess('a2', 'res1', 'read');
    const deps = discoverer.discover();
    expect(deps).toHaveLength(0); // Already discovered
    expect(discoverer.getDependencies()).toHaveLength(1);
  });
});
