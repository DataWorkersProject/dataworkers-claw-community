/**
 * In-memory vector store stub for development and testing.
 * Supports cosine similarity search over 384-dimensional vectors (MiniLM-like).
 */

export interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
  namespace: string;
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

const VECTOR_DIMENSION = 384;

/**
 * Deterministic hash-based vector generator.
 * Produces a consistent 384-dim vector for a given string.
 */
function hashToVector(input: string): number[] {
  const vector: number[] = new Array(VECTOR_DIMENSION);
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < VECTOR_DIMENSION; i++) {
    // Simple deterministic PRNG seeded from hash + index
    hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
    vector[i] = (hash / 0x7fffffff) * 2 - 1; // range [-1, 1]
  }
  // Normalize
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  for (let i = 0; i < VECTOR_DIMENSION; i++) {
    vector[i] /= norm;
  }
  return vector;
}

/** Vectors are pre-normalized by hashToVector, so cosine similarity = dot product. */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

import type { IVectorStore } from './interfaces/index.js';

export class InMemoryVectorStore implements IVectorStore {
  private vectors: Map<string, VectorEntry> = new Map();
  private readonly embeddingModelVersion = 'minilm-v2-stub';

  async upsert(id: string, vector: number[], metadata: Record<string, unknown>, namespace: string): Promise<void> {
    this.vectors.set(`${namespace}:${id}`, { id, vector, metadata: { ...metadata, embeddingModel: this.embeddingModelVersion }, namespace });
  }

  async query(vector: number[], topK: number, namespace: string, filter?: (metadata: Record<string, unknown>) => boolean): Promise<VectorQueryResult[]> {
    const results: VectorQueryResult[] = [];
    for (const entry of this.vectors.values()) {
      if (entry.namespace !== namespace) continue;
      if (filter && !filter(entry.metadata)) continue;
      const score = cosineSimilarity(vector, entry.vector);
      results.push({ id: entry.id, score, metadata: entry.metadata });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async delete(id: string, namespace: string): Promise<boolean> {
    return this.vectors.delete(`${namespace}:${id}`);
  }

  /**
   * Generate a query embedding from text using the same deterministic hash.
   */
  async embed(text: string): Promise<number[]> {
    return hashToVector(text.toLowerCase());
  }

  seed(): void {
    const assets = getSeedAssets();
    for (const asset of assets) {
      const text = `${asset.name} ${asset.description} ${asset.tags.join(' ')}`;
      const vector = hashToVector(text.toLowerCase());
      this.upsert(asset.id, vector, {
        name: asset.name,
        type: asset.type,
        platform: asset.platform,
        description: asset.description,
        tags: asset.tags,
        owner: asset.owner,
        qualityScore: asset.qualityScore,
        freshnessScore: asset.freshnessScore,
        customerId: asset.customerId,
      }, 'catalog');
    }
  }
}

export interface SeedAsset {
  id: string;
  customerId: string;
  name: string;
  type: string;
  platform: string;
  description: string;
  tags: string[];
  owner: string;
  qualityScore: number;
  freshnessScore: number;
}

export function getSeedAssets(): SeedAsset[] {
  return [
    // Original 5 assets the tests depend on
    { id: 'tbl-1', customerId: 'cust-1', name: 'orders', type: 'table', platform: 'snowflake', description: 'Customer orders with line items', tags: ['revenue', 'core'], owner: 'data-team', qualityScore: 95, freshnessScore: 98 },
    { id: 'tbl-2', customerId: 'cust-1', name: 'customers', type: 'table', platform: 'snowflake', description: 'Customer master data with demographics', tags: ['core', 'pii'], owner: 'data-team', qualityScore: 92, freshnessScore: 95 },
    { id: 'tbl-3', customerId: 'cust-1', name: 'daily_revenue', type: 'model', platform: 'dbt', description: 'Daily revenue aggregation by product category', tags: ['revenue', 'metrics'], owner: 'analytics', qualityScore: 88, freshnessScore: 90 },
    { id: 'tbl-4', customerId: 'cust-1', name: 'user_events', type: 'table', platform: 'bigquery', description: 'Raw user interaction events from web and mobile', tags: ['events', 'raw'], owner: 'data-eng', qualityScore: 85, freshnessScore: 99 },
    { id: 'pipe-1', customerId: 'cust-1', name: 'etl_orders_daily', type: 'pipeline', platform: 'airflow', description: 'Daily ETL pipeline for orders data', tags: ['etl', 'orders'], owner: 'data-eng', qualityScore: 90, freshnessScore: 95 },
    // Lineage graph assets
    { id: 'src-raw-orders', customerId: 'cust-1', name: 'raw_orders', type: 'source', platform: 'postgres', description: 'Raw orders source table from production database', tags: ['raw', 'source', 'orders'], owner: 'data-eng', qualityScore: 80, freshnessScore: 92 },
    { id: 'src-raw-customers', customerId: 'cust-1', name: 'raw_customers', type: 'source', platform: 'postgres', description: 'Raw customers source from production database', tags: ['raw', 'source', 'customers'], owner: 'data-eng', qualityScore: 82, freshnessScore: 90 },
    { id: 'src-raw-events', customerId: 'cust-1', name: 'raw_events', type: 'source', platform: 'bigquery', description: 'Raw event stream from analytics pipeline', tags: ['raw', 'source', 'events'], owner: 'data-eng', qualityScore: 78, freshnessScore: 97 },
    { id: 'stg-orders', customerId: 'cust-1', name: 'stg_orders', type: 'model', platform: 'dbt', description: 'Staged orders with cleaned and validated fields', tags: ['staging', 'orders'], owner: 'analytics', qualityScore: 90, freshnessScore: 93 },
    { id: 'stg-customers', customerId: 'cust-1', name: 'stg_customers', type: 'model', platform: 'dbt', description: 'Staged customers with deduplication', tags: ['staging', 'customers'], owner: 'analytics', qualityScore: 91, freshnessScore: 91 },
    { id: 'stg-events', customerId: 'cust-1', name: 'stg_events', type: 'model', platform: 'dbt', description: 'Staged events with session attribution', tags: ['staging', 'events'], owner: 'analytics', qualityScore: 87, freshnessScore: 96 },
    { id: 'mart-dim-orders', customerId: 'cust-1', name: 'dim_orders', type: 'model', platform: 'dbt', description: 'Orders dimension table for analytics', tags: ['mart', 'orders', 'dimension'], owner: 'analytics', qualityScore: 93, freshnessScore: 90 },
    { id: 'mart-dim-customers', customerId: 'cust-1', name: 'dim_customers', type: 'model', platform: 'dbt', description: 'Customer dimension table with segmentation', tags: ['mart', 'customers', 'dimension'], owner: 'analytics', qualityScore: 94, freshnessScore: 88 },
    { id: 'mart-fct-events', customerId: 'cust-1', name: 'fct_events', type: 'model', platform: 'dbt', description: 'Events fact table with aggregated metrics', tags: ['mart', 'events', 'fact'], owner: 'analytics', qualityScore: 89, freshnessScore: 95 },
    { id: 'dash-revenue', customerId: 'cust-1', name: 'Revenue Dashboard', type: 'dashboard', platform: 'looker', description: 'Executive revenue dashboard with KPIs', tags: ['dashboard', 'revenue', 'executive'], owner: 'bi-team', qualityScore: 96, freshnessScore: 85 },
    { id: 'dash-customer-analytics', customerId: 'cust-1', name: 'Customer Analytics', type: 'dashboard', platform: 'looker', description: 'Customer analytics dashboard with cohort analysis', tags: ['dashboard', 'customers', 'analytics'], owner: 'bi-team', qualityScore: 94, freshnessScore: 87 },
    // Additional assets for search quality
    { id: 'tbl-5', customerId: 'cust-1', name: 'product_catalog', type: 'table', platform: 'snowflake', description: 'Product catalog with pricing and categories', tags: ['product', 'core'], owner: 'data-team', qualityScore: 91, freshnessScore: 88 },
    { id: 'tbl-6', customerId: 'cust-1', name: 'payment_transactions', type: 'table', platform: 'snowflake', description: 'Payment transaction records with status', tags: ['payments', 'financial'], owner: 'data-team', qualityScore: 93, freshnessScore: 97 },
    { id: 'pipe-2', customerId: 'cust-1', name: 'sync_customers_crm', type: 'pipeline', platform: 'airflow', description: 'Sync customer data from CRM system', tags: ['sync', 'customers', 'crm'], owner: 'data-eng', qualityScore: 87, freshnessScore: 92 },
    { id: 'tbl-7', customerId: 'cust-1', name: 'inventory_levels', type: 'table', platform: 'bigquery', description: 'Real-time inventory levels by warehouse', tags: ['inventory', 'warehouse'], owner: 'data-eng', qualityScore: 86, freshnessScore: 99 },
    { id: 'model-1', customerId: 'cust-1', name: 'churn_prediction', type: 'model', platform: 'dbt', description: 'Customer churn prediction model features', tags: ['ml', 'churn', 'customers'], owner: 'data-science', qualityScore: 84, freshnessScore: 82 },
    { id: 'metric-1', customerId: 'cust-1', name: 'monthly_active_users', type: 'metric', platform: 'dbt', description: 'Count of unique active users per month', tags: ['metric', 'users', 'engagement'], owner: 'analytics', qualityScore: 97, freshnessScore: 94 },
  ];
}
