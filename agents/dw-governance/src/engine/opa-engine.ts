/**
 * OPA Engine — Open Policy Agent compatibility layer.
 *
 * Provides a lightweight Rego policy evaluation engine.
 * In production, this would delegate to an OPA sidecar or server.
 * The in-memory implementation parses simple Rego rules for testing.
 */

import type { OPAPolicy, OPAEvaluationResult } from '../types.js';

/**
 * Simple Rego rule evaluator.
 * Supports basic `default allow = false` and `allow { ... }` patterns.
 * This is a compatibility shim — production deployments should use real OPA.
 */
function evaluateSimpleRego(
  rego: string,
  input: Record<string, unknown>,
): boolean {
  // Check for explicit deny patterns
  if (rego.includes('default allow = false')) {
    // Look for allow conditions
    const allowMatch = rego.match(/allow\s*\{([^}]+)\}/);
    if (!allowMatch) return false;

    const conditions = allowMatch[1].trim();
    // Parse simple conditions like: input.action == "read"
    const conditionLines = conditions.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of conditionLines) {
      const eqMatch = line.match(/input\.(\w+)\s*==\s*"([^"]+)"/);
      if (eqMatch) {
        const [, field, expected] = eqMatch;
        if (String(input[field]) !== expected) return false;
      }
      const neqMatch = line.match(/input\.(\w+)\s*!=\s*"([^"]+)"/);
      if (neqMatch) {
        const [, field, expected] = neqMatch;
        if (String(input[field]) === expected) return false;
      }
    }
    return true;
  }

  // Default: if "default allow = true", allow unless deny matches
  if (rego.includes('default allow = true')) {
    const denyMatch = rego.match(/deny\s*\{([^}]+)\}/);
    if (!denyMatch) return true;

    const conditions = denyMatch[1].trim();
    const conditionLines = conditions.split('\n').map((l) => l.trim()).filter(Boolean);
    let allMatch = true;

    for (const line of conditionLines) {
      const eqMatch = line.match(/input\.(\w+)\s*==\s*"([^"]+)"/);
      if (eqMatch) {
        const [, field, expected] = eqMatch;
        if (String(input[field]) !== expected) { allMatch = false; break; }
      }
    }
    return !allMatch; // deny matched means not allowed
  }

  return false;
}

export class OPAEngine {
  private policies: OPAPolicy[] = [];

  /** Register an OPA policy. */
  addPolicy(policy: OPAPolicy): void {
    this.policies.push(policy);
  }

  /** Remove an OPA policy by ID. */
  removePolicy(policyId: string): boolean {
    const idx = this.policies.findIndex((p) => p.id === policyId);
    if (idx === -1) return false;
    this.policies.splice(idx, 1);
    return true;
  }

  /** List OPA policies for a customer. */
  listPolicies(customerId: string): OPAPolicy[] {
    return this.policies.filter((p) => p.customerId === customerId);
  }

  /**
   * Evaluate input against registered OPA policies for a customer.
   * Returns the first policy result (all policies must agree for allow).
   */
  evaluate(
    customerId: string,
    input: Record<string, unknown>,
  ): OPAEvaluationResult {
    const start = Date.now();
    const policies = this.listPolicies(customerId);

    if (policies.length === 0) {
      return {
        allowed: false,
        reason: 'No OPA policies registered',
        policyId: '',
        evaluationTimeMs: Date.now() - start,
      };
    }

    for (const policy of policies) {
      const allowed = evaluateSimpleRego(policy.rego, input);
      if (!allowed) {
        return {
          allowed: false,
          reason: `Denied by OPA policy: ${policy.name}`,
          policyId: policy.id,
          evaluationTimeMs: Date.now() - start,
        };
      }
    }

    return {
      allowed: true,
      reason: `Allowed by ${policies.length} OPA policies`,
      policyId: policies[0].id,
      evaluationTimeMs: Date.now() - start,
    };
  }
}
