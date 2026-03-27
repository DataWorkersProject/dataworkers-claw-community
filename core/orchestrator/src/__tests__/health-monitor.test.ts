import { describe, it, expect } from 'vitest';
import { HealthMonitor } from '../health-monitor.js';

describe('HealthMonitor', () => {
  it('exports HealthMonitor class', () => {
    expect(HealthMonitor).toBeDefined();
  });

  it('records a healthy check', () => {
    const monitor = new HealthMonitor();
    const status = monitor.recordHealthCheck('agent-1', true, 50);
    expect(status.agentId).toBe('agent-1');
    expect(status.healthy).toBe(true);
    expect(status.consecutiveFailures).toBe(0);
  });

  it('tracks consecutive failures', () => {
    const monitor = new HealthMonitor();
    monitor.recordHealthCheck('agent-1', false, 100);
    const status = monitor.recordHealthCheck('agent-1', false, 100);
    expect(status.consecutiveFailures).toBe(2);
  });

  it('resets failures on healthy check', () => {
    const monitor = new HealthMonitor();
    monitor.recordHealthCheck('agent-1', false, 100);
    monitor.recordHealthCheck('agent-1', false, 100);
    const status = monitor.recordHealthCheck('agent-1', true, 50);
    expect(status.consecutiveFailures).toBe(0);
  });

  it('reports unhealthy agents', () => {
    const monitor = new HealthMonitor();
    monitor.recordHealthCheck('agent-1', false, 100);
    const unhealthy = monitor.getUnhealthyAgents();
    expect(unhealthy.length).toBeGreaterThan(0);
  });

  it('checks agent health status', () => {
    const monitor = new HealthMonitor();
    expect(monitor.isHealthy('unknown')).toBe(false);
    monitor.recordHealthCheck('agent-1', true, 50);
    expect(monitor.isHealthy('agent-1')).toBe(true);
  });
});
