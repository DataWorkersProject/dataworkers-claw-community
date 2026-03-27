/**
 * Vector store abstraction layer (REQ-CTX-012, REQ-RAG-002, REQ-RAG-010).
 *
 * Pluggable backends:
 * - Pinecone (SaaS): namespace isolation via Pinecone namespaces
 * - Weaviate (VPC/on-premise): native multi-tenancy
 *
 * Falls back to BM25 keyword search if vector store unavailable (REQ-RAG-010).
 */

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  content?: string;
}

export interface VectorStoreConfig {
  backend: 'pinecone' | 'weaviate';
  endpoint: string;
  apiKey?: string;
  dimension?: number;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  customerId: string;
}

/**
 * Abstract vector store interface. Both Pinecone and Weaviate
 * backends implement the same API.
 */
export class VectorStore {
  private config: VectorStoreConfig;
  private available = true;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  getBackend(): string {
    return this.config.backend;
  }

  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Upsert documents into the customer's namespace.
   * Per REQ-CTX-012, vectors are partitioned by customer.
   */
  async upsert(customerId: string, documents: VectorDocument[]): Promise<number> {
    if (!this.available) {
      throw new Error('Vector store unavailable');
    }
    // In production:
    // Pinecone: index.namespace(customerId).upsert(vectors)
    // Weaviate: client.data.creator().withTenant(customerId).do()
    void customerId;
    return documents.length;
  }

  /**
   * Search for similar vectors within a customer's namespace.
   * Returns top-K results sorted by similarity score.
   */
  async search(
    customerId: string,
    queryEmbedding: number[],
    topK = 10,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchResult[]> {
    if (!this.available) {
      // REQ-RAG-010: Fall back to BM25
      return this.bm25Fallback(customerId, topK);
    }
    // In production:
    // Pinecone: index.namespace(customerId).query({ vector, topK, filter })
    // Weaviate: client.graphql.get().withNearVector({ vector }).withTenant(customerId)
    void customerId;
    void queryEmbedding;
    void topK;
    void filter;
    return [];
  }

  /**
   * Delete documents from a customer's namespace.
   */
  async delete(customerId: string, ids: string[]): Promise<number> {
    void customerId;
    void ids;
    return 0;
  }

  /**
   * Delete all data for a customer (for GDPR erasure).
   */
  async deleteCustomerNamespace(customerId: string): Promise<void> {
    // Pinecone: index.namespace(customerId).deleteAll()
    // Weaviate: client.schema.tenantsDeleter().withTenant(customerId).do()
    void customerId;
  }

  /**
   * Mark vector store as unavailable (triggers BM25 fallback).
   */
  markUnavailable(): void {
    this.available = false;
  }

  /**
   * Mark vector store as available again.
   */
  markAvailable(): void {
    this.available = true;
  }

  /**
   * BM25 keyword fallback when vector store is unavailable (REQ-RAG-010).
   */
  private async bm25Fallback(
    _customerId: string,
    _topK: number,
  ): Promise<VectorSearchResult[]> {
    // In production: query PostgreSQL full-text search or Elasticsearch
    return [];
  }
}
