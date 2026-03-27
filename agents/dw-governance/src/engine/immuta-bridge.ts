/**
 * Immuta Integration Bridge — stub for platform-native policy enforcement.
 *
 * Provides an abstraction layer for Immuta-style policy enforcement,
 * translating governance policies into Immuta-compatible format.
 */

import type { GovernancePolicy, PolicyAction } from '../types.js';

/** Immuta-style policy representation. */
export interface ImmutaPolicy {
  id: string;
  name: string;
  type: 'subscription' | 'data' | 'global';
  action: 'MASK' | 'DENY' | 'ALLOW' | 'REDACT';
  dataSource: string;
  conditions: Record<string, unknown>;
  enforcement: 'platform' | 'proxy';
}

/** Result of syncing a policy to Immuta. */
export interface ImmutaSyncResult {
  policyId: string;
  immutaPolicyId: string;
  synced: boolean;
  error?: string;
}

/** Map governance action to Immuta action. */
function mapAction(action: PolicyAction): ImmutaPolicy['action'] {
  switch (action) {
    case 'allow': return 'ALLOW';
    case 'deny': return 'DENY';
    case 'review': return 'MASK';
  }
}

/**
 * Stub Immuta integration bridge.
 * In production, this would call Immuta REST APIs.
 */
export class ImmutaBridge {
  private synced: Map<string, ImmutaPolicy> = new Map();
  private connected = false;

  /** Simulate connecting to an Immuta instance. */
  connect(config: { host: string; apiKey: string }): boolean {
    // Stub: always succeeds if host and apiKey are provided
    if (config.host && config.apiKey) {
      this.connected = true;
      return true;
    }
    return false;
  }

  /** Check connection status. */
  isConnected(): boolean {
    return this.connected;
  }

  /** Translate a governance policy to Immuta format. */
  translatePolicy(policy: GovernancePolicy): ImmutaPolicy {
    return {
      id: `immuta-${policy.id}`,
      name: policy.name,
      type: policy.resource.includes('pii') || policy.resource.includes('credit_card')
        ? 'data'
        : policy.resource === '*'
          ? 'global'
          : 'subscription',
      action: mapAction(policy.action),
      dataSource: policy.resource,
      conditions: { ...policy.conditions },
      enforcement: 'platform',
    };
  }

  /** Sync a governance policy to Immuta (stub). */
  syncPolicy(policy: GovernancePolicy): ImmutaSyncResult {
    if (!this.connected) {
      return {
        policyId: policy.id,
        immutaPolicyId: '',
        synced: false,
        error: 'Not connected to Immuta',
      };
    }

    const immutaPolicy = this.translatePolicy(policy);
    this.synced.set(immutaPolicy.id, immutaPolicy);

    return {
      policyId: policy.id,
      immutaPolicyId: immutaPolicy.id,
      synced: true,
    };
  }

  /** Get all synced policies. */
  getSyncedPolicies(): ImmutaPolicy[] {
    return Array.from(this.synced.values());
  }

  /** Remove a synced policy. */
  removeSyncedPolicy(policyId: string): boolean {
    return this.synced.delete(`immuta-${policyId}`);
  }
}
