/**
 * Agent Registry (REQ-ORCH-005, REQ-ARCH-006, REQ-ARCH-007).
 *
 * Tracks all agent instances, versions, operational status,
 * and per-tenant configuration.
 */

export interface RegisteredAgent {
  agentId: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'degraded' | 'suspended';
  mcpEndpoint: string;
  toolCount: number;
  registeredAt: number;
  lastHealthCheck: number;
  tenantConfig: Map<string, { enabled: boolean; autonomyLevel: string }>;
}

export interface AgentRegistryConfig {
  healthCheckIntervalMs: number;
}

export class AgentRegistry {
  private agents = new Map<string, RegisteredAgent>();

  register(agent: Omit<RegisteredAgent, 'registeredAt' | 'lastHealthCheck' | 'tenantConfig'>): RegisteredAgent {
    const registered: RegisteredAgent = {
      ...agent,
      registeredAt: Date.now(),
      lastHealthCheck: Date.now(),
      tenantConfig: new Map(),
    };
    this.agents.set(agent.agentId, registered);
    return registered;
  }

  setTenantConfig(agentId: string, customerId: string, enabled: boolean, autonomyLevel = 'semi-autonomous'): void {
    const agent = this.agents.get(agentId);
    if (agent) agent.tenantConfig.set(customerId, { enabled, autonomyLevel });
  }

  isEnabledForTenant(agentId: string, customerId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    return agent.tenantConfig.get(customerId)?.enabled ?? true;
  }

  getAgent(agentId: string): RegisteredAgent | undefined { return this.agents.get(agentId); }
  listAgents(): RegisteredAgent[] { return Array.from(this.agents.values()); }
  listActiveAgents(): RegisteredAgent[] { return this.listAgents().filter((a) => a.status === 'active'); }
}
