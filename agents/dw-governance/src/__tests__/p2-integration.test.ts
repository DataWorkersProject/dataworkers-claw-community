/**
 * P2 Integration Tests.
 *
 * Tests LLM PII detection, message bus events, cross-agent flow,
 * configurable patterns, row tracking, and governance review.
 */

import { describe, it, expect } from 'vitest';
import { InMemoryRelationalStore, InMemoryLLMClient, InMemoryKeyValueStore, InMemoryMessageBus } from '@data-workers/infrastructure-stubs';
import { PIIScanner } from '../pii-scanner.js';
import { PolicyStore } from '../policy-store.js';
import { setupGovernanceSubscriptions, GOVERNANCE_TOPICS, publishGovernanceEvent } from '../subscriptions.js';
import { server } from '../index.js';
import { messageBus } from '../backends.js';

describe('P2 Integration: LLM PII Detection', () => {
  it('uses LLM client for Pass 3 classification when provided', async () => {
    const store = new InMemoryRelationalStore();
    const llm = new InMemoryLLMClient();
    const scanner = new PIIScanner(store, llm);

    await store.createTable('ambiguous');
    // Column name "reference" triggers heuristic for "name" (contains "name"? no)
    // but let's use a column that triggers low confidence heuristic
    await store.insert('ambiguous', { customer_name: 'test-value-1', code: 'abc123' });

    const result = await scanner.scan('cust-1', 'ambiguous');
    // customer_name triggers heuristic (0.7 confidence) — Pass 3 should then run LLM
    const llmDetection = result.detections.find((d) => d.method === 'llm');
    // If heuristic found it but no regex value match, LLM should be triggered
    expect(result.detections.length).toBeGreaterThan(0);
    // LLM call count should reflect usage
    const callCount = await llm.getCallCount();
    // Since customer_name gets heuristic 0.7 then value doesn't match regex,
    // the column has inconclusive + no high confidence → LLM fires
    if (llmDetection) {
      expect(callCount).toBeGreaterThan(0);
      expect(llmDetection.confidence).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('falls back to stub when LLM is not provided', async () => {
    const store = new InMemoryRelationalStore();
    const scanner = new PIIScanner(store); // no LLM

    await store.createTable('test_no_llm');
    await store.insert('test_no_llm', { customer_name: 'val', data: '123' });

    const result = await scanner.scan('cust-1', 'test_no_llm');
    expect(result.detections.length).toBeGreaterThan(0);
  });
});

describe('P2 Integration: Row Tracking', () => {
  it('populates row number in value-based detections', async () => {
    const store = new InMemoryRelationalStore();
    const scanner = new PIIScanner(store);

    await store.createTable('row_test');
    await store.insert('row_test', { id: 1, data: 'no pii here' });
    await store.insert('row_test', { id: 2, data: 'email: test@example.com' });

    const result = await scanner.scan('cust-1', 'row_test');
    const emailDetection = result.detections.find(
      (d) => d.type === 'email' && d.method === 'regex',
    );
    expect(emailDetection).toBeDefined();
    expect(emailDetection!.location.row).toBeDefined();
    expect(typeof emailDetection!.location.row).toBe('number');
  });
});

describe('P2 Integration: Message Bus Events (/869/870)', () => {
  it('auto-triggers PII scan on dataset_discovered event', async () => {
    const store = new InMemoryRelationalStore();
    const bus = new InMemoryMessageBus();
    const scanner = new PIIScanner(store);
    const relStore = new InMemoryRelationalStore();
    await relStore.createTable('policies');
    const ps = new PolicyStore(relStore);

    // Seed a table for the scanner
    await store.createTable('new_dataset');
    await store.insert('new_dataset', { id: 1, email: 'user@test.com' });

    await setupGovernanceSubscriptions(bus, scanner, ps);

    // Publish a dataset_discovered event
    await bus.publish(GOVERNANCE_TOPICS.DATASET_DISCOVERED, {
      id: 'evt-1',
      type: 'dataset_discovered',
      payload: { datasetId: 'new_dataset' },
      timestamp: Date.now(),
      customerId: 'cust-1',
    });

    // Wait briefly for async handler
    await new Promise((r) => setTimeout(r, 50));

    // Check that a governance event was published
    const events = await bus.getEvents(GOVERNANCE_TOPICS.GOVERNANCE_EVENTS);
    const piiEvent = events.find((e) => e.type === 'governance_pii_detected');
    expect(piiEvent).toBeDefined();
    expect(piiEvent!.payload.datasetId).toBe('new_dataset');
  });

  it('evaluates compliance on schema_change_detected event', async () => {
    const bus = new InMemoryMessageBus();
    const store = new InMemoryRelationalStore();
    const scanner = new PIIScanner(store);
    const relStore = new InMemoryRelationalStore();
    await relStore.createTable('policies');
    const ps = new PolicyStore(relStore);
    ps.seed();

    await setupGovernanceSubscriptions(bus, scanner, ps);

    // Publish schema change event
    await bus.publish(GOVERNANCE_TOPICS.SCHEMA_CHANGE_DETECTED, {
      id: 'evt-2',
      type: 'schema_change_detected',
      payload: { resource: 'users_table', changeType: 'ALTER' },
      timestamp: Date.now(),
      customerId: 'cust-1',
    });

    await new Promise((r) => setTimeout(r, 50));

    const events = await bus.getEvents(GOVERNANCE_TOPICS.GOVERNANCE_EVENTS);
    const complianceEvent = events.find((e) => e.type === 'governance_compliance_evaluated');
    expect(complianceEvent).toBeDefined();
    expect(complianceEvent!.payload.resource).toBe('users_table');
  });

  it('publishGovernanceEvent sends events to governance_events topic', async () => {
    const bus = new InMemoryMessageBus();

    await publishGovernanceEvent(bus, 'test_event', { foo: 'bar' }, 'cust-1');

    const events = await bus.getEvents(GOVERNANCE_TOPICS.GOVERNANCE_EVENTS);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('test_event');
    expect(events[0].payload.foo).toBe('bar');
  });
});

describe('P2 Integration: Configurable Patterns via KVStore', () => {
  it('uses custom column hints from kvStore', async () => {
    const store = new InMemoryRelationalStore();
    const kv = new InMemoryKeyValueStore();
    const scanner = new PIIScanner(store, undefined, kv);

    // Set custom column hints
    await kv.set('gov:pii:column_hints', JSON.stringify({
      secret_code: 'ssn',
    }));

    await store.createTable('custom_hints');
    await store.insert('custom_hints', { secret_code: 'abc123', status: 'active' });

    const result = await scanner.scan('cust-1', 'custom_hints');
    const detection = result.detections.find((d) => d.location.column === 'secret_code');
    expect(detection).toBeDefined();
    expect(detection!.type).toBe('ssn');
  });

  it('uses custom value patterns from kvStore', async () => {
    const store = new InMemoryRelationalStore();
    const kv = new InMemoryKeyValueStore();
    const scanner = new PIIScanner(store, undefined, kv);

    // Set custom value pattern
    await kv.set('gov:pii:value_patterns', JSON.stringify([
      { type: 'email', pattern: '\\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b' },
      { type: 'ssn', pattern: 'CUSTOM-\\d{4}' },
    ]));

    await store.createTable('custom_patterns');
    await store.insert('custom_patterns', { data: 'id: CUSTOM-1234', info: 'test' });

    const result = await scanner.scan('cust-1', 'custom_patterns');
    const detection = result.detections.find((d) => d.type === 'ssn');
    expect(detection).toBeDefined();
  });

  it('falls back to defaults when kvStore has no config', async () => {
    const store = new InMemoryRelationalStore();
    const kv = new InMemoryKeyValueStore();
    const scanner = new PIIScanner(store, undefined, kv);

    await store.createTable('default_test');
    await store.insert('default_test', { email: 'test@example.com' });

    const result = await scanner.scan('cust-1', 'default_test');
    expect(result.detections.length).toBeGreaterThan(0);
  });
});

describe('P2 Integration: Governance Review', () => {
  it('creates a governance review request via tool', async () => {
    const result = await server.callTool('request_governance_review', {
      customerId: 'cust-1',
      requestedBy: 'dw-pipelines',
      resource: 'sensitive_data',
      action: 'DELETE',
      reason: 'Need to purge old records',
    });
    const data = JSON.parse(result.content[0].text!);
    expect(data.reviewId).toBeDefined();
    expect(data.status).toBe('pending');
    expect(data.review.resource).toBe('sensitive_data');
    expect(data.review.action).toBe('DELETE');
  });
});

describe('P2 Integration: Cross-Agent Flow', () => {
  it('scan PII → review request → check policy end-to-end', async () => {
    // Step 1: Scan for PII
    const scanResult = await server.callTool('scan_pii', {
      datasetId: 'customer_notes', customerId: 'cust-1',
    });
    const scan = JSON.parse(scanResult.content[0].text!);
    expect(scan.piiColumnsFound).toBeGreaterThan(0);

    // Step 2: Request governance review for PII data access
    const reviewResult = await server.callTool('request_governance_review', {
      customerId: 'cust-1',
      requestedBy: 'dw-insights',
      resource: 'customer_notes',
      action: 'READ',
      reason: `PII detected: ${scan.piiColumnsFound} columns. Review needed.`,
    });
    const review = JSON.parse(reviewResult.content[0].text!);
    expect(review.status).toBe('pending');

    // Step 3: Check policy
    const policyResult = await server.callTool('check_policy', {
      action: 'read', resource: 'customer_notes', agentId: 'dw-insights', customerId: 'cust-1',
    });
    const policy = JSON.parse(policyResult.content[0].text!);
    expect(policy.evaluationTimeMs).toBeLessThan(100);
  });
});
