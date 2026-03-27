/**
 * In-memory graph database stub for development and testing.
 * Supports lineage traversal (upstream/downstream) and impact analysis.
 */

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  platform: string;
  properties: Record<string, unknown>;
  customerId: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  properties: Record<string, unknown>;
}

import type { IGraphDB } from './interfaces/index.js';

export class InMemoryGraphDB implements IGraphDB {
  private nodes: Map<string, GraphNode> = new Map();
  private outEdges: Map<string, GraphEdge[]> = new Map();
  private inEdges: Map<string, GraphEdge[]> = new Map();

  async addNode(node: GraphNode): Promise<void> {
    this.nodes.set(node.id, node);
    if (!this.outEdges.has(node.id)) this.outEdges.set(node.id, []);
    if (!this.inEdges.has(node.id)) this.inEdges.set(node.id, []);
  }

  async addEdge(edge: GraphEdge): Promise<void> {
    const out = this.outEdges.get(edge.source);
    if (out) out.push(edge);
    else this.outEdges.set(edge.source, [edge]);

    const inc = this.inEdges.get(edge.target);
    if (inc) inc.push(edge);
    else this.inEdges.set(edge.target, [edge]);
  }

  async getNode(id: string): Promise<GraphNode | undefined> {
    return this.nodes.get(id);
  }

  async removeNode(id: string): Promise<boolean> {
    if (!this.nodes.has(id)) return false;
    this.nodes.delete(id);
    this.outEdges.delete(id);
    this.inEdges.delete(id);
    // Remove edges referencing this node
    for (const [key, edges] of this.outEdges.entries()) {
      this.outEdges.set(key, edges.filter(e => e.target !== id));
    }
    for (const [key, edges] of this.inEdges.entries()) {
      this.inEdges.set(key, edges.filter(e => e.source !== id));
    }
    return true;
  }

  /**
   * BFS traversal following incoming edges (upstream sources).
   */
  async traverseUpstream(nodeId: string, maxDepth: number): Promise<Array<{ node: GraphNode; depth: number; relationship: string }>> {
    return this.bfs(nodeId, maxDepth, 'upstream');
  }

  /**
   * BFS traversal following outgoing edges (downstream consumers).
   */
  async traverseDownstream(nodeId: string, maxDepth: number): Promise<Array<{ node: GraphNode; depth: number; relationship: string }>> {
    return this.bfs(nodeId, maxDepth, 'downstream');
  }

  /**
   * Get all downstream nodes for impact assessment.
   */
  async getImpact(nodeId: string): Promise<Array<{ node: GraphNode; depth: number; relationship: string }>> {
    return this.traverseDownstream(nodeId, Infinity);
  }

  /**
   * Find nodes by type, optionally filtered by customerId.
   */
  async findByType(type: string, customerId?: string): Promise<GraphNode[]> {
    const results: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.type === type) {
        if (!customerId || node.customerId === customerId) {
          results.push(node);
        }
      }
    }
    return results;
  }

  /**
   * Find nodes whose name contains the query string.
   */
  async findByName(query: string, customerId?: string): Promise<GraphNode[]> {
    const q = query.toLowerCase();
    const results: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.name.toLowerCase().includes(q)) {
        if (!customerId || node.customerId === customerId) {
          results.push(node);
        }
      }
    }
    return results;
  }

  /**
   * Get all nodes in the graph.
   */
  async getAllNodes(): Promise<GraphNode[]> {
    return Array.from(this.nodes.values());
  }

  /**
   * Get edges between two specific nodes (used for column-level lineage).
   */
  async getEdgesBetween(sourceId: string, targetId: string): Promise<GraphEdge[]> {
    const out = this.outEdges.get(sourceId) || [];
    return out.filter(e => e.target === targetId);
  }

  /**
   * Get all column-level lineage edges for a given node (incoming).
   */
  async getColumnEdgesForNode(nodeId: string): Promise<GraphEdge[]> {
    const incoming = this.inEdges.get(nodeId) || [];
    return incoming.filter(e => e.relationship === 'column_lineage');
  }

  private bfs(
    startId: string,
    maxDepth: number,
    direction: 'upstream' | 'downstream',
  ): Array<{ node: GraphNode; depth: number; relationship: string }> {
    const results: Array<{ node: GraphNode; depth: number; relationship: string }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      const edges = direction === 'upstream'
        ? (this.inEdges.get(current.id) || [])
        : (this.outEdges.get(current.id) || []);

      for (const edge of edges) {
        // Skip column-level lineage edges in traversal
        if (edge.relationship === 'column_lineage') continue;

        const nextId = direction === 'upstream' ? edge.source : edge.target;
        if (visited.has(nextId)) continue;
        visited.add(nextId);

        const node = this.nodes.get(nextId);
        if (node) {
          results.push({ node, depth: current.depth + 1, relationship: edge.relationship });
          queue.push({ id: nextId, depth: current.depth + 1 });
        }
      }
    }

    return results;
  }

  seed(): void {
    const customerId = 'cust-1';
    const now = Date.now();
    const DAY = 86_400_000;

    // Source tables — actively updated, good quality
    this.addNode({ id: 'src-raw-orders', type: 'source', name: 'raw_orders', platform: 'postgres', properties: { schema: 'public', database: 'production', qualityScore: 0.9, freshnessScore: 0.95, lastUpdated: now - 1 * DAY, columns: [{ name: 'order_id', type: 'INTEGER' }, { name: 'customer_id', type: 'INTEGER' }, { name: 'amount', type: 'DECIMAL' }, { name: 'order_date', type: 'TIMESTAMP' }, { name: 'status', type: 'VARCHAR' }] }, customerId });
    this.addNode({ id: 'src-raw-customers', type: 'source', name: 'raw_customers', platform: 'postgres', properties: { schema: 'public', database: 'production', qualityScore: 0.85, freshnessScore: 0.9, lastUpdated: now - 2 * DAY, columns: [{ name: 'customer_id', type: 'INTEGER' }, { name: 'name', type: 'VARCHAR' }, { name: 'email', type: 'VARCHAR' }, { name: 'created_at', type: 'TIMESTAMP' }] }, customerId });
    this.addNode({ id: 'src-raw-events', type: 'source', name: 'raw_events', platform: 'bigquery', properties: { dataset: 'raw', project: 'analytics', qualityScore: 0.8, freshnessScore: 0.88, lastUpdated: now - 1 * DAY }, customerId });

    // Staging models — regularly refreshed
    this.addNode({ id: 'stg-orders', type: 'model', name: 'stg_orders', platform: 'dbt', properties: { materialization: 'view', schema: 'staging', qualityScore: 0.85, freshnessScore: 0.92, lastUpdated: now - 1 * DAY }, customerId });
    this.addNode({ id: 'stg-customers', type: 'model', name: 'stg_customers', platform: 'dbt', properties: { materialization: 'view', schema: 'staging', qualityScore: 0.82, freshnessScore: 0.88, lastUpdated: now - 2 * DAY }, customerId });
    this.addNode({ id: 'stg-events', type: 'model', name: 'stg_events', platform: 'dbt', properties: { materialization: 'view', schema: 'staging', qualityScore: 0.78, freshnessScore: 0.85, lastUpdated: now - 1 * DAY }, customerId });

    // Mart models — actively queried
    this.addNode({ id: 'mart-dim-orders', type: 'model', name: 'dim_orders', platform: 'dbt', properties: { materialization: 'table', schema: 'marts', qualityScore: 0.9, freshnessScore: 0.95, lastUpdated: now - 1 * DAY }, customerId });
    this.addNode({ id: 'mart-dim-customers', type: 'model', name: 'dim_customers', platform: 'dbt', properties: { materialization: 'table', schema: 'marts', qualityScore: 0.88, freshnessScore: 0.9, lastUpdated: now - 2 * DAY }, customerId });
    this.addNode({ id: 'mart-fct-events', type: 'model', name: 'fct_events', platform: 'dbt', properties: { materialization: 'table', schema: 'marts', qualityScore: 0.85, freshnessScore: 0.87, lastUpdated: now - 1 * DAY }, customerId });

    // Dashboards — actively viewed
    this.addNode({ id: 'dash-revenue', type: 'dashboard', name: 'Revenue Dashboard', platform: 'looker', properties: { folder: 'Executive', qualityScore: 0.75, freshnessScore: 0.8, lastUpdated: now - 3 * DAY }, customerId });
    this.addNode({ id: 'dash-customer-analytics', type: 'dashboard', name: 'Customer Analytics', platform: 'looker', properties: { folder: 'Analytics', qualityScore: 0.7, freshnessScore: 0.78, lastUpdated: now - 4 * DAY }, customerId });

    // Also add the original test assets as nodes — these have usage signals too
    this.addNode({ id: 'tbl-1', type: 'table', name: 'orders', platform: 'snowflake', properties: { schema: 'public', qualityScore: 0.9, freshnessScore: 0.93, lastUpdated: now - 1 * DAY, columns: [{ name: 'id', type: 'INTEGER' }, { name: 'customer_id', type: 'VARCHAR' }, { name: 'amount', type: 'DECIMAL' }, { name: 'order_date', type: 'TIMESTAMP' }, { name: 'status', type: 'VARCHAR' }] }, customerId });
    this.addNode({ id: 'tbl-2', type: 'table', name: 'customers', platform: 'snowflake', properties: { schema: 'public', qualityScore: 0.85, freshnessScore: 0.88, lastUpdated: now - 2 * DAY, columns: [{ name: 'id', type: 'INTEGER' }, { name: 'name', type: 'VARCHAR' }, { name: 'email', type: 'VARCHAR' }, { name: 'created_at', type: 'TIMESTAMP' }, { name: 'segment', type: 'VARCHAR' }] }, customerId });
    this.addNode({ id: 'tbl-3', type: 'model', name: 'daily_revenue', platform: 'dbt', properties: { materialization: 'table', qualityScore: 0.7, freshnessScore: 0.75, lastUpdated: now - 5 * DAY, columns: [{ name: 'date', type: 'DATE' }, { name: 'revenue', type: 'DECIMAL' }, { name: 'order_count', type: 'INTEGER' }, { name: 'avg_order_value', type: 'DECIMAL' }] }, customerId });
    this.addNode({ id: 'tbl-4', type: 'table', name: 'user_events', platform: 'bigquery', properties: { dataset: 'events', qualityScore: 0.6, freshnessScore: 0.65, lastUpdated: now - 10 * DAY, columns: [{ name: 'event_id', type: 'STRING' }, { name: 'user_id', type: 'STRING' }, { name: 'event_type', type: 'STRING' }, { name: 'timestamp', type: 'TIMESTAMP' }, { name: 'properties', type: 'JSON' }] }, customerId });
    this.addNode({ id: 'pipe-1', type: 'pipeline', name: 'etl_orders_daily', platform: 'airflow', properties: { schedule: 'daily', qualityScore: 0.8, freshnessScore: 0.9, lastUpdated: now - 1 * DAY }, customerId });

    // Asset-level lineage edges (source -> target means source feeds into target)
    // raw -> staging
    this.addEdge({ source: 'src-raw-orders', target: 'stg-orders', relationship: 'derives_from', properties: {} });
    this.addEdge({ source: 'src-raw-customers', target: 'stg-customers', relationship: 'derives_from', properties: {} });
    this.addEdge({ source: 'src-raw-events', target: 'stg-events', relationship: 'derives_from', properties: {} });

    // staging -> marts
    this.addEdge({ source: 'stg-orders', target: 'mart-dim-orders', relationship: 'derives_from', properties: {} });
    this.addEdge({ source: 'stg-customers', target: 'mart-dim-customers', relationship: 'derives_from', properties: {} });
    this.addEdge({ source: 'stg-events', target: 'mart-fct-events', relationship: 'derives_from', properties: {} });

    // marts -> dashboards
    this.addEdge({ source: 'mart-dim-orders', target: 'dash-revenue', relationship: 'consumed_by', properties: {} });
    this.addEdge({ source: 'mart-dim-customers', target: 'dash-customer-analytics', relationship: 'consumed_by', properties: {} });
    this.addEdge({ source: 'mart-fct-events', target: 'dash-customer-analytics', relationship: 'consumed_by', properties: {} });

    // Link the original orders table into the lineage
    this.addEdge({ source: 'src-raw-orders', target: 'tbl-1', relationship: 'derives_from', properties: {} });
    this.addEdge({ source: 'tbl-1', target: 'mart-dim-orders', relationship: 'consumed_by', properties: {} });

    // Column-level lineage edges
    this.addEdge({
      source: 'src-raw-orders',
      target: 'stg-orders',
      relationship: 'column_lineage',
      properties: { sourceColumn: 'order_id', targetColumn: 'id', transformation: 'direct' },
    });
    this.addEdge({
      source: 'src-raw-orders',
      target: 'stg-orders',
      relationship: 'column_lineage',
      properties: { sourceColumn: 'amount', targetColumn: 'amount', transformation: 'direct' },
    });
    this.addEdge({
      source: 'stg-orders',
      target: 'mart-dim-orders',
      relationship: 'column_lineage',
      properties: { sourceColumn: 'id', targetColumn: 'order_id', transformation: 'direct' },
    });
    this.addEdge({
      source: 'stg-orders',
      target: 'mart-dim-orders',
      relationship: 'column_lineage',
      properties: { sourceColumn: 'amount', targetColumn: 'total_amount', transformation: 'SUM(amount)' },
    });
    // Column lineage for the original orders asset
    this.addEdge({
      source: 'src-raw-orders',
      target: 'tbl-1',
      relationship: 'column_lineage',
      properties: { sourceColumn: 'order_id', targetColumn: 'id', transformation: 'direct' },
    });
    this.addEdge({
      source: 'src-raw-orders',
      target: 'tbl-1',
      relationship: 'column_lineage',
      properties: { sourceColumn: 'amount', targetColumn: 'total_amount', transformation: 'SUM(amount)' },
    });

    // Seed graph data for test-customer-1 (used by eval tests)
    const testCustomerId = 'test-customer-1';

    this.addNode({ id: 'tc1-orders', type: 'table', name: 'orders', platform: 'snowflake', properties: { schema: 'public', qualityScore: 0.9, freshnessScore: 0.93, lastUpdated: now - 1 * DAY, columns: [{ name: 'id', type: 'INTEGER' }, { name: 'customer_id', type: 'VARCHAR' }, { name: 'amount', type: 'DECIMAL' }, { name: 'order_date', type: 'TIMESTAMP' }, { name: 'status', type: 'VARCHAR' }] }, customerId: testCustomerId });
    this.addNode({ id: 'tc1-customers', type: 'table', name: 'customers', platform: 'snowflake', properties: { schema: 'public', qualityScore: 0.85, freshnessScore: 0.88, lastUpdated: now - 2 * DAY, columns: [{ name: 'id', type: 'INTEGER' }, { name: 'name', type: 'VARCHAR' }, { name: 'email', type: 'VARCHAR' }, { name: 'created_at', type: 'TIMESTAMP' }] }, customerId: testCustomerId });
    this.addNode({ id: 'tc1-pipeline', type: 'pipeline', name: 'etl_orders_daily', platform: 'airflow', properties: { schedule: 'daily', qualityScore: 0.8, freshnessScore: 0.9, lastUpdated: now - 1 * DAY }, customerId: testCustomerId });
    this.addNode({ id: 'tc1-dashboard', type: 'dashboard', name: 'Revenue Dashboard', platform: 'looker', properties: { folder: 'Executive', qualityScore: 0.75, freshnessScore: 0.8, lastUpdated: now - 3 * DAY }, customerId: testCustomerId });
    this.addNode({ id: 'tc1-model', type: 'model', name: 'dim_orders', platform: 'dbt', properties: { materialization: 'table', schema: 'marts', qualityScore: 0.9, freshnessScore: 0.95, lastUpdated: now - 1 * DAY }, customerId: testCustomerId });

    // Lineage: orders -> dim_orders -> dashboard
    this.addEdge({ source: 'tc1-orders', target: 'tc1-model', relationship: 'derives_from', properties: {} });
    this.addEdge({ source: 'tc1-model', target: 'tc1-dashboard', relationship: 'consumed_by', properties: {} });
    this.addEdge({ source: 'tc1-orders', target: 'tc1-pipeline', relationship: 'consumed_by', properties: {} });
  }
}
