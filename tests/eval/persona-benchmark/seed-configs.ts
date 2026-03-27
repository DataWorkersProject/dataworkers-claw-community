/**
 * Persona-based AI Eval Benchmark — Seed Configuration
 *
 * Maps known entities for each seed dataset. Entity names are extracted
 * from the actual stub implementations in the codebase:
 *   - core/infrastructure-stubs/src/vector-store.ts  (getSeedAssets)
 *   - core/infrastructure-stubs/src/graph-db.ts      (InMemoryGraphDB.seed)
 *   - connectors/openmetadata/src/stub-client.ts     (OpenMetadataStubClient.seed)
 *   - connectors/dbt/src/stub-client.ts              (DbtCloudStubClient.seed)
 */

import type { SeedDataset } from './types.js';

// ---------------------------------------------------------------------------
// Seed entity catalogue
// ---------------------------------------------------------------------------

export interface SeedEntityMap {
  tables: string[];
  metrics: string[];
  pipelines: string[];
  columns: Record<string, string[]>;
}

/**
 * SEED_ENTITIES maps each seed dataset to its known tables, metrics,
 * pipelines, and per-table columns. These are the ground-truth entities
 * that scoring functions compare responses against.
 */
export const SEED_ENTITIES: Record<SeedDataset, SeedEntityMap> = {
  /**
   * jaffle-shop seed — sourced from vector-store getSeedAssets(),
   * graph-db seed(), and dbt stub-client seed().
   */
  'jaffle-shop': {
    tables: [
      // Vector store seed assets (tables)
      'orders',
      'customers',
      'daily_revenue',
      'user_events',
      'product_catalog',
      'payment_transactions',
      'inventory_levels',
      // Graph DB source tables
      'raw_orders',
      'raw_customers',
      'raw_events',
      // Graph DB staging models
      'stg_orders',
      'stg_customers',
      'stg_events',
      // Graph DB mart models
      'dim_orders',
      'dim_customers',
      'fct_events',
      // dbt stub models
      'int_order_items',
      'fct_orders',
      // Alias used by canonical tool args (assetId: 'fact_orders')
      'fact_orders',
      // Dashboards (treated as assets)
      'Revenue Dashboard',
      'Customer Analytics',
    ],
    metrics: [
      'monthly_active_users',
      'churn_prediction',
    ],
    pipelines: [
      'etl_orders_daily',
      'sync_customers_crm',
    ],
    columns: {
      orders: ['id', 'customer_id', 'amount', 'order_date', 'status'],
      customers: ['id', 'name', 'email', 'created_at', 'segment'],
      daily_revenue: ['date', 'revenue', 'order_count', 'avg_order_value'],
      user_events: ['event_id', 'user_id', 'event_type', 'timestamp', 'properties'],
      raw_orders: ['order_id', 'customer_id', 'amount', 'order_date', 'status'],
      raw_customers: ['customer_id', 'name', 'email', 'created_at'],
      stg_orders: ['order_id', 'customer_id', 'order_date', 'status'],
      stg_customers: ['customer_id', 'name', 'email'],
      fct_orders: ['order_id', 'customer_id', 'order_total', 'order_date'],
      dim_customers: ['customer_id', 'name', 'total_orders', 'first_order_date'],
      int_order_items: ['order_id', 'item_total'],
    },
  },

  /**
   * openmetadata seed — sourced from connectors/openmetadata/src/stub-client.ts.
   * Databases: warehouse_db (snowflake), analytics_db (bigquery).
   */
  'openmetadata': {
    tables: [
      // warehouse_db tables
      'customers',
      'orders',
      'products',
      // analytics_db tables
      'daily_revenue',
      'user_metrics',
      'conversion_funnel',
    ],
    metrics: [],
    pipelines: [],
    columns: {
      customers: ['customer_id', 'email', 'name', 'segment', 'created_at'],
      orders: ['order_id', 'customer_id', 'order_date', 'total', 'status'],
      products: ['product_id', 'name', 'category', 'price'],
      daily_revenue: ['date', 'revenue', 'order_count', 'region'],
      user_metrics: ['user_id', 'sessions', 'page_views', 'last_active'],
      conversion_funnel: ['step', 'users', 'conversion_rate', 'date'],
    },
  },
};

// ---------------------------------------------------------------------------
// Convenience accessors
// ---------------------------------------------------------------------------

/** Return all known entity names (tables + metrics + pipelines) for a seed. */
export function getAllEntityNames(seed: SeedDataset): string[] {
  const s = SEED_ENTITIES[seed];
  return [...s.tables, ...s.metrics, ...s.pipelines];
}

/** Check whether a name is a known entity in the given seed. */
export function isKnownEntity(name: string, seed: SeedDataset): boolean {
  const all = getAllEntityNames(seed);
  const lower = name.toLowerCase();
  return all.some((e) => e.toLowerCase() === lower);
}
