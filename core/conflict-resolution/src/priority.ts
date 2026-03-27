/**
 * 8-Level Priority Hierarchy (REQ-CONFL-002).
 *
 * Incident > Governance > Schema > Quality > Pipeline > Migration > Cost > Others
 */

export const AGENT_PRIORITY: Record<string, number> = {
  'dw-incidents': 1,
  'dw-governance': 2,
  'dw-schema': 3,
  'dw-quality': 4,
  'dw-pipelines': 5,
  'dw-context-catalog': 6,
  'dw-usage-intelligence': 6,
  'dw-orchestrator': 0, // Orchestrator has highest implicit priority
};

export class PriorityResolver {
  /**
   * Determine which agent wins a resource conflict.
   * Lower number = higher priority.
   */
  resolve(agentA: string, agentB: string): string {
    const prioA = AGENT_PRIORITY[agentA] ?? 99;
    const prioB = AGENT_PRIORITY[agentB] ?? 99;
    return prioA <= prioB ? agentA : agentB;
  }

  /**
   * Check if an agent can preempt another's lock.
   */
  canPreempt(requester: string, holder: string): boolean {
    const reqPrio = AGENT_PRIORITY[requester] ?? 99;
    const holdPrio = AGENT_PRIORITY[holder] ?? 99;
    return reqPrio < holdPrio;
  }

  /**
   * Get priority level for an agent (lower = higher priority).
   */
  getPriority(agentId: string): number {
    return AGENT_PRIORITY[agentId] ?? 99;
  }
}
