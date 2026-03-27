/**
 * Phase 5 (P5) competitive feature tests for dw-governance.
 *
 * actorType on ActivityLog + policy evaluation
 * JIT ephemeral access
 * Extended context model (forWhom, purpose, dataClassification)
 * Immuta integration bridge
 * Agent-as-identity audit trail
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EphemeralAccessManager } from '../engine/ephemeral-access.js';
import { ImmutaBridge } from '../engine/immuta-bridge.js';
import { AgentIdentityTracker } from '../engine/agent-identity-tracker.js';
import { PolicyStore } from '../policy-store.js';
import { InMemoryRelationalStore } from '@data-workers/infrastructure-stubs';
import type {
  ActivityLog,
  AccessRequestContext,
  GovernancePolicy,
} from '../types.js';

// ── actorType on ActivityLog + policy evaluation ──────────

describe('actorType on ActivityLog', () => {
  it('ActivityLog supports human actorType', () => {
    const log: ActivityLog = {
      id: 'log-1',
      timestamp: Date.now(),
      actor: 'user-1',
      actorType: 'human',
      action: 'READ',
      resource: 'orders_table',
      result: 'allowed',
      customerId: 'cust-1',
    };
    expect(log.actorType).toBe('human');
  });

  it('ActivityLog supports agent actorType', () => {
    const log: ActivityLog = {
      id: 'log-2',
      timestamp: Date.now(),
      actor: 'dw-pipelines',
      actorType: 'agent',
      action: 'WRITE',
      resource: 'staging_table',
      result: 'denied',
      customerId: 'cust-1',
    };
    expect(log.actorType).toBe('agent');
  });

  it('ActivityLog supports delegated actorType', () => {
    const log: ActivityLog = {
      id: 'log-3',
      timestamp: Date.now(),
      actor: 'dw-governance',
      actorType: 'delegated',
      action: 'DELETE',
      resource: 'customer_data',
      result: 'review',
      customerId: 'cust-1',
      metadata: { delegatedBy: 'user-admin' },
    };
    expect(log.actorType).toBe('delegated');
    expect(log.metadata?.delegatedBy).toBe('user-admin');
  });

  it('policy evaluation includes actorType in context', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('policies');
    const policyStore = new PolicyStore(store);

    const policy: GovernancePolicy = {
      id: 'pol-test',
      customerId: 'cust-1',
      name: 'allow_agent_reads',
      resource: '*',
      action: 'allow',
      conditions: { actions: ['READ'] },
      priority: 50,
    };
    await policyStore.addPolicy(policy);

    const result = await policyStore.evaluateAccess(
      'READ',
      'orders_table',
      'dw-pipelines',
      'cust-1',
      { actorType: 'agent' },
    );
    expect(result.allowed).toBe(true);
    expect(result.action).toBe('allow');
  });
});

// ── JIT ephemeral access ──────────────────────────────────

describe('JIT ephemeral access', () => {
  let manager: EphemeralAccessManager;

  beforeEach(() => {
    manager = new EphemeralAccessManager();
  });

  it('creates a time-limited grant', () => {
    const grant = manager.createGrant({
      userId: 'user-1',
      resource: 'sensitive_table',
      accessLevel: 'read',
      taskId: 'task-123',
      durationMs: 60_000,
    });
    expect(grant.id).toBeTruthy();
    expect(grant.userId).toBe('user-1');
    expect(grant.taskId).toBe('task-123');
    expect(grant.revoked).toBe(false);
    expect(grant.expiresAt).toBeGreaterThan(grant.grantedAt);
  });

  it('validates active grant', () => {
    const grant = manager.createGrant({
      userId: 'user-1',
      resource: 'table',
      accessLevel: 'read',
      taskId: 'task-1',
      durationMs: 60_000,
    });
    expect(manager.isValid(grant.id)).toBe(true);
  });

  it('revokes grant on task complete', () => {
    const grant = manager.createGrant({
      userId: 'user-1',
      resource: 'table',
      accessLevel: 'write',
      taskId: 'task-456',
      durationMs: 60_000,
    });
    const count = manager.revokeByTask('task-456');
    expect(count).toBe(1);
    expect(manager.isValid(grant.id)).toBe(false);

    const revoked = manager.getGrant(grant.id)!;
    expect(revoked.revoked).toBe(true);
    expect(revoked.revokeReason).toBe('task_complete');
  });

  it('manually revokes a grant', () => {
    const grant = manager.createGrant({
      userId: 'user-1',
      resource: 'table',
      accessLevel: 'read',
      taskId: 'task-1',
      durationMs: 60_000,
    });
    expect(manager.revokeGrant(grant.id, 'manual')).toBe(true);
    expect(manager.isValid(grant.id)).toBe(false);
  });

  it('returns false for unknown grant ID', () => {
    expect(manager.isValid('nonexistent')).toBe(false);
    expect(manager.revokeGrant('nonexistent', 'manual')).toBe(false);
  });

  it('lists active grants for user', () => {
    manager.createGrant({
      userId: 'user-1',
      resource: 'table-a',
      accessLevel: 'read',
      taskId: 'task-1',
      durationMs: 60_000,
    });
    manager.createGrant({
      userId: 'user-1',
      resource: 'table-b',
      accessLevel: 'write',
      taskId: 'task-2',
      durationMs: 60_000,
    });
    manager.createGrant({
      userId: 'user-2',
      resource: 'table-c',
      accessLevel: 'read',
      taskId: 'task-3',
      durationMs: 60_000,
    });

    const grants = manager.getActiveGrants('user-1');
    expect(grants).toHaveLength(2);
  });

  it('revokes multiple grants for same task', () => {
    manager.createGrant({
      userId: 'user-1',
      resource: 'table-a',
      accessLevel: 'read',
      taskId: 'task-shared',
      durationMs: 60_000,
    });
    manager.createGrant({
      userId: 'user-1',
      resource: 'table-b',
      accessLevel: 'write',
      taskId: 'task-shared',
      durationMs: 60_000,
    });

    const count = manager.revokeByTask('task-shared');
    expect(count).toBe(2);
    expect(manager.getActiveGrants('user-1')).toHaveLength(0);
  });
});

// ── Extended context model ────────────────────────────────

describe('Extended context model', () => {
  it('AccessRequestContext includes forWhom, purpose, dataClassification', () => {
    const ctx: AccessRequestContext = {
      forWhom: 'analytics-team',
      purpose: 'quarterly-report',
      dataClassification: 'confidential',
      actorType: 'human',
    };
    expect(ctx.forWhom).toBe('analytics-team');
    expect(ctx.purpose).toBe('quarterly-report');
    expect(ctx.dataClassification).toBe('confidential');
  });

  it('policy evaluation accepts accessContext parameter', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('policies');
    const policyStore = new PolicyStore(store);

    await policyStore.addPolicy({
      id: 'pol-allow-read',
      customerId: 'cust-1',
      name: 'allow_reads',
      resource: '*',
      action: 'allow',
      conditions: { actions: ['READ'] },
      priority: 50,
    });

    const ctx: AccessRequestContext = {
      forWhom: 'compliance-team',
      purpose: 'audit',
      dataClassification: 'internal',
    };

    const result = await policyStore.evaluateAccess(
      'READ',
      'orders_table',
      'dw-governance',
      'cust-1',
      undefined,
      ctx,
    );
    expect(result.allowed).toBe(true);
    expect(result.accessContext).toEqual(ctx);
  });

  it('accessContext is included even on deny', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('policies');
    const policyStore = new PolicyStore(store);

    const ctx: AccessRequestContext = {
      purpose: 'testing',
      dataClassification: 'restricted',
    };

    const result = await policyStore.evaluateAccess(
      'DELETE',
      'some_table',
      'agent-1',
      'cust-1',
      undefined,
      ctx,
    );
    expect(result.allowed).toBe(false);
    expect(result.accessContext).toEqual(ctx);
  });
});

// ── Immuta integration bridge ─────────────────────────────

describe('Immuta integration bridge', () => {
  let bridge: ImmutaBridge;

  beforeEach(() => {
    bridge = new ImmutaBridge();
  });

  it('connects to Immuta instance', () => {
    expect(bridge.isConnected()).toBe(false);
    const result = bridge.connect({ host: 'https://immuta.example.com', apiKey: 'key-123' });
    expect(result).toBe(true);
    expect(bridge.isConnected()).toBe(true);
  });

  it('fails to connect with missing config', () => {
    const result = bridge.connect({ host: '', apiKey: '' });
    expect(result).toBe(false);
    expect(bridge.isConnected()).toBe(false);
  });

  it('translates governance policy to Immuta format', () => {
    const policy: GovernancePolicy = {
      id: 'pol-pii',
      customerId: 'cust-1',
      name: 'review_pii_writes',
      resource: '*pii*',
      action: 'review',
      conditions: { actions: ['WRITE'] },
      priority: 90,
    };

    const immutaPolicy = bridge.translatePolicy(policy);
    expect(immutaPolicy.id).toBe('immuta-pol-pii');
    expect(immutaPolicy.type).toBe('data');
    expect(immutaPolicy.action).toBe('MASK');
    expect(immutaPolicy.dataSource).toBe('*pii*');
  });

  it('syncs policy when connected', () => {
    bridge.connect({ host: 'https://immuta.example.com', apiKey: 'key-123' });

    const policy: GovernancePolicy = {
      id: 'pol-1',
      customerId: 'cust-1',
      name: 'allow_reads',
      resource: '*',
      action: 'allow',
      conditions: { actions: ['READ'] },
      priority: 50,
    };

    const result = bridge.syncPolicy(policy);
    expect(result.synced).toBe(true);
    expect(result.immutaPolicyId).toBe('immuta-pol-1');
    expect(bridge.getSyncedPolicies()).toHaveLength(1);
  });

  it('fails to sync when not connected', () => {
    const policy: GovernancePolicy = {
      id: 'pol-1',
      customerId: 'cust-1',
      name: 'deny_all',
      resource: '*',
      action: 'deny',
      conditions: { actions: ['*'] },
      priority: 1,
    };

    const result = bridge.syncPolicy(policy);
    expect(result.synced).toBe(false);
    expect(result.error).toContain('Not connected');
  });

  it('removes synced policy', () => {
    bridge.connect({ host: 'https://immuta.example.com', apiKey: 'key-123' });

    const policy: GovernancePolicy = {
      id: 'pol-rm',
      customerId: 'cust-1',
      name: 'temp_policy',
      resource: '*',
      action: 'allow',
      conditions: { actions: ['SELECT'] },
      priority: 10,
    };

    bridge.syncPolicy(policy);
    expect(bridge.getSyncedPolicies()).toHaveLength(1);
    expect(bridge.removeSyncedPolicy('pol-rm')).toBe(true);
    expect(bridge.getSyncedPolicies()).toHaveLength(0);
  });

  it('maps deny action correctly', () => {
    const policy: GovernancePolicy = {
      id: 'pol-deny',
      customerId: 'cust-1',
      name: 'deny_destructive',
      resource: '*',
      action: 'deny',
      conditions: { actions: ['DELETE'] },
      priority: 100,
    };

    const immutaPolicy = bridge.translatePolicy(policy);
    expect(immutaPolicy.action).toBe('DENY');
    expect(immutaPolicy.type).toBe('global');
  });
});

// ── Agent-as-identity audit trail ─────────────────────────

describe('Agent-as-identity audit trail', () => {
  let tracker: AgentIdentityTracker;

  beforeEach(() => {
    tracker = new AgentIdentityTracker();
  });

  it('registers an agent identity', () => {
    const record = tracker.registerAgent({
      agentId: 'dw-pipelines',
      actorType: 'agent',
      permissions: ['READ', 'WRITE'],
    });
    expect(record.agentId).toBe('dw-pipelines');
    expect(record.actorType).toBe('agent');
    expect(record.actions).toHaveLength(0);
  });

  it('registers delegated agent with delegatedBy', () => {
    const record = tracker.registerAgent({
      agentId: 'dw-sub-agent',
      actorType: 'delegated',
      permissions: ['READ'],
      delegatedBy: 'dw-governance',
    });
    expect(record.actorType).toBe('delegated');
    expect(record.delegatedBy).toBe('dw-governance');
    expect(record.delegatedAt).toBeDefined();
  });

  it('records actions for an agent', () => {
    tracker.registerAgent({
      agentId: 'dw-pipelines',
      actorType: 'agent',
      permissions: ['READ'],
    });

    const action = tracker.recordAction('dw-pipelines', {
      timestamp: Date.now(),
      action: 'READ',
      resource: 'orders_table',
      result: 'allowed',
    });

    expect(action).not.toBeNull();
    expect(action!.actorType).toBe('agent');
    expect(tracker.getActions('dw-pipelines')).toHaveLength(1);
  });

  it('returns null for unregistered agent action', () => {
    const result = tracker.recordAction('unknown-agent', {
      timestamp: Date.now(),
      action: 'READ',
      resource: 'table',
      result: 'denied',
    });
    expect(result).toBeNull();
  });

  it('filters audit trail by actor type', () => {
    tracker.registerAgent({
      agentId: 'agent-1',
      actorType: 'agent',
      permissions: ['READ'],
    });
    tracker.registerAgent({
      agentId: 'human-1',
      actorType: 'human',
      permissions: ['READ', 'WRITE'],
    });

    tracker.recordAction('agent-1', {
      timestamp: 1000,
      action: 'READ',
      resource: 'table-a',
      result: 'allowed',
    });
    tracker.recordAction('human-1', {
      timestamp: 2000,
      action: 'WRITE',
      resource: 'table-b',
      result: 'allowed',
    });

    const agentActions = tracker.getAuditTrail('agent');
    expect(agentActions).toHaveLength(1);
    expect(agentActions[0].actorType).toBe('agent');

    const allActions = tracker.getAuditTrail();
    expect(allActions).toHaveLength(2);
  });

  it('lists registered agents', () => {
    tracker.registerAgent({ agentId: 'a', actorType: 'agent', permissions: [] });
    tracker.registerAgent({ agentId: 'b', actorType: 'human', permissions: [] });
    expect(tracker.listAgents()).toEqual(['a', 'b']);
  });

  it('checks permissions correctly', () => {
    tracker.registerAgent({
      agentId: 'dw-governance',
      actorType: 'agent',
      permissions: ['READ', 'AUDIT'],
    });
    expect(tracker.hasPermission('dw-governance', 'READ')).toBe(true);
    expect(tracker.hasPermission('dw-governance', 'DELETE')).toBe(false);
    expect(tracker.hasPermission('unknown', 'READ')).toBe(false);
  });

  it('wildcard permission grants all access', () => {
    tracker.registerAgent({
      agentId: 'admin-agent',
      actorType: 'agent',
      permissions: ['*'],
    });
    expect(tracker.hasPermission('admin-agent', 'READ')).toBe(true);
    expect(tracker.hasPermission('admin-agent', 'DELETE')).toBe(true);
    expect(tracker.hasPermission('admin-agent', 'ANYTHING')).toBe(true);
  });

  it('delegated action includes delegatedBy', () => {
    tracker.registerAgent({
      agentId: 'delegated-agent',
      actorType: 'delegated',
      permissions: ['READ'],
      delegatedBy: 'user-admin',
    });

    const action = tracker.recordAction('delegated-agent', {
      timestamp: Date.now(),
      action: 'READ',
      resource: 'sensitive_data',
      result: 'allowed',
    });

    expect(action!.actorType).toBe('delegated');
    expect(action!.delegatedBy).toBe('user-admin');
  });
});
