/**
 * Shared backend instances for the dw-governance agent.
 *
 * Initializes and seeds the infrastructure stubs so all tools
 * share the same in-memory state. Provides:
 * - PolicyStore: governance policies backed by InMemoryRelationalStore
 * - PIIScanner: 3-pass PII detection over relational data
 * - InMemoryRelationalStore: test tables with PII in values
 * - IMessageBus: event bus for cross-agent governance events
 * - ILLMClient: LLM client for PII Pass 3
 * - IKeyValueStore: configurable patterns + policy caching (, )
 * - RbacEngine: RBAC with KV persistence + tenant isolation
 * - AuditEngine: audit reports from activity log data
 * - AccessProvisioningEngine: policy-gated access grants with persistence
 * - ActivityLog helper for cross-tool audit trail
 */

import {
  InMemoryRelationalStore,
  createRelationalStore,
  createMessageBus,
  createLLMClient,
  createKeyValueStore,
} from '@data-workers/infrastructure-stubs';
import { PolicyStore } from './policy-store.js';
import { PIIScanner } from './pii-scanner.js';
import { RbacEngine } from './engine/rbac-engine.js';
import { AuditEngine } from './engine/audit-engine.js';
import { AccessProvisioningEngine } from './engine/access-provisioning.js';

/** Relational store shared across policy store and data tables. */
export const relationalStore = await createRelationalStore();

/** Message bus for governance events. */
export const messageBus = await createMessageBus();

/** LLM client for PII Pass 3 classification. */
export const llmClient = await createLLMClient();

/** Key-value store for configurable patterns + policy caching (, ). */
export const kvStore = await createKeyValueStore();

// ── Create and seed policy store ────────────────────────────────────
if (relationalStore instanceof InMemoryRelationalStore) {
  await relationalStore.createTable('policies');
}

export const policyStore = new PolicyStore(relationalStore);

if (relationalStore instanceof InMemoryRelationalStore) {
  policyStore.seed();

  // ── Seed test data tables with PII in VALUES ────────────────────────

  await relationalStore.createTable('customer_notes');
  await relationalStore.insert('customer_notes', {
    id: 1,
    customer_name: 'John Doe',
    notes: 'Contact at john.doe@email.com for billing',
    status: 'active',
  });
  await relationalStore.insert('customer_notes', {
    id: 2,
    customer_name: 'Jane Smith',
    notes: 'Phone: 555-123-4567, SSN: 123-45-6789',
    status: 'active',
  });
  await relationalStore.insert('customer_notes', {
    id: 3,
    customer_name: 'Bob Wilson',
    notes: 'Shipped to 123 Main St, Anytown USA',
    status: 'inactive',
  });

  await relationalStore.createTable('payments');
  await relationalStore.insert('payments', {
    id: 1,
    amount: 99.99,
    card_number: '4111-1111-1111-1111',
    ip_address: '192.168.1.100',
  });
  await relationalStore.insert('payments', {
    id: 2,
    amount: 49.50,
    card_number: '5500-0000-0000-0004',
    ip_address: '10.0.0.1',
  });

  // ── Seed additional test data for test-customer-1 ────────
  await relationalStore.createTable('customers');
  await relationalStore.insert('customers', {
    id: 1,
    customer_name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '555-987-6543',
    ssn: '987-65-4321',
    status: 'active',
    customerId: 'test-customer-1',
  });
  await relationalStore.insert('customers', {
    id: 2,
    customer_name: 'Bob Martinez',
    email: 'bob.martinez@company.com',
    phone: '555-111-2222',
    address: '456 Oak Ave, Springfield IL',
    status: 'active',
    customerId: 'test-customer-1',
  });

  // ── Seed governance review requests table ─────────────────────────
  await relationalStore.createTable('governance_reviews');

  // ── Seed ABAC policies table ────────────────────────────
  await relationalStore.createTable('abac_policies');

  // ── Seed OPA policies table ─────────────────────────────
  await relationalStore.createTable('opa_policies');

  // ── Activity log table for audit engine ──────────────────
  await relationalStore.createTable('activity_log');

  // ── Access grants table for provisioning persistence ─────
  await relationalStore.createTable('access_grants');
}

// ── PII scanner wired to the same relational store + LLM ──
export const piiScanner = new PIIScanner(relationalStore, llmClient, kvStore);

// ── Engine singletons ─────────────────────────────────────

/** RBAC engine with KV persistence for role assignments. */
export const rbacEngine = new RbacEngine();
rbacEngine.setKvStore(kvStore);

/** Audit engine wired to relational store for activity log data. */
export const auditEngine = new AuditEngine();
auditEngine.setRelationalStore(relationalStore);

/** Access provisioning engine with policy checks + persistence. */
export const accessProvisioningEngine = new AccessProvisioningEngine();
accessProvisioningEngine.setPolicyStore(policyStore);
accessProvisioningEngine.setRelationalStore(relationalStore);

// ── Activity log helper with SHA-256 hash chain (/) ───

import { createHash } from 'crypto';

/** Last hash in the chain — used to link new entries. */
let lastActivityHash = '';

/**
 * Log a tool action to the activity_log table with a SHA-256 hash chain
 * for tamper-evident audit trail. Each entry's hash = SHA-256(content + previousHash).
 * Non-fatal: silently catches errors if the table doesn't exist.
 */
export async function logActivity(entry: {
  customerId: string;
  action: string;
  actor: string;
  resource: string;
  result: string;
  policyRef?: string;
}): Promise<void> {
  try {
    const timestamp = Date.now();
    const id = `act-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
    const previousHash = lastActivityHash;

    // Compute SHA-256 hash of content + previousHash
    const content = `${id}|${timestamp}|${entry.actor}|${entry.action}|${entry.resource}|${entry.result}|${previousHash}`;
    const hash = createHash('sha256').update(content).digest('hex');

    lastActivityHash = hash;

    await relationalStore.insert('activity_log', {
      id,
      timestamp,
      actor: entry.actor,
      actorType: 'agent',
      action: entry.action,
      resource: entry.resource,
      result: entry.result,
      customerId: entry.customerId,
      policyRef: entry.policyRef,
      hash,
      previousHash,
    });
  } catch {
    // Non-fatal — don't break tool execution if logging fails
  }
}
