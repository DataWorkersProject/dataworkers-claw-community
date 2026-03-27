/**
 * Agent Identity Tracker — dedicated agent identity audit trail.
 *
 * Tracks autonomous agent operations with full identity context,
 * distinguishing human vs agent vs delegated actions.
 */

import type { ActorType, AgentIdentityRecord, AgentActionRecord } from '../types.js';

export class AgentIdentityTracker {
  private identities: Map<string, AgentIdentityRecord> = new Map();

  /** Register an agent identity. */
  registerAgent(params: {
    agentId: string;
    actorType: ActorType;
    permissions: string[];
    delegatedBy?: string;
  }): AgentIdentityRecord {
    const record: AgentIdentityRecord = {
      agentId: params.agentId,
      actorType: params.actorType,
      delegatedBy: params.delegatedBy,
      delegatedAt: params.actorType === 'delegated' ? Date.now() : undefined,
      permissions: params.permissions,
      actions: [],
    };
    this.identities.set(params.agentId, record);
    return record;
  }

  /** Record an action performed by an agent. */
  recordAction(agentId: string, action: Omit<AgentActionRecord, 'actorType' | 'delegatedBy'>): AgentActionRecord | null {
    const identity = this.identities.get(agentId);
    if (!identity) return null;

    const record: AgentActionRecord = {
      ...action,
      actorType: identity.actorType,
      delegatedBy: identity.delegatedBy,
    };
    identity.actions.push(record);
    return record;
  }

  /** Get all actions for an agent. */
  getActions(agentId: string): AgentActionRecord[] {
    return this.identities.get(agentId)?.actions ?? [];
  }

  /** Get identity record for an agent. */
  getIdentity(agentId: string): AgentIdentityRecord | undefined {
    return this.identities.get(agentId);
  }

  /** Get all actions across all agents, optionally filtered by actor type. */
  getAuditTrail(actorType?: ActorType): AgentActionRecord[] {
    const all: AgentActionRecord[] = [];
    for (const identity of this.identities.values()) {
      for (const action of identity.actions) {
        if (!actorType || action.actorType === actorType) {
          all.push(action);
        }
      }
    }
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Get all registered agent IDs. */
  listAgents(): string[] {
    return Array.from(this.identities.keys());
  }

  /** Check if an agent has a specific permission. */
  hasPermission(agentId: string, permission: string): boolean {
    const identity = this.identities.get(agentId);
    if (!identity) return false;
    return identity.permissions.includes(permission) || identity.permissions.includes('*');
  }
}
