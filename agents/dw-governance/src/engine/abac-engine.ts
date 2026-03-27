/**
 * ABAC Engine — Attribute-Based Access Control.
 *
 * Evaluates access based on user attributes, resource attributes,
 * and environmental conditions. Supplements the existing RBAC engine.
 */

import type { ABACPolicy, ABACContext, ABACEvaluation } from '../types.js';

/**
 * Match a single attribute condition against a context value.
 * Supports exact match and array-of-allowed-values.
 */
function matchAttribute(
  condition: string | string[],
  actual: string | undefined,
): boolean {
  if (actual === undefined) return false;
  if (typeof condition === 'string') {
    return condition === '*' || condition.toLowerCase() === actual.toLowerCase();
  }
  return condition.some((c) => c === '*' || c.toLowerCase() === actual.toLowerCase());
}

/**
 * Check if all attribute conditions are satisfied by the context.
 */
function matchAttributes(
  conditions: Record<string, string | string[]>,
  context: Record<string, string>,
): boolean {
  for (const [key, required] of Object.entries(conditions)) {
    if (!matchAttribute(required, context[key])) {
      return false;
    }
  }
  return true;
}

export class ABACEngine {
  private policies: ABACPolicy[] = [];

  /** Add an ABAC policy. */
  addPolicy(policy: ABACPolicy): void {
    this.policies.push(policy);
  }

  /** Remove an ABAC policy by ID. */
  removePolicy(policyId: string): boolean {
    const idx = this.policies.findIndex((p) => p.id === policyId);
    if (idx === -1) return false;
    this.policies.splice(idx, 1);
    return true;
  }

  /** List policies for a customer. */
  listPolicies(customerId: string): ABACPolicy[] {
    return this.policies
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate access using ABAC policies.
   * Policies are sorted by priority descending; the first match wins.
   */
  evaluate(customerId: string, context: ABACContext): ABACEvaluation {
    const applicable = this.listPolicies(customerId);

    const matched: ABACPolicy[] = [];

    for (const policy of applicable) {
      const userMatch = matchAttributes(policy.userAttributes, context.userAttributes);
      const resourceMatch = matchAttributes(policy.resourceAttributes, context.resourceAttributes);
      const envMatch = !policy.environmentConditions ||
        !context.environmentConditions ||
        matchAttributes(policy.environmentConditions, context.environmentConditions);

      if (userMatch && resourceMatch && envMatch) {
        matched.push(policy);
      }
    }

    if (matched.length === 0) {
      return {
        allowed: false,
        action: 'deny',
        matchedPolicy: null,
        allMatched: [],
        reason: 'No matching ABAC policy — default deny',
      };
    }

    const winner = matched[0];
    return {
      allowed: winner.action === 'allow',
      action: winner.action,
      matchedPolicy: winner,
      allMatched: matched,
      reason: `${winner.action === 'allow' ? 'Allowed' : winner.action === 'deny' ? 'Denied' : 'Review required'} by ABAC policy: ${winner.name}`,
    };
  }
}
