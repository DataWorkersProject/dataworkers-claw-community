/**
 * Type definitions for the dw-orchestration internal service.
 */

export type TaskPriority = 0 | 1 | 2 | 3;
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';
export type AgentStatus = 'active' | 'inactive' | 'draining';

export interface ScheduledTask {
  id: string;
  priority: TaskPriority;
  agentName: string;
  payload: Record<string, unknown>;
  customerId: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  status: TaskStatus;
}

export interface AgentInstance {
  name: string;
  status: AgentStatus;
  lastHeartbeat: number;
  capabilities: string[];
  tenantConfig: Record<string, boolean>;
}

export interface HeartbeatStatus {
  agentName: string;
  alive: boolean;
  lastSeen: number;
  missedBeats: number;
}

export interface EventRoute {
  sourceEvent: string;
  targetAgents: string[];
  traceId: string;
}
