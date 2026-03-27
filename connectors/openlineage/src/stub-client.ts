/**
 * Stubbed Marquez/OpenLineage client.
 * Uses in-memory stores to simulate Marquez REST API and OpenLineage events.
 */

import type {
  IMarquezClient,
  MarquezNamespace,
  MarquezDataset,
  DatasetField,
  MarquezJob,
  MarquezLineageGraph,
  MarquezLineageNode,
  OpenLineageRunEvent,
} from './types.js';

export class MarquezStubClient implements IMarquezClient {
  private namespaces: Map<string, MarquezNamespace> = new Map();
  private datasets: Map<string, MarquezDataset[]> = new Map();
  private jobs: Map<string, MarquezJob[]> = new Map();
  private lineageGraphs: Map<string, MarquezLineageGraph> = new Map();
  private emittedEvents: OpenLineageRunEvent[] = [];
  private seeded = false;

  /** Pre-load with realistic Marquez data. */
  seed(): void {
    if (this.seeded) return;

    const now = Date.now();
    const DAY = 86_400_000;

    // --- Helper ---
    const field = (name: string, type: string, description: string): DatasetField => ({
      name, type, description,
    });

    // --- Namespaces ---
    this.namespaces.set('default', {
      name: 'default',
      createdAt: now - DAY * 365,
      ownerName: 'data_platform',
    });
    this.namespaces.set('etl_pipeline', {
      name: 'etl_pipeline',
      createdAt: now - DAY * 200,
      ownerName: 'data_engineering',
    });
    this.namespaces.set('analytics', {
      name: 'analytics',
      createdAt: now - DAY * 150,
      ownerName: 'analytics_team',
    });

    // --- Datasets: default ---
    this.datasets.set('default', [
      {
        name: 'raw_orders',
        namespace: 'default',
        sourceName: 'postgres_prod',
        fields: [
          field('order_id', 'BIGINT', 'Order identifier'),
          field('customer_id', 'BIGINT', 'Customer FK'),
          field('order_date', 'DATE', 'Date of order'),
          field('total', 'DECIMAL', 'Order total'),
        ],
        createdAt: now - DAY * 300,
      },
      {
        name: 'raw_customers',
        namespace: 'default',
        sourceName: 'postgres_prod',
        fields: [
          field('customer_id', 'BIGINT', 'Customer identifier'),
          field('email', 'VARCHAR', 'Customer email'),
          field('name', 'VARCHAR', 'Customer name'),
        ],
        createdAt: now - DAY * 300,
      },
      {
        name: 'raw_products',
        namespace: 'default',
        sourceName: 'postgres_prod',
        fields: [
          field('product_id', 'BIGINT', 'Product identifier'),
          field('name', 'VARCHAR', 'Product name'),
          field('category', 'VARCHAR', 'Category'),
          field('price', 'DECIMAL', 'Unit price'),
        ],
        createdAt: now - DAY * 280,
      },
    ]);

    // --- Datasets: etl_pipeline ---
    this.datasets.set('etl_pipeline', [
      {
        name: 'cleaned_orders',
        namespace: 'etl_pipeline',
        sourceName: 'spark_warehouse',
        fields: [
          field('order_id', 'BIGINT', 'Cleaned order ID'),
          field('customer_id', 'BIGINT', 'Customer FK'),
          field('order_date', 'DATE', 'Validated date'),
          field('total', 'DECIMAL', 'Validated total'),
          field('status', 'VARCHAR', 'Order status'),
        ],
        createdAt: now - DAY * 180,
      },
      {
        name: 'enriched_customers',
        namespace: 'etl_pipeline',
        sourceName: 'spark_warehouse',
        fields: [
          field('customer_id', 'BIGINT', 'Customer ID'),
          field('email', 'VARCHAR', 'Email'),
          field('name', 'VARCHAR', 'Full name'),
          field('segment', 'VARCHAR', 'Computed segment'),
          field('lifetime_value', 'DECIMAL', 'Computed LTV'),
        ],
        createdAt: now - DAY * 170,
      },
    ]);

    // --- Datasets: analytics ---
    this.datasets.set('analytics', [
      {
        name: 'daily_revenue',
        namespace: 'analytics',
        sourceName: 'bigquery_analytics',
        fields: [
          field('date', 'DATE', 'Revenue date'),
          field('revenue', 'DECIMAL', 'Daily revenue'),
          field('order_count', 'INTEGER', 'Orders count'),
        ],
        createdAt: now - DAY * 120,
      },
      {
        name: 'customer_segments',
        namespace: 'analytics',
        sourceName: 'bigquery_analytics',
        fields: [
          field('segment', 'VARCHAR', 'Segment name'),
          field('customer_count', 'INTEGER', 'Customers in segment'),
          field('avg_ltv', 'DECIMAL', 'Average LTV'),
        ],
        createdAt: now - DAY * 100,
      },
      {
        name: 'product_performance',
        namespace: 'analytics',
        sourceName: 'bigquery_analytics',
        fields: [
          field('product_id', 'BIGINT', 'Product ID'),
          field('total_sales', 'DECIMAL', 'Total sales'),
          field('units_sold', 'INTEGER', 'Units sold'),
        ],
        createdAt: now - DAY * 90,
      },
    ]);

    // --- Jobs ---
    this.jobs.set('etl_pipeline', [
      {
        name: 'clean_orders_job',
        namespace: 'etl_pipeline',
        type: 'BATCH',
        inputs: ['default.raw_orders'],
        outputs: ['etl_pipeline.cleaned_orders'],
        createdAt: now - DAY * 180,
      },
      {
        name: 'enrich_customers_job',
        namespace: 'etl_pipeline',
        type: 'BATCH',
        inputs: ['default.raw_customers', 'default.raw_orders'],
        outputs: ['etl_pipeline.enriched_customers'],
        createdAt: now - DAY * 170,
      },
      {
        name: 'compute_revenue_job',
        namespace: 'etl_pipeline',
        type: 'BATCH',
        inputs: ['etl_pipeline.cleaned_orders'],
        outputs: ['analytics.daily_revenue'],
        createdAt: now - DAY * 120,
      },
    ]);
    this.jobs.set('analytics', [
      {
        name: 'segment_customers_job',
        namespace: 'analytics',
        type: 'BATCH',
        inputs: ['etl_pipeline.enriched_customers'],
        outputs: ['analytics.customer_segments'],
        createdAt: now - DAY * 100,
      },
      {
        name: 'product_analysis_job',
        namespace: 'analytics',
        type: 'BATCH',
        inputs: ['etl_pipeline.cleaned_orders', 'default.raw_products'],
        outputs: ['analytics.product_performance'],
        createdAt: now - DAY * 90,
      },
    ]);

    // --- Lineage Graphs ---
    const revenueLineage: MarquezLineageNode[] = [
      {
        id: 'dataset:default.raw_orders',
        type: 'DATASET',
        data: { name: 'raw_orders', namespace: 'default' },
        inEdges: [],
        outEdges: [{ destination: 'job:etl_pipeline.clean_orders_job' }],
      },
      {
        id: 'job:etl_pipeline.clean_orders_job',
        type: 'JOB',
        data: { name: 'clean_orders_job', namespace: 'etl_pipeline' },
        inEdges: [{ origin: 'dataset:default.raw_orders' }],
        outEdges: [{ destination: 'dataset:etl_pipeline.cleaned_orders' }],
      },
      {
        id: 'dataset:etl_pipeline.cleaned_orders',
        type: 'DATASET',
        data: { name: 'cleaned_orders', namespace: 'etl_pipeline' },
        inEdges: [{ origin: 'job:etl_pipeline.clean_orders_job' }],
        outEdges: [{ destination: 'job:etl_pipeline.compute_revenue_job' }],
      },
      {
        id: 'job:etl_pipeline.compute_revenue_job',
        type: 'JOB',
        data: { name: 'compute_revenue_job', namespace: 'etl_pipeline' },
        inEdges: [{ origin: 'dataset:etl_pipeline.cleaned_orders' }],
        outEdges: [{ destination: 'dataset:analytics.daily_revenue' }],
      },
      {
        id: 'dataset:analytics.daily_revenue',
        type: 'DATASET',
        data: { name: 'daily_revenue', namespace: 'analytics' },
        inEdges: [{ origin: 'job:etl_pipeline.compute_revenue_job' }],
        outEdges: [],
      },
    ];
    this.lineageGraphs.set('dataset:analytics.daily_revenue', { graph: revenueLineage });
    this.lineageGraphs.set('dataset:default.raw_orders', { graph: revenueLineage });

    this.seeded = true;
  }

  /** List all namespaces. */
  listNamespaces(): MarquezNamespace[] {
    return Array.from(this.namespaces.values());
  }

  /** List datasets in a namespace. */
  listDatasets(namespace: string): MarquezDataset[] {
    const datasets = this.datasets.get(namespace);
    if (!datasets) {
      throw new Error(`Namespace not found: ${namespace}`);
    }
    return datasets;
  }

  /** List jobs in a namespace. */
  listJobs(namespace: string): MarquezJob[] {
    return this.jobs.get(namespace) ?? [];
  }

  /** Get lineage graph for a node. */
  getLineage(nodeId: string, _depth?: number): MarquezLineageGraph {
    return this.lineageGraphs.get(nodeId) ?? { graph: [] };
  }

  /** Record an emitted run event. */
  emitRunEvent(event: OpenLineageRunEvent): void {
    this.emittedEvents.push(event);
  }

  /** Get emitted events (for testing). */
  getEmittedEvents(): OpenLineageRunEvent[] {
    return this.emittedEvents;
  }
}
