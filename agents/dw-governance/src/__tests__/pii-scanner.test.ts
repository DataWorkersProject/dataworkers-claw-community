import { describe, it, expect } from 'vitest';
import { PIIScanner } from '../pii-scanner.js';
import { InMemoryRelationalStore } from '@data-workers/infrastructure-stubs';

describe('PIIScanner', () => {
  it('exports PIIScanner class', () => {
    expect(PIIScanner).toBeDefined();
  });

  it('creates instance with a relational store', () => {
    const store = new InMemoryRelationalStore();
    const scanner = new PIIScanner(store);
    expect(scanner).toBeDefined();
  });

  it('returns empty result for empty table', async () => {
    const store = new InMemoryRelationalStore();
    const scanner = new PIIScanner(store);
    const result = await scanner.scan('cust-1', 'empty_table');
    expect(result.scannedColumns).toBe(0);
    expect(result.detections).toHaveLength(0);
    expect(result.piiColumnsFound).toBe(0);
  });

  it('detects PII from column names', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('users');
    await store.insert('users', { id: 1, email: 'alice@example.com', name: 'Alice' });
    const scanner = new PIIScanner(store);
    const result = await scanner.scan('cust-1', 'users');
    expect(result.scannedColumns).toBeGreaterThan(0);
    expect(result.detections.length).toBeGreaterThan(0);
    expect(result.piiColumnsFound).toBeGreaterThan(0);
  });

  it('detects email patterns via regex', async () => {
    const store = new InMemoryRelationalStore();
    await store.createTable('contacts');
    await store.insert('contacts', { id: 1, contact_info: 'user@example.com' });
    const scanner = new PIIScanner(store);
    const result = await scanner.scan('cust-1', 'contacts');
    const emailDetection = result.detections.find((d) => d.type === 'email');
    expect(emailDetection).toBeDefined();
  });
});
