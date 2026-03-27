/**
 * dw-orchestration — Internal Orchestration Service
 *
 * Provides swarm scheduling, heartbeat monitoring, agent registry,
 * and cross-agent event choreography. This is an internal service,
 * NOT an MCP agent — it exposes TypeScript APIs, not MCP tools.
 *
 * Components:
 * - TaskScheduler: Priority queue with P0-P3 levels and starvation prevention
 * - HeartbeatMonitor: 5s interval, 15s TTL health monitoring
 * - AgentRegistry: CRUD with per-tenant enable/disable
 * - EventChoreographer: Cross-agent event routing with trace IDs
 */

export { TaskScheduler } from './task-scheduler.js';
export { HeartbeatMonitor } from './heartbeat-monitor.js';
export { AgentRegistry } from './agent-registry.js';
export { EventChoreographer } from './event-choreographer.js';
export { OrchestrationService } from './orchestration-service.js';

export { kvStore, relationalStore, messageBus } from './backends.js';

export type {
  ScheduledTask,
  TaskPriority,
  TaskStatus,
  AgentInstance,
  AgentStatus,
  HeartbeatStatus,
  EventRoute,
} from './types.js';
