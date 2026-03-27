/**
 * Message bus subscriptions for the governance agent.
 *
 * Message bus integration for governance events.
 * Subscribe to dataset_discovered, auto-trigger scan_pii.
 * Subscribe to schema_change_detected, evaluate compliance.
 */

import type { IMessageBus, MessageBusEvent } from '@data-workers/infrastructure-stubs';
import type { PIIScanner } from './pii-scanner.js';
import type { PolicyStore } from './policy-store.js';

/** Topics this agent subscribes to. */
export const GOVERNANCE_TOPICS = {
  /** Emitted by catalog agent when a new dataset is discovered. */
  DATASET_DISCOVERED: 'dataset_discovered',
  /** Emitted by schema agent when a schema change is detected. */
  SCHEMA_CHANGE_DETECTED: 'schema_change_detected',
  /** Published by governance agent for governance events. */
  GOVERNANCE_EVENTS: 'governance_events',
} as const;

/**
 * Wire up all governance event subscriptions.
 *
 * @param messageBus - The shared message bus instance.
 * @param piiScanner - PII scanner for auto-triggered scans.
 * @param policyStore - Policy store for compliance evaluation.
 */
export async function setupGovernanceSubscriptions(
  messageBus: IMessageBus,
  piiScanner: PIIScanner,
  policyStore: PolicyStore,
): Promise<void> {
  // ── Auto-trigger PII scan on dataset_discovered ──────
  await messageBus.subscribe(GOVERNANCE_TOPICS.DATASET_DISCOVERED, async (event: MessageBusEvent) => {
    const datasetId = event.payload.datasetId as string;
    const customerId = event.customerId;

    if (!datasetId) return;

    try {
      const scanResult = await piiScanner.scan(customerId, datasetId);

      // Publish PII detection results as a governance event
      if (scanResult.piiColumnsFound > 0) {
        await messageBus.publish(GOVERNANCE_TOPICS.GOVERNANCE_EVENTS, {
          id: `gov-pii-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'governance_pii_detected',
          payload: {
            datasetId,
            piiColumnsFound: scanResult.piiColumnsFound,
            detectionCount: scanResult.detections.length,
            scanTimeMs: scanResult.scanTimeMs,
          },
          timestamp: Date.now(),
          customerId,
        });
      }
    } catch {
      // Non-fatal: log and continue
    }
  });

  // ── Evaluate compliance on schema_change_detected ────
  await messageBus.subscribe(GOVERNANCE_TOPICS.SCHEMA_CHANGE_DETECTED, async (event: MessageBusEvent) => {
    const resource = event.payload.resource as string;
    const customerId = event.customerId;
    const changeType = (event.payload.changeType as string) ?? 'ALTER';

    if (!resource) return;

    try {
      const evaluation = await policyStore.evaluateAccess(
        changeType,
        resource,
        'dw-schema',
        customerId,
      );

      // Publish compliance evaluation result
      await messageBus.publish(GOVERNANCE_TOPICS.GOVERNANCE_EVENTS, {
        id: `gov-compliance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'governance_compliance_evaluated',
        payload: {
          resource,
          changeType,
          allowed: evaluation.allowed,
          action: evaluation.action,
          reason: evaluation.reason,
          matchedPolicy: evaluation.matchedPolicy?.name ?? null,
        },
        timestamp: Date.now(),
        customerId,
      });
    } catch {
      // Non-fatal: log and continue
    }
  });
}

/**
 * Publish a governance event to the message bus.
 */
export async function publishGovernanceEvent(
  messageBus: IMessageBus,
  type: string,
  payload: Record<string, unknown>,
  customerId: string,
): Promise<void> {
  await messageBus.publish(GOVERNANCE_TOPICS.GOVERNANCE_EVENTS, {
    id: `gov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    timestamp: Date.now(),
    customerId,
  });
}
