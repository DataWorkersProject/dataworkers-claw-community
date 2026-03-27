/**
 * Databricks Unity Catalog Connector.
 *
 * Implements a DataConnector-like interface for interacting with
 * Databricks Unity Catalog, backed by either a stubbed in-memory client
 * or a real client that talks to the Databricks REST API.
 */

import type { ICatalogProvider, CatalogCapability } from '../../shared/types.js';
import { DatabricksStubClient } from './stub-client.js';
import type {
  DatabricksCatalog,
  DatabricksSchema,
  DatabricksTable,
  DatabricksQueryHistoryEntry,
  DatabricksConnectionConfig,
  IDatabricksClient,
} from './types.js';

type MaybePromise<T> = T | Promise<T>;

export class DatabricksConnector implements ICatalogProvider {
  readonly connectorType = 'databricks';
  readonly providerType = 'databricks';
  readonly capabilities: CatalogCapability[] = ['discovery'];

  private client: IDatabricksClient;
  private host: string | null = null;
  private connected = false;
  private mode: 'real' | 'stub' = 'stub';

  /**
   * @param client  Optional client instance. Defaults to the in-memory stub.
   */
  constructor(client?: IDatabricksClient) {
    this.client = client ?? new DatabricksStubClient();
  }

  /**
   * Create a DatabricksConnector from environment variables.
   * Falls back to stub client (OSS edition).
   */
  static fromEnv(): DatabricksConnector {
    return new DatabricksConnector();
  }

  /** Get the current mode ('real' or 'stub'). */
  getMode(): 'real' | 'stub' {
    return this.mode;
  }

  /** Validate host and token, seed stub data. */
  connect(host?: string, token?: string): void {
    // Explicitly passed empty strings are errors (backward compat)
    if (host !== undefined && (!host || typeof host !== 'string')) {
      throw new Error('A valid Databricks host URL is required');
    }
    if (token !== undefined && (!token || typeof token !== 'string')) {
      throw new Error('A valid Databricks access token is required');
    }
    const h = host || process.env.DATABRICKS_HOST;
    const t = token || process.env.DATABRICKS_TOKEN;
    if (!h) {
      // Fallback to stub mode for development
      if (this.client instanceof DatabricksStubClient) {
        this.client.seed();
      }
      this.mode = 'stub';
      this.host = 'stub';
      this.connected = true;
      return;
    }
    if (!t) {
      throw new Error('A valid Databricks access token is required');
    }
    this.host = h;
    // Seed stub client (OSS edition)
    if (this.client instanceof DatabricksStubClient) {
      this.client.seed();
    }
    this.mode = 'stub';
    this.connected = true;
  }

  /** Disconnect and clear state. */
  disconnect(): void {
    this.host = null;
    this.connected = false;
    // Reset to a fresh stub only when using the stub client
    if (this.client instanceof DatabricksStubClient) {
      this.client = new DatabricksStubClient();
    }
  }

  /** Check connectivity. */
  healthCheck(): { healthy: boolean; latencyMs: number } {
    const start = Date.now();
    const healthy = this.connected && this.host !== null;
    return { healthy, latencyMs: Date.now() - start };
  }

  // --- IDataPlatformConnector operations ---

  /** List catalogs as namespaces. */
  listNamespaces(): MaybePromise<{ name: string[]; properties: Record<string, string> }[]> {
    this.ensureConnected();
    const result = this.client.listCatalogs();

    const mapCatalogs = (catalogs: DatabricksCatalog[]) =>
      catalogs.map((c) => ({
        name: [c.name],
        properties: {
          owner: c.owner,
          comment: c.comment,
        },
      }));

    if (result instanceof Promise) {
      return result.then(mapCatalogs);
    }
    return mapCatalogs(result);
  }

  /** List all tables across all schemas in a catalog. */
  listTables(namespace: string): MaybePromise<{
    name: string;
    namespace: string[];
    schema: { name: string; type: string; nullable: boolean; comment?: string }[];
    properties: Record<string, string>;
  }[]> {
    this.ensureConnected();
    const schemasResult = this.client.listSchemas(namespace);

    const mapTable = (t: DatabricksTable) => ({
      name: t.name,
      namespace: [t.catalogName, t.schemaName],
      schema: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        comment: c.comment,
      })),
      properties: {
        tableType: t.tableType,
        dataSourceFormat: t.dataSourceFormat,
        owner: t.owner,
        ...(t.storageLocation ? { storageLocation: t.storageLocation } : {}),
      },
    });

    if (schemasResult instanceof Promise) {
      return schemasResult.then(async (schemas) => {
        const results: ReturnType<typeof mapTable>[] = [];
        for (const s of schemas) {
          const tables = await this.client.listTables(namespace, s.name);
          for (const t of tables) {
            results.push(mapTable(t));
          }
        }
        return results;
      });
    }

    // Synchronous path (stub client)
    const results: ReturnType<typeof mapTable>[] = [];
    for (const s of schemasResult) {
      const tables = this.client.listTables(namespace, s.name) as DatabricksTable[];
      for (const t of tables) {
        results.push(mapTable(t));
      }
    }
    return results;
  }

  /** Get metadata for a table, searching across all schemas in a catalog. */
  getTableMetadata(namespace: string, table: string): MaybePromise<{
    name: string;
    namespace: string[];
    schema: { name: string; type: string; nullable: boolean; comment?: string }[];
    properties: Record<string, string>;
  }> {
    this.ensureConnected();
    const schemasResult = this.client.listSchemas(namespace);

    const mapResult = (t: DatabricksTable) => ({
      name: t.name,
      namespace: [t.catalogName, t.schemaName],
      schema: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        comment: c.comment,
      })),
      properties: {
        tableType: t.tableType,
        dataSourceFormat: t.dataSourceFormat,
        owner: t.owner,
        ...(t.storageLocation ? { storageLocation: t.storageLocation } : {}),
      },
    });

    if (schemasResult instanceof Promise) {
      return schemasResult.then(async (schemas) => {
        for (const s of schemas) {
          try {
            const t = await this.client.getTable(namespace, s.name, table);
            return mapResult(t);
          } catch {
            // Table not in this schema, try next
          }
        }
        throw new Error(`Table not found: ${namespace}.*.${table}`);
      });
    }

    // Synchronous path (stub client)
    for (const s of schemasResult) {
      try {
        const t = this.client.getTable(namespace, s.name, table) as DatabricksTable;
        return mapResult(t);
      } catch {
        // Table not in this schema, try next
      }
    }
    throw new Error(`Table not found: ${namespace}.*.${table}`);
  }

  // --- Databricks-specific operations ---

  /** List all Unity Catalog catalogs. */
  listCatalogs(): MaybePromise<DatabricksCatalog[]> {
    this.ensureConnected();
    return this.client.listCatalogs();
  }

  /** List schemas within a catalog. */
  listSchemas(catalog: string): MaybePromise<DatabricksSchema[]> {
    this.ensureConnected();
    return this.client.listSchemas(catalog);
  }

  /** Get a specific table by catalog, schema, and table name. */
  getTable(catalog: string, schema: string, table: string): MaybePromise<DatabricksTable> {
    this.ensureConnected();
    return this.client.getTable(catalog, schema, table);
  }

  /** Get query history entries. */
  getQueryHistory(limit?: number): MaybePromise<DatabricksQueryHistoryEntry[]> {
    this.ensureConnected();
    return this.client.getQueryHistory(limit);
  }

  // --- Private helpers ---

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }
  }
}

// Re-export everything
export { DatabricksStubClient } from './stub-client.js';
export type {
  DatabricksCatalog,
  DatabricksSchema,
  DatabricksTable,
  DatabricksColumn,
  DatabricksQueryHistoryEntry,
  DatabricksConnectionConfig,
  IDatabricksClient,
} from './types.js';
