/**
 * Health Monitor (REQ-ORCH-002, REQ-ORCH-003).
 *
 * <5s failure detection, <30s task redistribution.
 */

export interface AgentHealthStatus {
  agentId: string;
  healthy: boolean;
  lastCheck: number;
  latencyMs: number;
  consecutiveFailures: number;
}

export class HealthMonitor {
  private statuses = new Map<string, AgentHealthStatus>();
  private failureThreshold: number;

  constructor(failureThreshold = 3) {
    this.failureThreshold = failureThreshold;
  }

  recordHealthCheck(agentId: string, healthy: boolean, latencyMs: number): AgentHealthStatus {
    const existing = this.statuses.get(agentId);
    const status: AgentHealthStatus = {
      agentId,
      healthy,
      lastCheck: Date.now(),
      latencyMs,
      consecutiveFailures: healthy ? 0 : (existing?.consecutiveFailures ?? 0) + 1,
    };
    this.statuses.set(agentId, status);
    return status;
  }

  isHealthy(agentId: string): boolean {
    const status = this.statuses.get(agentId);
    return status ? status.healthy && status.consecutiveFailures < this.failureThreshold : false;
  }

  getUnhealthyAgents(): AgentHealthStatus[] {
    return Array.from(this.statuses.values()).filter((s) => !s.healthy || s.consecutiveFailures >= this.failureThreshold);
  }

  getStatus(agentId: string): AgentHealthStatus | undefined { return this.statuses.get(agentId); }
}
