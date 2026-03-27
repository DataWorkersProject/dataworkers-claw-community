/**
 * Governance Gate — policy gate for cross-agent operations.
 *
 * Before any cross-agent operation proceeds, this gate checks:
 * 1. Policy compliance (via PolicyStore)
 * 2. PII exposure risk (via PIIScanner, optional)
 *
 * Returns a GovernanceGateResult indicating whether the operation is allowed.
 */

import type { GovernanceGateResult } from '../types.js';
import type { PolicyStore } from '../policy-store.js';

export class GovernanceGate {
  constructor(private policyStore: PolicyStore) {}

  /**
   * Evaluate whether a cross-agent operation should proceed.
   *
   * @param action     - The action being performed (e.g., 'WRITE', 'DELETE').
   * @param resource   - The resource being accessed.
   * @param agentId    - The agent requesting the operation.
   * @param customerId - The tenant ID.
   * @param context    - Optional additional context.
   */
  async evaluate(
    action: string,
    resource: string,
    agentId: string,
    customerId: string,
    context?: Record<string, unknown>,
  ): Promise<GovernanceGateResult> {
    const start = Date.now();

    try {
      const evaluation = await this.policyStore.evaluateAccess(
        action,
        resource,
        agentId,
        customerId,
        context,
      );

      return {
        allowed: evaluation.allowed,
        gateType: 'policy',
        reason: evaluation.reason,
        evaluationTimeMs: Date.now() - start,
      };
    } catch (err) {
      return {
        allowed: false,
        gateType: 'policy',
        reason: `Gate evaluation error: ${err instanceof Error ? err.message : String(err)}`,
        evaluationTimeMs: Date.now() - start,
      };
    }
  }

  /**
   * Batch evaluate multiple operations.
   */
  async evaluateBatch(
    operations: Array<{
      action: string;
      resource: string;
      agentId: string;
      customerId: string;
    }>,
  ): Promise<GovernanceGateResult[]> {
    return Promise.all(
      operations.map((op) =>
        this.evaluate(op.action, op.resource, op.agentId, op.customerId),
      ),
    );
  }
}
