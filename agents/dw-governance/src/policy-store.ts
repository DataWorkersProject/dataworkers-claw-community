/**
 * PolicyStore — CRUD operations over governance policies backed by
 * an InMemoryRelationalStore (simulating PostgreSQL).
 *
 * Policies are matched using glob-style patterns on the resource field
 * (`*` matches any substring) and evaluated in priority-descending order.
 */

import type { IRelationalStore } from '@data-workers/infrastructure-stubs';
import type { GovernancePolicy, PolicyAction, AccessRequestContext } from './types.js';

/** Simple glob matcher: `*` matches any substring. */
function globMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
  return regex.test(value);
}

export interface PolicyEvaluation {
  allowed: boolean;
  action: PolicyAction;
  matchedPolicy: GovernancePolicy | null;
  allMatched: GovernancePolicy[];
  reason: string;
  /** P5: Access request context used during evaluation */
  accessContext?: AccessRequestContext;
}

export class PolicyStore {
  constructor(private store: IRelationalStore) {}

  /** Insert a policy into the relational store. */
  async addPolicy(policy: GovernancePolicy): Promise<void> {
    await this.store.insert('policies', { ...policy } as unknown as Record<string, unknown>);
  }

  /**
   * Return policies matching the given action, resource, and tenant,
   * sorted by priority descending (highest first).
   */
  async getMatchingPolicies(
    action: string,
    resource: string,
    customerId: string,
  ): Promise<GovernancePolicy[]> {
    const rows = await this.store.query(
      'policies',
      (row) => row['customerId'] === customerId,
      { column: 'priority', direction: 'desc' },
    );

    return (rows as unknown as GovernancePolicy[]).filter((p) => {
      const resourceMatches = globMatch(p.resource, resource);
      const actionMatches =
        p.conditions.actions.includes('*') ||
        p.conditions.actions.some((a) => a.toLowerCase() === action.toLowerCase());
      return resourceMatches && actionMatches;
    });
  }

  /**
   * Two-pass (deny-first) policy evaluation on priority-sorted policies:
   *
   * Pass 1 — Walk policies by priority DESC. At each priority level,
   *          if a deny exists it wins over any allow/review at the same
   *          priority. The highest-priority decision takes effect.
   * Pass 2 — If no deny was found at the top priority, continue to
   *          evaluate allow/review policies. Allow policies may declare
   *          `requiredContext`; if present, every key/value pair must
   *          match the caller-supplied context.
   *
   * Default: deny if no matching allow rule is found.
   */
  async evaluateAccess(
    action: string,
    resource: string,
    agentId: string,
    customerId: string,
    context?: Record<string, unknown>,
    accessContext?: AccessRequestContext,
  ): Promise<PolicyEvaluation> {
    const matched = await this.getMatchingPolicies(action, resource, customerId);
    const mergedContext = { ...context, ...accessContext };

    const applicable = matched.filter((p) => {
      if (p.conditions.agentIds && p.conditions.agentIds.length > 0) {
        return p.conditions.agentIds.includes(agentId) || p.conditions.agentIds.includes('*');
      }
      return true;
    });

    if (applicable.length === 0) {
      return {
        allowed: false,
        action: 'deny',
        matchedPolicy: null,
        allMatched: [],
        reason: 'No matching policy found — default deny',
        accessContext,
      };
    }

    // ── Pass 1: Group by priority, deny-first at each level ───────────
    // Policies are already sorted by priority DESC from getMatchingPolicies.
    // At the highest priority level, if any deny exists it wins.
    const topPriority = applicable[0].priority;
    const topPolicies = applicable.filter((p) => p.priority === topPriority);

    // Check for deny at top priority first
    const topDeny = topPolicies.find((p) => p.action === 'deny');
    if (topDeny) {
      return {
        allowed: false,
        action: 'deny',
        matchedPolicy: topDeny,
        allMatched: applicable,
        reason: `Denied by policy: ${topDeny.name}`,
        accessContext,
      };
    }

    // ── Pass 2: Walk all policies in priority order ───────────────────
    for (const policy of applicable) {
      if (policy.action === 'deny') {
        return {
          allowed: false,
          action: 'deny',
          matchedPolicy: policy,
          allMatched: applicable,
          reason: `Denied by policy: ${policy.name}`,
          accessContext,
        };
      }
      if (policy.action === 'allow') {
        const policyAny = policy as unknown as Record<string, unknown>;
        const requiredContext = policyAny['requiredContext'] as Record<string, string> | undefined;
        if (requiredContext && mergedContext) {
          const contextSatisfied = Object.entries(requiredContext).every(
            ([key, value]) => mergedContext[key] === value,
          );
          if (!contextSatisfied) continue;
        }
        return {
          allowed: true,
          action: 'allow',
          matchedPolicy: policy,
          allMatched: applicable,
          reason: `Allowed by policy: ${policy.name}`,
          accessContext,
        };
      }
      if (policy.action === 'review') {
        return {
          allowed: false,
          action: 'review',
          matchedPolicy: policy,
          allMatched: applicable,
          reason: `Requires review per policy: ${policy.name}`,
          accessContext,
        };
      }
    }

    return {
      allowed: false,
      action: 'deny',
      matchedPolicy: null,
      allMatched: applicable,
      reason: 'No matching allow rule — default deny',
      accessContext,
    };
  }

  /** List all policies for a tenant. */
  async listPolicies(customerId: string): Promise<GovernancePolicy[]> {
    const rows = await this.store.query(
      'policies',
      (row) => row['customerId'] === customerId,
      { column: 'priority', direction: 'desc' },
    );
    return rows as unknown as GovernancePolicy[];
  }

  /** Remove a policy by ID and tenant. */
  async removePolicy(policyId: string, customerId: string): Promise<boolean> {
    // InMemoryRelationalStore has no delete method, so we rebuild the table.
    const all = await this.store.query('policies');
    await this.store.clear('policies');
    let found = false;
    for (const row of all) {
      if (row['id'] === policyId && row['customerId'] === customerId) {
        found = true;
        continue;
      }
      await this.store.insert('policies', row);
    }
    return found;
  }

  /**
   * Pre-load seed policies for tenant `cust-1`.
   * Provides 8 built-in governance policies.
   */
  seed(): void {
    const tenant = 'cust-1';
    const policies: GovernancePolicy[] = [
      {
        id: 'pol-deny-destructive',
        customerId: tenant,
        name: 'deny_destructive',
        resource: '*',
        action: 'deny',
        conditions: { actions: ['DELETE', 'DROP', 'TRUNCATE'] },
        priority: 100,
      },
      {
        id: 'pol-review-pii-writes',
        customerId: tenant,
        name: 'review_pii_writes',
        resource: '*pii*',
        action: 'review',
        conditions: { actions: ['WRITE', 'UPDATE'] },
        priority: 90,
      },
      {
        id: 'pol-gdpr-delete-right',
        customerId: tenant,
        name: 'gdpr_delete_right',
        resource: '*customer*',
        action: 'allow',
        conditions: { actions: ['DELETE'] },
        priority: 95,
      },
      {
        id: 'pol-soc2-audit-log',
        customerId: tenant,
        name: 'soc2_audit_log',
        resource: '*audit*',
        action: 'review',
        conditions: { actions: ['*'] },
        priority: 85,
      },
      {
        id: 'pol-hipaa-data-access',
        customerId: tenant,
        name: 'hipaa_data_access',
        resource: '*medical*',
        action: 'review',
        conditions: { actions: ['READ', 'WRITE'] },
        priority: 80,
      },
      {
        id: 'pol-pci-card-masking',
        customerId: tenant,
        name: 'pci_card_masking',
        resource: '*credit_card*',
        action: 'deny',
        conditions: { actions: ['SELECT', 'READ'] },
        priority: 75,
      },
      {
        id: 'pol-allow-reads',
        customerId: tenant,
        name: 'allow_reads',
        resource: '*',
        action: 'allow',
        conditions: { actions: ['SELECT', 'READ'] },
        priority: 50,
      },
      {
        id: 'pol-default-deny',
        customerId: tenant,
        name: 'default_deny',
        resource: '*',
        action: 'deny',
        conditions: { actions: ['*'] },
        priority: 1,
      },
    ];

    for (const p of policies) {
      // Use store.insert directly (sync path) instead of async addPolicy
      this.store.insert('policies', { ...p } as unknown as Record<string, unknown>);
    }

    // Seed policies for test-customer-1 (used by eval tests)
    const testTenant = 'test-customer-1';
    const testPolicies: GovernancePolicy[] = [
      {
        id: 'tc1-pol-deny-destructive',
        customerId: testTenant,
        name: 'deny_destructive',
        resource: '*',
        action: 'deny',
        conditions: { actions: ['DELETE', 'DROP', 'TRUNCATE'] },
        priority: 100,
      },
      {
        id: 'tc1-pol-review-pii-writes',
        customerId: testTenant,
        name: 'review_pii_writes',
        resource: '*pii*',
        action: 'review',
        conditions: { actions: ['WRITE', 'UPDATE'] },
        priority: 90,
      },
      {
        id: 'tc1-pol-gdpr-delete-right',
        customerId: testTenant,
        name: 'gdpr_delete_right',
        resource: '*customer*',
        action: 'allow',
        conditions: { actions: ['DELETE'] },
        priority: 95,
      },
      {
        id: 'tc1-pol-allow-reads',
        customerId: testTenant,
        name: 'allow_reads',
        resource: '*',
        action: 'allow',
        conditions: { actions: ['SELECT', 'READ', 'read'] },
        priority: 50,
      },
      {
        id: 'tc1-pol-default-deny',
        customerId: testTenant,
        name: 'default_deny',
        resource: '*',
        action: 'deny',
        conditions: { actions: ['*'] },
        priority: 1,
      },
    ];

    for (const p of testPolicies) {
      this.store.insert('policies', { ...p } as unknown as Record<string, unknown>);
    }
  }
}
