/**
 * @data-workers/orchestrator
 *
 * Swarm orchestration for API-mode deployments.
 * In Claude Code mode, Claude itself orchestrates.
 * This module provides equivalent coordination for API mode.
 *
 * REQ-ORCH-001 through 005, REQ-ARCH-004/006/007/008.
 */

export { TaskScheduler } from './task-scheduler.js';
export type { ScheduledTask, SchedulerConfig } from './task-scheduler.js';
export { AgentRegistry } from './agent-registry.js';
export type { RegisteredAgent, AgentRegistryConfig } from './agent-registry.js';
export { HealthMonitor } from './health-monitor.js';
export type { AgentHealthStatus } from './health-monitor.js';
export { DependencyDiscoverer } from './dependency-discoverer.js';
export type { DataDependency } from './dependency-discoverer.js';
