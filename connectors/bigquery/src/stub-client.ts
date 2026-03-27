/**
 * Stubbed BigQuery API client.
 * Uses an in-memory store to simulate the BigQuery API.
 */

import type {
  BQDataset,
  BQTable,
  BQTableSchema,
  BQJob,
  BQCostEstimate,
} from './types.js';

export class BigQueryStubClient {
  private datasets: Map<string, BQDataset> = new Map();
  private tables: Map<string, BQTable> = new Map();
  private schemas: Map<string, BQTableSchema> = new Map();
  private jobs: BQJob[] = [];
  private seeded = false;

  /** Pre-load with realistic data simulating a BigQuery project. */
  seed(): void {
    if (this.seeded) return;

    const now = Date.now();
    const DAY = 86_400_000;

    // --- Datasets ---
    this.datasets.set('analytics', {
      datasetId: 'analytics',
      projectId: 'my-project',
      location: 'US',
      createdAt: now - DAY * 90,
      description: 'Core analytics tables',
    });

    this.datasets.set('raw_events', {
      datasetId: 'raw_events',
      projectId: 'my-project',
      location: 'US',
      createdAt: now - DAY * 120,
      description: 'Raw event ingestion tables',
    });

    // --- analytics.orders ---
    this.tables.set('analytics.orders', {
      tableId: 'orders',
      datasetId: 'analytics',
      projectId: 'my-project',
      type: 'TABLE',
      numRows: 10_000_000,
      numBytes: 5_000_000_000,
      createdAt: now - DAY * 60,
    });
    this.schemas.set('analytics.orders', {
      datasetId: 'analytics',
      tableId: 'orders',
      lastModified: now - DAY * 1,
      columns: [
        { name: 'order_id', type: 'INT64', mode: 'REQUIRED', description: 'Primary key' },
        { name: 'customer_id', type: 'INT64', mode: 'REQUIRED', description: 'FK to customers' },
        { name: 'order_date', type: 'DATE', mode: 'REQUIRED', description: 'Date of order' },
        { name: 'total_amount', type: 'NUMERIC', mode: 'REQUIRED', description: 'Order total' },
        { name: 'status', type: 'STRING', mode: 'REQUIRED', description: 'Order status' },
      ],
    });

    // --- analytics.customers ---
    this.tables.set('analytics.customers', {
      tableId: 'customers',
      datasetId: 'analytics',
      projectId: 'my-project',
      type: 'TABLE',
      numRows: 2_000_000,
      numBytes: 800_000_000,
      createdAt: now - DAY * 80,
    });
    this.schemas.set('analytics.customers', {
      datasetId: 'analytics',
      tableId: 'customers',
      lastModified: now - DAY * 2,
      columns: [
        { name: 'customer_id', type: 'INT64', mode: 'REQUIRED', description: 'Primary key' },
        { name: 'email', type: 'STRING', mode: 'REQUIRED', description: 'Email address' },
        { name: 'name', type: 'STRING', mode: 'REQUIRED', description: 'Full name' },
        { name: 'signup_date', type: 'DATE', mode: 'REQUIRED', description: 'Registration date' },
      ],
    });

    // --- analytics.revenue_daily (VIEW) ---
    this.tables.set('analytics.revenue_daily', {
      tableId: 'revenue_daily',
      datasetId: 'analytics',
      projectId: 'my-project',
      type: 'VIEW',
      numRows: 0,
      numBytes: 0,
      createdAt: now - DAY * 30,
    });
    this.schemas.set('analytics.revenue_daily', {
      datasetId: 'analytics',
      tableId: 'revenue_daily',
      lastModified: now - DAY * 3,
      columns: [
        { name: 'date', type: 'DATE', mode: 'REQUIRED', description: 'Revenue date' },
        { name: 'total_revenue', type: 'NUMERIC', mode: 'NULLABLE', description: 'Daily revenue' },
        { name: 'order_count', type: 'INT64', mode: 'NULLABLE', description: 'Number of orders' },
      ],
    });

    // --- raw_events.page_views ---
    this.tables.set('raw_events.page_views', {
      tableId: 'page_views',
      datasetId: 'raw_events',
      projectId: 'my-project',
      type: 'TABLE',
      numRows: 100_000_000,
      numBytes: 50_000_000_000,
      createdAt: now - DAY * 100,
    });
    this.schemas.set('raw_events.page_views', {
      datasetId: 'raw_events',
      tableId: 'page_views',
      lastModified: now - DAY * 1,
      columns: [
        { name: 'event_id', type: 'STRING', mode: 'REQUIRED', description: 'UUID' },
        { name: 'user_id', type: 'INT64', mode: 'REQUIRED', description: 'User identifier' },
        { name: 'page_url', type: 'STRING', mode: 'REQUIRED', description: 'Page URL visited' },
        { name: 'referrer', type: 'STRING', mode: 'NULLABLE', description: 'Referrer URL' },
        { name: 'event_ts', type: 'TIMESTAMP', mode: 'REQUIRED', description: 'Event timestamp' },
        { name: 'user_agent', type: 'STRING', mode: 'NULLABLE', description: 'Browser user agent' },
      ],
    });

    // --- raw_events.click_events ---
    this.tables.set('raw_events.click_events', {
      tableId: 'click_events',
      datasetId: 'raw_events',
      projectId: 'my-project',
      type: 'TABLE',
      numRows: 80_000_000,
      numBytes: 35_000_000_000,
      createdAt: now - DAY * 95,
    });
    this.schemas.set('raw_events.click_events', {
      datasetId: 'raw_events',
      tableId: 'click_events',
      lastModified: now - DAY * 1,
      columns: [
        { name: 'event_id', type: 'STRING', mode: 'REQUIRED', description: 'UUID' },
        { name: 'user_id', type: 'INT64', mode: 'REQUIRED', description: 'User identifier' },
        { name: 'element_id', type: 'STRING', mode: 'REQUIRED', description: 'Clicked element ID' },
        { name: 'page_url', type: 'STRING', mode: 'REQUIRED', description: 'Page URL' },
        { name: 'event_ts', type: 'TIMESTAMP', mode: 'REQUIRED', description: 'Event timestamp' },
      ],
    });

    // --- Job history ---
    this.jobs = [
      {
        jobId: 'job_001',
        queryText: 'SELECT * FROM analytics.orders LIMIT 100',
        status: 'DONE',
        totalBytesProcessed: 5_000_000_000,
        totalSlotMs: 12_000,
        createdAt: now - DAY * 5,
        user: 'analyst@company.com',
      },
      {
        jobId: 'job_002',
        queryText: 'SELECT customer_id, COUNT(*) FROM analytics.orders GROUP BY 1',
        status: 'DONE',
        totalBytesProcessed: 1_200_000_000,
        totalSlotMs: 8_000,
        createdAt: now - DAY * 4,
        user: 'analyst@company.com',
      },
      {
        jobId: 'job_003',
        queryText: 'SELECT * FROM raw_events.page_views WHERE event_ts > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)',
        status: 'DONE',
        totalBytesProcessed: 50_000_000_000,
        totalSlotMs: 45_000,
        createdAt: now - DAY * 3,
        user: 'data-eng@company.com',
      },
      {
        jobId: 'job_004',
        queryText: 'SELECT date, total_revenue FROM analytics.revenue_daily ORDER BY date DESC LIMIT 30',
        status: 'DONE',
        totalBytesProcessed: 500_000,
        totalSlotMs: 2_000,
        createdAt: now - DAY * 2,
        user: 'analyst@company.com',
      },
      {
        jobId: 'job_005',
        queryText: 'CREATE TABLE analytics.orders_backup AS SELECT * FROM analytics.orders',
        status: 'DONE',
        totalBytesProcessed: 5_000_000_000,
        totalSlotMs: 60_000,
        createdAt: now - DAY * 1,
        user: 'data-eng@company.com',
      },
    ];

    this.seeded = true;
  }

  /** List all datasets. */
  listDatasets(): BQDataset[] {
    return Array.from(this.datasets.values());
  }

  /** List tables in a dataset. */
  listTables(datasetId: string): BQTable[] {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }
    const prefix = `${datasetId}.`;
    const results: BQTable[] = [];
    for (const [key, table] of this.tables.entries()) {
      if (key.startsWith(prefix)) {
        results.push(table);
      }
    }
    return results;
  }

  /** Get schema for a table. */
  getTableSchema(datasetId: string, tableId: string): BQTableSchema {
    const key = `${datasetId}.${tableId}`;
    const schema = this.schemas.get(key);
    if (!schema) {
      throw new Error(`Table not found: ${key}`);
    }
    return schema;
  }

  /** Get job history, optionally limited. */
  getJobHistory(limit?: number): BQJob[] {
    const sorted = [...this.jobs].sort((a, b) => b.createdAt - a.createdAt);
    if (limit !== undefined && limit > 0) {
      return sorted.slice(0, limit);
    }
    return sorted;
  }

  /** Estimate cost for a query. */
  estimateQueryCost(queryText: string): BQCostEstimate {
    // Simulate cost estimation based on query complexity
    const lowerQuery = queryText.toLowerCase();
    let estimatedBytes: number;

    if (lowerQuery.includes('select *') || lowerQuery.includes('create table')) {
      // Full table scan — expensive
      estimatedBytes = 10_000_000_000; // 10 GB
    } else if (lowerQuery.includes('count(') || lowerQuery.includes('group by')) {
      // Aggregation — moderate
      estimatedBytes = 1_000_000_000; // 1 GB
    } else {
      // Simple query — cheap
      estimatedBytes = 100_000_000; // 100 MB
    }

    // On-demand pricing: $5 per TB processed
    const COST_PER_BYTE = 5 / (1024 * 1024 * 1024 * 1024);
    const estimatedCost = estimatedBytes * COST_PER_BYTE;

    return {
      queryText,
      estimatedBytesProcessed: estimatedBytes,
      estimatedCostUSD: Math.round(estimatedCost * 10000) / 10000,
      tier: 'on-demand',
    };
  }
}
