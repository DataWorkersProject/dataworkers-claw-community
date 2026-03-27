/**
 * Stubbed DataHub client.
 * Uses in-memory stores to simulate DataHub GraphQL API.
 */

import type {
  IDataHubClient,
  DataHubDataset,
  DataHubDomain,
  DataHubLineageResult,
  DataHubLineageEntity,
} from './types.js';

export class DataHubStubClient implements IDataHubClient {
  private datasets: Map<string, DataHubDataset> = new Map();
  private domains: DataHubDomain[] = [];
  private lineageEdges: Map<string, { upstream: DataHubLineageEntity[]; downstream: DataHubLineageEntity[] }> = new Map();
  private seeded = false;

  /** Pre-load with realistic DataHub metadata. */
  seed(): void {
    if (this.seeded) return;

    // --- Domains ---
    this.domains = [
      { urn: 'urn:li:domain:marketing', name: 'Marketing', description: 'Marketing analytics domain' },
      { urn: 'urn:li:domain:finance', name: 'Finance', description: 'Finance and billing domain' },
      { urn: 'urn:li:domain:engineering', name: 'Engineering', description: 'Engineering platform domain' },
    ];

    // --- Datasets ---
    const ds = (
      urn: string, name: string, platform: string, description: string,
      schema: DataHubDataset['schema'], tags: string[], domain: string,
    ): DataHubDataset => ({ urn, name, platform, description, schema, tags, domain });

    const datasets: DataHubDataset[] = [
      ds(
        'urn:li:dataset:(urn:li:dataPlatform:kafka,user_clicks,PROD)',
        'user_clicks', 'kafka', 'Kafka topic for user click events',
        [
          { fieldPath: 'user_id', type: 'STRING', description: 'User identifier', nullable: false },
          { fieldPath: 'event_type', type: 'STRING', description: 'Click event type', nullable: false },
          { fieldPath: 'timestamp', type: 'LONG', description: 'Event timestamp', nullable: false },
          { fieldPath: 'url', type: 'STRING', description: 'Clicked URL', nullable: true },
        ],
        ['pii', 'clickstream'], 'Marketing',
      ),
      ds(
        'urn:li:dataset:(urn:li:dataPlatform:kafka,page_views,PROD)',
        'page_views', 'kafka', 'Kafka topic for page view events',
        [
          { fieldPath: 'session_id', type: 'STRING', description: 'Session ID', nullable: false },
          { fieldPath: 'page_url', type: 'STRING', description: 'Page URL', nullable: false },
          { fieldPath: 'duration_ms', type: 'LONG', description: 'Time on page', nullable: true },
        ],
        ['clickstream'], 'Marketing',
      ),
      ds(
        'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.orders,PROD)',
        'analytics.public.orders', 'snowflake', 'Orders fact table',
        [
          { fieldPath: 'order_id', type: 'NUMBER', description: 'Order ID', nullable: false },
          { fieldPath: 'customer_id', type: 'NUMBER', description: 'Customer ID', nullable: false },
          { fieldPath: 'total_amount', type: 'DECIMAL', description: 'Order total', nullable: false },
          { fieldPath: 'order_date', type: 'DATE', description: 'Order date', nullable: false },
          { fieldPath: 'status', type: 'STRING', description: 'Order status', nullable: false },
        ],
        ['revenue', 'core'], 'Finance',
      ),
      ds(
        'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.customers,PROD)',
        'analytics.public.customers', 'snowflake', 'Customer dimension table',
        [
          { fieldPath: 'customer_id', type: 'NUMBER', description: 'Customer ID', nullable: false },
          { fieldPath: 'email', type: 'STRING', description: 'Email address', nullable: false },
          { fieldPath: 'name', type: 'STRING', description: 'Full name', nullable: false },
        ],
        ['pii', 'core'], 'Finance',
      ),
      ds(
        'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.marts.daily_revenue,PROD)',
        'analytics.marts.daily_revenue', 'snowflake', 'Daily revenue aggregation',
        [
          { fieldPath: 'date', type: 'DATE', description: 'Revenue date', nullable: false },
          { fieldPath: 'revenue', type: 'DECIMAL', description: 'Total revenue', nullable: false },
          { fieldPath: 'order_count', type: 'NUMBER', description: 'Number of orders', nullable: false },
        ],
        ['revenue', 'aggregation'], 'Finance',
      ),
      ds(
        'urn:li:dataset:(urn:li:dataPlatform:kafka,system_metrics,PROD)',
        'system_metrics', 'kafka', 'System metrics stream',
        [
          { fieldPath: 'host', type: 'STRING', description: 'Host name', nullable: false },
          { fieldPath: 'metric_name', type: 'STRING', description: 'Metric name', nullable: false },
          { fieldPath: 'value', type: 'DOUBLE', description: 'Metric value', nullable: false },
        ],
        ['infra', 'monitoring'], 'Engineering',
      ),
    ];

    for (const d of datasets) {
      this.datasets.set(d.urn, d);
    }

    // --- Lineage edges ---
    const ordersUrn = 'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.orders,PROD)';
    const customersUrn = 'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.public.customers,PROD)';
    const dailyRevenueUrn = 'urn:li:dataset:(urn:li:dataPlatform:snowflake,analytics.marts.daily_revenue,PROD)';
    const clicksUrn = 'urn:li:dataset:(urn:li:dataPlatform:kafka,user_clicks,PROD)';

    this.lineageEdges.set(dailyRevenueUrn, {
      upstream: [
        { urn: ordersUrn, type: 'DATASET', name: 'analytics.public.orders', degree: 1 },
        { urn: customersUrn, type: 'DATASET', name: 'analytics.public.customers', degree: 1 },
      ],
      downstream: [],
    });
    this.lineageEdges.set(ordersUrn, {
      upstream: [
        { urn: clicksUrn, type: 'DATASET', name: 'user_clicks', degree: 1 },
      ],
      downstream: [
        { urn: dailyRevenueUrn, type: 'DATASET', name: 'analytics.marts.daily_revenue', degree: 1 },
      ],
    });
    this.lineageEdges.set(clicksUrn, {
      upstream: [],
      downstream: [
        { urn: ordersUrn, type: 'DATASET', name: 'analytics.public.orders', degree: 1 },
      ],
    });

    this.seeded = true;
  }

  /** Search datasets by name, platform, or tags. */
  searchDatasets(query: string): DataHubDataset[] {
    const q = query.toLowerCase();
    const results: DataHubDataset[] = [];
    for (const dataset of this.datasets.values()) {
      if (
        dataset.name.toLowerCase().includes(q) ||
        dataset.platform.toLowerCase().includes(q) ||
        dataset.description.toLowerCase().includes(q) ||
        dataset.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        results.push(dataset);
      }
    }
    return results;
  }

  /** Get a specific dataset by URN. */
  getDataset(urn: string): DataHubDataset {
    const dataset = this.datasets.get(urn);
    if (!dataset) {
      throw new Error(`Dataset not found: ${urn}`);
    }
    return dataset;
  }

  /** Get lineage for a dataset. */
  getLineage(urn: string, direction: 'upstream' | 'downstream'): DataHubLineageResult {
    const edges = this.lineageEdges.get(urn);
    return {
      urn,
      direction,
      entities: edges ? edges[direction] : [],
    };
  }

  /** List all domains. */
  listDomains(): DataHubDomain[] {
    return this.domains;
  }
}
