/**
 * P3 Integration Tests.
 *
 * Tests ABAC, OPA/Rego, regulatory templates, cross-agent gating,
 * and policy caching.
 */

import { describe, it, expect } from 'vitest';
import { InMemoryRelationalStore, InMemoryKeyValueStore } from '@data-workers/infrastructure-stubs';
import { ABACEngine } from '../engine/abac-engine.js';
import { OPAEngine } from '../engine/opa-engine.js';
import { getRegulatoryTemplate, listRegulatoryFrameworks, applyRegulatoryTemplate } from '../engine/regulatory-templates.js';
import { GovernanceGate } from '../engine/governance-gate.js';
import { PolicyCache } from '../engine/policy-cache.js';
import { PolicyStore } from '../policy-store.js';

describe('P3: ABAC Engine', () => {
  it('allows access when user attributes match', () => {
    const engine = new ABACEngine();
    engine.addPolicy({
      id: 'abac-1',
      customerId: 'cust-1',
      name: 'engineering_access',
      userAttributes: { department: 'engineering' },
      resourceAttributes: { classification: 'internal' },
      action: 'allow',
      priority: 10,
    });

    const result = engine.evaluate('cust-1', {
      userAttributes: { department: 'engineering' },
      resourceAttributes: { classification: 'internal' },
    });

    expect(result.allowed).toBe(true);
    expect(result.matchedPolicy?.name).toBe('engineering_access');
  });

  it('denies access when user attributes do not match', () => {
    const engine = new ABACEngine();
    engine.addPolicy({
      id: 'abac-2',
      customerId: 'cust-1',
      name: 'engineering_only',
      userAttributes: { department: 'engineering' },
      resourceAttributes: { classification: 'internal' },
      action: 'allow',
      priority: 10,
    });

    const result = engine.evaluate('cust-1', {
      userAttributes: { department: 'marketing' },
      resourceAttributes: { classification: 'internal' },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No matching ABAC policy');
  });

  it('supports array conditions (multiple allowed values)', () => {
    const engine = new ABACEngine();
    engine.addPolicy({
      id: 'abac-3',
      customerId: 'cust-1',
      name: 'multi_dept_access',
      userAttributes: { department: ['engineering', 'data'] },
      resourceAttributes: { classification: 'internal' },
      action: 'allow',
      priority: 10,
    });

    const result = engine.evaluate('cust-1', {
      userAttributes: { department: 'data' },
      resourceAttributes: { classification: 'internal' },
    });

    expect(result.allowed).toBe(true);
  });

  it('evaluates environmental conditions', () => {
    const engine = new ABACEngine();
    engine.addPolicy({
      id: 'abac-4',
      customerId: 'cust-1',
      name: 'business_hours_only',
      userAttributes: { department: '*' },
      resourceAttributes: { classification: 'confidential' },
      environmentConditions: { timeOfDay: 'business_hours' },
      action: 'allow',
      priority: 10,
    });

    const result = engine.evaluate('cust-1', {
      userAttributes: { department: 'engineering' },
      resourceAttributes: { classification: 'confidential' },
      environmentConditions: { timeOfDay: 'business_hours' },
    });

    expect(result.allowed).toBe(true);
  });

  it('respects priority ordering', () => {
    const engine = new ABACEngine();
    engine.addPolicy({
      id: 'abac-5',
      customerId: 'cust-1',
      name: 'deny_all',
      userAttributes: { department: '*' },
      resourceAttributes: { classification: '*' },
      action: 'deny',
      priority: 1,
    });
    engine.addPolicy({
      id: 'abac-6',
      customerId: 'cust-1',
      name: 'allow_engineering',
      userAttributes: { department: 'engineering' },
      resourceAttributes: { classification: '*' },
      action: 'allow',
      priority: 10,
    });

    const result = engine.evaluate('cust-1', {
      userAttributes: { department: 'engineering' },
      resourceAttributes: { classification: 'internal' },
    });

    // Higher priority (10) wins over lower (1)
    expect(result.allowed).toBe(true);
    expect(result.matchedPolicy?.name).toBe('allow_engineering');
  });

  it('supports tenant isolation', () => {
    const engine = new ABACEngine();
    engine.addPolicy({
      id: 'abac-7',
      customerId: 'cust-1',
      name: 'cust1_access',
      userAttributes: { department: '*' },
      resourceAttributes: { classification: '*' },
      action: 'allow',
      priority: 10,
    });

    const result = engine.evaluate('cust-2', {
      userAttributes: { department: 'engineering' },
      resourceAttributes: { classification: 'internal' },
    });

    // cust-2 has no policies
    expect(result.allowed).toBe(false);
  });

  it('removePolicy works', () => {
    const engine = new ABACEngine();
    engine.addPolicy({
      id: 'abac-rm',
      customerId: 'cust-1',
      name: 'removable',
      userAttributes: { department: '*' },
      resourceAttributes: { classification: '*' },
      action: 'allow',
      priority: 10,
    });

    expect(engine.removePolicy('abac-rm')).toBe(true);
    expect(engine.removePolicy('nonexistent')).toBe(false);
    expect(engine.listPolicies('cust-1')).toHaveLength(0);
  });
});

describe('P3: OPA Engine', () => {
  it('evaluates simple Rego allow rule', () => {
    const engine = new OPAEngine();
    engine.addPolicy({
      id: 'opa-1',
      customerId: 'cust-1',
      name: 'allow_reads',
      rego: `
package governance

default allow = false

allow {
  input.action == "read"
}
`,
      packageName: 'governance',
    });

    const result = engine.evaluate('cust-1', { action: 'read' });
    expect(result.allowed).toBe(true);
  });

  it('denies when Rego conditions not met', () => {
    const engine = new OPAEngine();
    engine.addPolicy({
      id: 'opa-2',
      customerId: 'cust-1',
      name: 'allow_reads_only',
      rego: `
package governance

default allow = false

allow {
  input.action == "read"
}
`,
      packageName: 'governance',
    });

    const result = engine.evaluate('cust-1', { action: 'delete' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Denied by OPA policy');
  });

  it('returns error when no policies registered', () => {
    const engine = new OPAEngine();
    const result = engine.evaluate('cust-1', { action: 'read' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('No OPA policies registered');
  });

  it('removePolicy works', () => {
    const engine = new OPAEngine();
    engine.addPolicy({
      id: 'opa-rm',
      customerId: 'cust-1',
      name: 'removable',
      rego: 'package test\ndefault allow = true',
      packageName: 'test',
    });
    expect(engine.removePolicy('opa-rm')).toBe(true);
    expect(engine.removePolicy('nonexistent')).toBe(false);
  });

  it('tracks evaluation time', () => {
    const engine = new OPAEngine();
    engine.addPolicy({
      id: 'opa-3',
      customerId: 'cust-1',
      name: 'test',
      rego: 'package test\ndefault allow = false\nallow {\n  input.action == "read"\n}',
      packageName: 'test',
    });

    const result = engine.evaluate('cust-1', { action: 'read' });
    expect(result.evaluationTimeMs).toBeDefined();
    expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('P3: Regulatory Templates', () => {
  it('lists all regulatory frameworks', () => {
    const frameworks = listRegulatoryFrameworks();
    expect(frameworks).toContain('GDPR');
    expect(frameworks).toContain('SOC2');
    expect(frameworks).toContain('HIPAA');
    expect(frameworks).toContain('PCI_DSS');
    expect(frameworks).toHaveLength(4);
  });

  it('generates GDPR template with policies', () => {
    const template = getRegulatoryTemplate('GDPR', 'cust-1');
    expect(template.framework).toBe('GDPR');
    expect(template.policies.length).toBeGreaterThanOrEqual(3);
    expect(template.policies.every((p) => p.customerId === 'cust-1')).toBe(true);
    // GDPR should include right to erasure
    const erasure = template.policies.find((p) => p.name.includes('erasure'));
    expect(erasure).toBeDefined();
  });

  it('generates SOC2 template', () => {
    const template = getRegulatoryTemplate('SOC2', 'cust-1');
    expect(template.framework).toBe('SOC2');
    expect(template.policies.length).toBeGreaterThanOrEqual(2);
  });

  it('generates HIPAA template', () => {
    const template = getRegulatoryTemplate('HIPAA', 'cust-1');
    expect(template.framework).toBe('HIPAA');
    expect(template.policies.length).toBeGreaterThanOrEqual(2);
    const phiPolicy = template.policies.find((p) => p.name.includes('phi'));
    expect(phiPolicy).toBeDefined();
  });

  it('generates PCI DSS template', () => {
    const template = getRegulatoryTemplate('PCI_DSS', 'cust-1');
    expect(template.framework).toBe('PCI_DSS');
    expect(template.policies.length).toBeGreaterThanOrEqual(2);
  });

  it('applies template to policy store', async () => {
    const relStore = new InMemoryRelationalStore();
    await relStore.createTable('policies');
    const ps = new PolicyStore(relStore);

    const result = await applyRegulatoryTemplate(ps, 'GDPR', 'cust-t1');
    expect(result.applied).toBeGreaterThanOrEqual(3);
    expect(result.framework).toBe('GDPR');

    // Verify policies are stored
    const policies = await ps.listPolicies('cust-t1');
    expect(policies.length).toBe(result.applied);
  });
});

describe('P3: Cross-Agent Governance Gate', () => {
  it('allows operations that pass policy check', async () => {
    const relStore = new InMemoryRelationalStore();
    await relStore.createTable('policies');
    const ps = new PolicyStore(relStore);
    ps.seed();

    const gate = new GovernanceGate(ps);
    const result = await gate.evaluate('READ', 'orders', 'dw-pipelines', 'cust-1');
    expect(result.allowed).toBe(true);
    expect(result.gateType).toBe('policy');
    expect(result.evaluationTimeMs).toBeDefined();
  });

  it('blocks operations that fail policy check', async () => {
    const relStore = new InMemoryRelationalStore();
    await relStore.createTable('policies');
    const ps = new PolicyStore(relStore);
    ps.seed();

    const gate = new GovernanceGate(ps);
    const result = await gate.evaluate('DELETE', 'inventory', 'dw-pipelines', 'cust-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Denied');
  });

  it('batch evaluates multiple operations', async () => {
    const relStore = new InMemoryRelationalStore();
    await relStore.createTable('policies');
    const ps = new PolicyStore(relStore);
    ps.seed();

    const gate = new GovernanceGate(ps);
    const results = await gate.evaluateBatch([
      { action: 'READ', resource: 'orders', agentId: 'dw-pipelines', customerId: 'cust-1' },
      { action: 'DELETE', resource: 'users', agentId: 'dw-pipelines', customerId: 'cust-1' },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].allowed).toBe(true);
    expect(results[1].allowed).toBe(false);
  });
});

describe('P3: Policy Cache', () => {
  it('caches and retrieves policy evaluations', async () => {
    const kv = new InMemoryKeyValueStore();
    const cache = new PolicyCache(kv);

    const evaluation = {
      allowed: true,
      action: 'allow' as const,
      matchedPolicy: null,
      allMatched: [],
      reason: 'test',
    };

    await cache.set('cust-1', 'READ', 'orders', 'dw-pipelines', evaluation);
    const retrieved = await cache.get('cust-1', 'READ', 'orders', 'dw-pipelines');
    expect(retrieved).toBeDefined();
    expect(retrieved!.allowed).toBe(true);
    expect(retrieved!.reason).toBe('test');
  });

  it('returns null for cache miss', async () => {
    const kv = new InMemoryKeyValueStore();
    const cache = new PolicyCache(kv);

    const result = await cache.get('cust-1', 'READ', 'missing', 'dw-pipelines');
    expect(result).toBeNull();
  });

  it('invalidates cache for a customer', async () => {
    const kv = new InMemoryKeyValueStore();
    const cache = new PolicyCache(kv);

    const evaluation = {
      allowed: true,
      action: 'allow' as const,
      matchedPolicy: null,
      allMatched: [],
      reason: 'cached',
    };

    await cache.set('cust-1', 'READ', 'orders', 'dw-pipelines', evaluation);
    await cache.invalidate('cust-1');

    const result = await cache.get('cust-1', 'READ', 'orders', 'dw-pipelines');
    expect(result).toBeNull();
  });

  it('invalidates all cache entries', async () => {
    const kv = new InMemoryKeyValueStore();
    const cache = new PolicyCache(kv);

    const evaluation = {
      allowed: true,
      action: 'allow' as const,
      matchedPolicy: null,
      allMatched: [],
      reason: 'cached',
    };

    await cache.set('cust-1', 'READ', 'a', 'dw-pipelines', evaluation);
    await cache.set('cust-2', 'READ', 'b', 'dw-pipelines', evaluation);
    await cache.invalidateAll();

    expect(await cache.get('cust-1', 'READ', 'a', 'dw-pipelines')).toBeNull();
    expect(await cache.get('cust-2', 'READ', 'b', 'dw-pipelines')).toBeNull();
  });

  it('lookup completes in <100ms', async () => {
    const kv = new InMemoryKeyValueStore();
    const cache = new PolicyCache(kv);

    const evaluation = {
      allowed: true,
      action: 'allow' as const,
      matchedPolicy: null,
      allMatched: [],
      reason: 'fast',
    };

    await cache.set('cust-1', 'READ', 'orders', 'dw-pipelines', evaluation);

    const start = Date.now();
    const result = await cache.get('cust-1', 'READ', 'orders', 'dw-pipelines');
    const elapsed = Date.now() - start;

    expect(result).toBeDefined();
    expect(elapsed).toBeLessThan(100);
  });
});
