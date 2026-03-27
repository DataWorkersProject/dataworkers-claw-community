import { describe, it, expect } from 'vitest';
import { InMemoryGraphDB } from '../graph-db.js';

describe('InMemoryGraphDB', () => {
  const makeNode = (id: string, type = 'table', name = id) => ({
    id,
    type,
    name,
    platform: 'test',
    properties: {},
    customerId: 'cust-1',
  });

  it('addNode and getNode retrieves it', async () => {
    const db = new InMemoryGraphDB();
    const node = makeNode('n1', 'table', 'orders');
    await db.addNode(node);
    expect(await db.getNode('n1')).toEqual(node);
  });

  it('getNode returns undefined for missing node', async () => {
    const db = new InMemoryGraphDB();
    expect(await db.getNode('missing')).toBeUndefined();
  });

  it('removeNode deletes node and cleans up edges', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode(makeNode('a'));
    await db.addNode(makeNode('b'));
    await db.addNode(makeNode('c'));
    await db.addEdge({ source: 'a', target: 'b', relationship: 'derives_from', properties: {} });
    await db.addEdge({ source: 'b', target: 'c', relationship: 'derives_from', properties: {} });
    await db.removeNode('b');
    expect(await db.getNode('b')).toBeUndefined();
    // Downstream from a should no longer find b or c
    const downstream = await db.traverseDownstream('a', 10);
    expect(downstream.find(r => r.node.id === 'b')).toBeUndefined();
  });

  it('traverseUpstream returns upstream nodes', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode(makeNode('src'));
    await db.addNode(makeNode('mid'));
    await db.addNode(makeNode('dst'));
    await db.addEdge({ source: 'src', target: 'mid', relationship: 'derives_from', properties: {} });
    await db.addEdge({ source: 'mid', target: 'dst', relationship: 'derives_from', properties: {} });
    const upstream = await db.traverseUpstream('dst', 10);
    const ids = upstream.map(r => r.node.id);
    expect(ids).toContain('mid');
    expect(ids).toContain('src');
  });

  it('traverseDownstream returns downstream nodes', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode(makeNode('src'));
    await db.addNode(makeNode('mid'));
    await db.addNode(makeNode('dst'));
    await db.addEdge({ source: 'src', target: 'mid', relationship: 'derives_from', properties: {} });
    await db.addEdge({ source: 'mid', target: 'dst', relationship: 'derives_from', properties: {} });
    const downstream = await db.traverseDownstream('src', 10);
    const ids = downstream.map(r => r.node.id);
    expect(ids).toContain('mid');
    expect(ids).toContain('dst');
  });

  it('getImpact returns all downstream nodes', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode(makeNode('root'));
    await db.addNode(makeNode('child1'));
    await db.addNode(makeNode('child2'));
    await db.addNode(makeNode('grandchild'));
    await db.addEdge({ source: 'root', target: 'child1', relationship: 'derives_from', properties: {} });
    await db.addEdge({ source: 'root', target: 'child2', relationship: 'derives_from', properties: {} });
    await db.addEdge({ source: 'child1', target: 'grandchild', relationship: 'derives_from', properties: {} });
    const impact = await db.getImpact('root');
    const ids = impact.map(r => r.node.id);
    expect(ids).toContain('child1');
    expect(ids).toContain('child2');
    expect(ids).toContain('grandchild');
    expect(impact).toHaveLength(3);
  });

  it('findByType returns matching nodes', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode(makeNode('t1', 'table'));
    await db.addNode(makeNode('t2', 'table'));
    await db.addNode(makeNode('p1', 'pipeline'));
    const tables = await db.findByType('table');
    expect(tables).toHaveLength(2);
    expect(tables.every(n => n.type === 'table')).toBe(true);
  });

  it('findByName searches by name substring (case-insensitive)', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode(makeNode('n1', 'table', 'Orders_Table'));
    await db.addNode(makeNode('n2', 'table', 'customers'));
    const results = await db.findByName('orders');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('n1');
  });

  it('findByType filters by customerId', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode({ id: 'n1', type: 'table', name: 'a', platform: 'test', properties: {}, customerId: 'cust-1' });
    await db.addNode({ id: 'n2', type: 'table', name: 'b', platform: 'test', properties: {}, customerId: 'cust-2' });
    const results = await db.findByType('table', 'cust-1');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('n1');
  });

  it('findByName filters by customerId', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode({ id: 'n1', type: 'table', name: 'orders', platform: 'test', properties: {}, customerId: 'cust-1' });
    await db.addNode({ id: 'n2', type: 'table', name: 'orders', platform: 'test', properties: {}, customerId: 'cust-2' });
    const results = await db.findByName('orders', 'cust-1');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('n1');
  });

  it('traversal handles cycles without infinite loop', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode(makeNode('a'));
    await db.addNode(makeNode('b'));
    await db.addNode(makeNode('c'));
    await db.addEdge({ source: 'a', target: 'b', relationship: 'derives_from', properties: {} });
    await db.addEdge({ source: 'b', target: 'c', relationship: 'derives_from', properties: {} });
    await db.addEdge({ source: 'c', target: 'a', relationship: 'derives_from', properties: {} });
    const downstream = await db.traverseDownstream('a', 10);
    expect(downstream).toHaveLength(2);
  });

  it('getEdgesBetween returns edges between two nodes', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode(makeNode('a'));
    await db.addNode(makeNode('b'));
    await db.addEdge({ source: 'a', target: 'b', relationship: 'derives_from', properties: {} });
    await db.addEdge({ source: 'a', target: 'b', relationship: 'column_lineage', properties: { col: 'id' } });
    const edges = await db.getEdgesBetween('a', 'b');
    expect(edges).toHaveLength(2);
  });

  it('getColumnEdgesForNode returns column_lineage edges', async () => {
    const db = new InMemoryGraphDB();
    await db.addNode(makeNode('a'));
    await db.addNode(makeNode('b'));
    await db.addEdge({ source: 'a', target: 'b', relationship: 'derives_from', properties: {} });
    await db.addEdge({ source: 'a', target: 'b', relationship: 'column_lineage', properties: { sourceColumn: 'id', targetColumn: 'order_id' } });
    const colEdges = await db.getColumnEdgesForNode('b');
    expect(colEdges).toHaveLength(1);
    expect(colEdges[0].relationship).toBe('column_lineage');
  });

  it('seed populates graph with nodes and edges', async () => {
    const db = new InMemoryGraphDB();
    db.seed();
    const allNodes = await db.getAllNodes();
    expect(allNodes.length).toBeGreaterThan(10);
    // Check that lineage edges exist
    const downstream = await db.traverseDownstream('src-raw-orders', 10);
    expect(downstream.length).toBeGreaterThan(0);
  });
});
