/**
 * Stubbed Google Cloud Dataplex client.
 * Uses in-memory stores to simulate Dataplex APIs.
 */

import type {
  IDataplexClient,
  DataplexLake,
  DataplexZone,
  DataplexEntity,
  DataplexEntry,
  DataplexField,
} from './types.js';

export class DataplexStubClient implements IDataplexClient {
  private lakes: DataplexLake[] = [];
  private zones: Map<string, DataplexZone[]> = new Map();
  private entities: Map<string, DataplexEntity[]> = new Map();
  private allEntities: Map<string, DataplexEntity> = new Map();
  private seeded = false;

  /** Pre-load with realistic Dataplex metadata. */
  seed(): void {
    if (this.seeded) return;

    const now = new Date().toISOString();

    // --- Helper ---
    const field = (name: string, type: string, mode: string, description: string): DataplexField =>
      ({ name, type, mode, description });

    // --- Lakes ---
    this.lakes = [
      { name: 'projects/my-project/locations/us-central1/lakes/analytics-lake', displayName: 'Analytics Lake', state: 'ACTIVE', createTime: now, metastore: 'projects/my-project/locations/us-central1/services/analytics-metastore' },
      { name: 'projects/my-project/locations/us-central1/lakes/raw-lake', displayName: 'Raw Data Lake', state: 'ACTIVE', createTime: now, metastore: '' },
    ];

    // --- Zones ---
    this.zones.set('projects/my-project/locations/us-central1/lakes/analytics-lake', [
      { name: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone', displayName: 'Curated Zone', type: 'CURATED', lake: 'analytics-lake' },
      { name: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/raw-zone', displayName: 'Raw Zone', type: 'RAW', lake: 'analytics-lake' },
    ]);
    this.zones.set('projects/my-project/locations/us-central1/lakes/raw-lake', [
      { name: 'projects/my-project/locations/us-central1/lakes/raw-lake/zones/ingestion-zone', displayName: 'Ingestion Zone', type: 'RAW', lake: 'raw-lake' },
    ]);

    // --- Entities ---
    const curatedEntities: DataplexEntity[] = [
      {
        name: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone/entities/customers',
        displayName: 'customers', type: 'TABLE', system: 'BigQuery',
        schema: { fields: [
          field('customer_id', 'INT64', 'REQUIRED', 'Customer ID'),
          field('name', 'STRING', 'REQUIRED', 'Customer name'),
          field('email', 'STRING', 'REQUIRED', 'Email address'),
          field('created_at', 'TIMESTAMP', 'REQUIRED', 'Creation time'),
        ] },
        dataPath: 'gs://analytics-lake/curated/customers/', createTime: now,
      },
      {
        name: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone/entities/orders',
        displayName: 'orders', type: 'TABLE', system: 'BigQuery',
        schema: { fields: [
          field('order_id', 'INT64', 'REQUIRED', 'Order ID'),
          field('customer_id', 'INT64', 'REQUIRED', 'Customer ID'),
          field('total_amount', 'FLOAT64', 'REQUIRED', 'Total amount'),
          field('order_date', 'DATE', 'REQUIRED', 'Order date'),
          field('status', 'STRING', 'REQUIRED', 'Order status'),
        ] },
        dataPath: 'gs://analytics-lake/curated/orders/', createTime: now,
      },
      {
        name: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone/entities/daily_metrics',
        displayName: 'daily_metrics', type: 'TABLE', system: 'BigQuery',
        schema: { fields: [
          field('date', 'DATE', 'REQUIRED', 'Metric date'),
          field('revenue', 'FLOAT64', 'REQUIRED', 'Daily revenue'),
          field('order_count', 'INT64', 'REQUIRED', 'Number of orders'),
        ] },
        dataPath: 'gs://analytics-lake/curated/daily_metrics/', createTime: now,
      },
    ];

    const rawEntities: DataplexEntity[] = [
      {
        name: 'projects/my-project/locations/us-central1/lakes/analytics-lake/zones/raw-zone/entities/raw_events',
        displayName: 'raw_events', type: 'FILESET', system: 'CloudStorage',
        schema: { fields: [
          field('event_id', 'STRING', 'REQUIRED', 'Event ID'),
          field('event_type', 'STRING', 'REQUIRED', 'Event type'),
          field('payload', 'STRING', 'NULLABLE', 'JSON payload'),
        ] },
        dataPath: 'gs://analytics-lake/raw/events/', createTime: now,
      },
    ];

    const ingestionEntities: DataplexEntity[] = [
      {
        name: 'projects/my-project/locations/us-central1/lakes/raw-lake/zones/ingestion-zone/entities/clickstream',
        displayName: 'clickstream', type: 'FILESET', system: 'CloudStorage',
        schema: { fields: [
          field('click_id', 'STRING', 'REQUIRED', 'Click ID'),
          field('session_id', 'STRING', 'REQUIRED', 'Session ID'),
          field('url', 'STRING', 'REQUIRED', 'URL'),
          field('timestamp', 'TIMESTAMP', 'REQUIRED', 'Click time'),
        ] },
        dataPath: 'gs://raw-lake/ingestion/clickstream/', createTime: now,
      },
      {
        name: 'projects/my-project/locations/us-central1/lakes/raw-lake/zones/ingestion-zone/entities/server_logs',
        displayName: 'server_logs', type: 'FILESET', system: 'CloudStorage',
        schema: { fields: [
          field('log_id', 'STRING', 'REQUIRED', 'Log ID'),
          field('level', 'STRING', 'REQUIRED', 'Log level'),
          field('message', 'STRING', 'REQUIRED', 'Log message'),
          field('timestamp', 'TIMESTAMP', 'REQUIRED', 'Log time'),
        ] },
        dataPath: 'gs://raw-lake/ingestion/server_logs/', createTime: now,
      },
    ];

    this.entities.set('projects/my-project/locations/us-central1/lakes/analytics-lake/zones/curated-zone', curatedEntities);
    this.entities.set('projects/my-project/locations/us-central1/lakes/analytics-lake/zones/raw-zone', rawEntities);
    this.entities.set('projects/my-project/locations/us-central1/lakes/raw-lake/zones/ingestion-zone', ingestionEntities);

    // Index all entities by name
    for (const entityList of [curatedEntities, rawEntities, ingestionEntities]) {
      for (const entity of entityList) {
        this.allEntities.set(entity.name, entity);
      }
    }

    this.seeded = true;
  }

  /** List all lakes. */
  listLakes(): DataplexLake[] {
    return this.lakes;
  }

  /** List zones in a lake. */
  listZones(lake: string): DataplexZone[] {
    const zones = this.zones.get(lake);
    if (!zones) {
      throw new Error(`Lake not found: ${lake}`);
    }
    return zones;
  }

  /** List entities in a zone. */
  listEntities(zone: string): DataplexEntity[] {
    const entities = this.entities.get(zone);
    if (!entities) {
      throw new Error(`Zone not found: ${zone}`);
    }
    return entities;
  }

  /** Get a specific entity by name. */
  getEntity(name: string): DataplexEntity {
    const entity = this.allEntities.get(name);
    if (!entity) {
      throw new Error(`Entity not found: ${name}`);
    }
    return entity;
  }

  /** Search entries by query. */
  searchEntries(query: string): DataplexEntry[] {
    const q = query.toLowerCase();
    const results: DataplexEntry[] = [];
    for (const entity of this.allEntities.values()) {
      if (
        entity.displayName.toLowerCase().includes(q) ||
        entity.dataPath.toLowerCase().includes(q) ||
        entity.system.toLowerCase().includes(q)
      ) {
        results.push({
          name: entity.name,
          entryType: entity.type,
          fullyQualifiedName: `${entity.system}:${entity.displayName}`,
        });
      }
    }
    return results;
  }
}
