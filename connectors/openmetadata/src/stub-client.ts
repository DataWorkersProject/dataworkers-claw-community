/**
 * Stubbed OpenMetadata client.
 * Uses in-memory stores to simulate OpenMetadata REST API.
 */

import type {
  IOpenMetadataClient,
  OMDatabase,
  OMTable,
  OMColumn,
  OMTag,
  OMLineageGraph,
  OMQualityTestResult,
} from './types.js';

export class OpenMetadataStubClient implements IOpenMetadataClient {
  private databases: Map<string, OMDatabase> = new Map();
  private tables: Map<string, OMTable[]> = new Map();
  private tablesById: Map<string, OMTable> = new Map();
  private lineageGraphs: Map<string, OMLineageGraph> = new Map();
  private qualityTests: Map<string, OMQualityTestResult[]> = new Map();
  private seeded = false;

  /** Pre-load with realistic OpenMetadata data. */
  seed(): void {
    if (this.seeded) return;

    const now = Date.now();
    const DAY = 86_400_000;

    // --- Helper ---
    const col = (name: string, dataType: string, description: string, tags: OMTag[] = []): OMColumn => ({
      name, dataType, description, tags,
    });
    const tag = (tagFQN: string, source = 'Classification'): OMTag => ({ tagFQN, source });

    // --- Databases ---
    this.databases.set('warehouse_db', {
      id: 'db-001',
      name: 'warehouse_db',
      fullyQualifiedName: 'snowflake.warehouse_db',
      service: 'snowflake',
    });
    this.databases.set('analytics_db', {
      id: 'db-002',
      name: 'analytics_db',
      fullyQualifiedName: 'bigquery.analytics_db',
      service: 'bigquery',
    });

    // --- Tables: warehouse_db ---
    const customerTable: OMTable = {
      id: 'tbl-001',
      name: 'customers',
      fullyQualifiedName: 'snowflake.warehouse_db.public.customers',
      columns: [
        col('customer_id', 'BIGINT', 'Unique customer ID'),
        col('email', 'VARCHAR', 'Customer email', [tag('PII.Email')]),
        col('name', 'VARCHAR', 'Full name', [tag('PII.Name')]),
        col('segment', 'VARCHAR', 'Customer segment'),
        col('created_at', 'TIMESTAMP', 'Record creation time'),
      ],
      database: 'warehouse_db',
      tags: [tag('Tier.Tier1'), tag('PersonalData.Personal')],
    };

    const ordersTable: OMTable = {
      id: 'tbl-002',
      name: 'orders',
      fullyQualifiedName: 'snowflake.warehouse_db.public.orders',
      columns: [
        col('order_id', 'BIGINT', 'Order identifier'),
        col('customer_id', 'BIGINT', 'FK to customers'),
        col('order_date', 'DATE', 'Date of order'),
        col('total', 'DECIMAL', 'Order total'),
        col('status', 'VARCHAR', 'Order status'),
      ],
      database: 'warehouse_db',
      tags: [tag('Tier.Tier1')],
    };

    const productsTable: OMTable = {
      id: 'tbl-003',
      name: 'products',
      fullyQualifiedName: 'snowflake.warehouse_db.public.products',
      columns: [
        col('product_id', 'BIGINT', 'Product identifier'),
        col('name', 'VARCHAR', 'Product name'),
        col('category', 'VARCHAR', 'Product category'),
        col('price', 'DECIMAL', 'Unit price'),
      ],
      database: 'warehouse_db',
      tags: [tag('Tier.Tier2')],
    };

    this.tables.set('warehouse_db', [customerTable, ordersTable, productsTable]);

    // --- Tables: analytics_db ---
    const revenueTable: OMTable = {
      id: 'tbl-004',
      name: 'daily_revenue',
      fullyQualifiedName: 'bigquery.analytics_db.daily_revenue',
      columns: [
        col('date', 'DATE', 'Revenue date'),
        col('revenue', 'DECIMAL', 'Daily revenue'),
        col('order_count', 'INTEGER', 'Number of orders'),
        col('region', 'VARCHAR', 'Region'),
      ],
      database: 'analytics_db',
      tags: [tag('Tier.Tier1')],
    };

    const userMetricsTable: OMTable = {
      id: 'tbl-005',
      name: 'user_metrics',
      fullyQualifiedName: 'bigquery.analytics_db.user_metrics',
      columns: [
        col('user_id', 'BIGINT', 'User identifier'),
        col('sessions', 'INTEGER', 'Number of sessions'),
        col('page_views', 'INTEGER', 'Total page views'),
        col('last_active', 'TIMESTAMP', 'Last active timestamp'),
      ],
      database: 'analytics_db',
      tags: [],
    };

    const funnelTable: OMTable = {
      id: 'tbl-006',
      name: 'conversion_funnel',
      fullyQualifiedName: 'bigquery.analytics_db.conversion_funnel',
      columns: [
        col('step', 'VARCHAR', 'Funnel step'),
        col('users', 'INTEGER', 'Users at step'),
        col('conversion_rate', 'DECIMAL', 'Conversion rate'),
        col('date', 'DATE', 'Funnel date'),
      ],
      database: 'analytics_db',
      tags: [tag('Tier.Tier2')],
    };

    this.tables.set('analytics_db', [revenueTable, userMetricsTable, funnelTable]);

    // Index tables by ID
    for (const tableList of this.tables.values()) {
      for (const t of tableList) {
        this.tablesById.set(t.id, t);
      }
    }

    // --- Lineage ---
    this.lineageGraphs.set('tbl-004', {
      entity: 'tbl-004',
      nodes: ['tbl-002', 'tbl-003', 'tbl-004', 'tbl-006'],
      upstreamEdges: [
        { fromEntity: 'tbl-002', toEntity: 'tbl-004' },
        { fromEntity: 'tbl-003', toEntity: 'tbl-004' },
      ],
      downstreamEdges: [
        { fromEntity: 'tbl-004', toEntity: 'tbl-006' },
      ],
    });
    this.lineageGraphs.set('tbl-002', {
      entity: 'tbl-002',
      nodes: ['tbl-001', 'tbl-002', 'tbl-004'],
      upstreamEdges: [
        { fromEntity: 'tbl-001', toEntity: 'tbl-002' },
      ],
      downstreamEdges: [
        { fromEntity: 'tbl-002', toEntity: 'tbl-004' },
      ],
    });

    // --- Quality Tests ---
    this.qualityTests.set('tbl-001', [
      { name: 'customers_not_null_email', testDefinition: 'columnValuesToBeNotNull', testCaseStatus: 'Success', timestamp: now - DAY * 1 },
      { name: 'customers_unique_id', testDefinition: 'columnValuesToBeUnique', testCaseStatus: 'Success', timestamp: now - DAY * 1 },
      { name: 'customers_valid_email_format', testDefinition: 'columnValuesToMatchRegex', testCaseStatus: 'Failed', timestamp: now - DAY * 1 },
    ]);
    this.qualityTests.set('tbl-002', [
      { name: 'orders_positive_total', testDefinition: 'columnValuesToBeBetween', testCaseStatus: 'Success', timestamp: now - DAY * 2 },
      { name: 'orders_not_null_status', testDefinition: 'columnValuesToBeNotNull', testCaseStatus: 'Success', timestamp: now - DAY * 2 },
    ]);

    this.seeded = true;
  }

  /** List all databases. */
  listDatabases(): OMDatabase[] {
    return Array.from(this.databases.values());
  }

  /** List tables in a database. */
  listTables(database: string): OMTable[] {
    const tables = this.tables.get(database);
    if (!tables) {
      throw new Error(`Database not found: ${database}`);
    }
    return tables;
  }

  /** Get a specific table by ID. */
  getTable(tableId: string): OMTable {
    const table = this.tablesById.get(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }
    return table;
  }

  /** Search tables by query string. */
  searchTables(query: string): OMTable[] {
    const results: OMTable[] = [];
    const q = query.toLowerCase();
    for (const tables of this.tables.values()) {
      for (const table of tables) {
        if (
          table.name.toLowerCase().includes(q) ||
          table.fullyQualifiedName.toLowerCase().includes(q) ||
          table.columns.some((c) => c.name.toLowerCase().includes(q))
        ) {
          results.push(table);
        }
      }
    }
    return results;
  }

  /** Get lineage graph for a table. */
  getLineage(tableId: string, _direction: 'upstream' | 'downstream', _depth?: number): OMLineageGraph {
    const graph = this.lineageGraphs.get(tableId);
    if (!graph) {
      return { entity: tableId, nodes: [], upstreamEdges: [], downstreamEdges: [] };
    }
    return graph;
  }

  /** Get quality test results for a table. */
  getQualityTests(tableId: string): OMQualityTestResult[] {
    return this.qualityTests.get(tableId) ?? [];
  }
}
