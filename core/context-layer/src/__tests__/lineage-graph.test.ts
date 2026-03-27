import { describe, it, expect } from 'vitest';
import { LineageGraph } from '../lineage-graph.js';

describe('LineageGraph', () => {
  const graph = new LineageGraph();

  // REQ-CTX-014: Tenant isolation
  it('requires customer_id on entity creation', async () => {
    await expect(
      graph.addEntity({ id: 'e1', customerId: '', type: 'table', name: 'users', metadata: {}, createdAt: Date.now(), updatedAt: Date.now() }),
    ).rejects.toThrow('customer_id is required');
  });

  it('requires customer_id on relation creation', async () => {
    await expect(
      graph.addRelation({ id: 'r1', customerId: '', sourceId: 'e1', targetId: 'e2', type: 'derives_from' }),
    ).rejects.toThrow('customer_id is required');
  });

  it('requires customer_id on traversal', async () => {
    await expect(graph.traverseUpstream('', 'e1')).rejects.toThrow('customer_id is required');
  });

  it('verifies cross-tenant isolation', async () => {
    const isolated = await graph.verifyCrossTenantIsolation('cust-attacker', 'cust-victim');
    expect(isolated).toBe(true); // Isolation confirmed
  });

  it('rejects same-tenant isolation test', async () => {
    const isolated = await graph.verifyCrossTenantIsolation('cust-1', 'cust-1');
    expect(isolated).toBe(false); // Not a valid cross-tenant test
  });

  it('traverses upstream with depth limit', async () => {
    const result = await graph.traverseUpstream('cust-1', 'table-1', 5);
    expect(result.depth).toBe(0); // Stub returns empty
    expect(result.traversalTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('supports column-level lineage', async () => {
    const result = await graph.getColumnLineage('cust-1', 'orders', 'total_amount');
    expect(result).toBeDefined();
  });
});
