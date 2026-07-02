import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @databricks/sql at module level
const mockExecuteStatement = vi.fn();
const mockFetchAll = vi.fn();
const mockOperationClose = vi.fn();
const mockOpenSession = vi.fn();
const mockClientConnect = vi.fn();

vi.mock('@databricks/sql', () => ({
  DBSQLClient: vi.fn().mockImplementation(() => ({
    connect: (opts: any) => {
      mockClientConnect(opts);
      return Promise.resolve();
    },
    openSession: (opts: any) => {
      mockOpenSession(opts);
      return Promise.resolve({
        executeStatement: (sql: string) => {
          mockExecuteStatement(sql);
          return Promise.resolve({
            fetchAll: mockFetchAll,
            close: mockOperationClose,
          });
        },
      });
    },
  })),
}));

import { RealDatabricksClient } from '../real-client.js';

describe('RealDatabricksClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAll.mockResolvedValue([]);
    mockOperationClose.mockResolvedValue(undefined);
  });

  describe('connect', () => {
    it('should create a client with the provided config', async () => {
      const client = await RealDatabricksClient.connect({
        host: 'https://my-workspace.cloud.databricks.com',
        token: 'dapi-test-token',
        httpPath: '/sql/1.0/warehouses/abc123',
        catalogName: 'main',
      });

      expect(client).toBeInstanceOf(RealDatabricksClient);
      expect(mockClientConnect).toHaveBeenCalledWith({
        host: 'my-workspace.cloud.databricks.com',
        path: '/sql/1.0/warehouses/abc123',
        token: 'dapi-test-token',
      });
      expect(mockOpenSession).toHaveBeenCalledWith({
        initialCatalog: 'main',
      });
    });

    it('should strip https:// from host', async () => {
      await RealDatabricksClient.connect({
        host: 'https://workspace.databricks.com',
        token: 'token',
      });

      expect(mockClientConnect).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'workspace.databricks.com' }),
      );
    });
  });

  describe('listCatalogs', () => {
    it('should return mapped catalogs from SHOW CATALOGS', async () => {
      const client = await RealDatabricksClient.connect({
        host: 'https://ws.databricks.com',
        token: 'tok',
      });

      mockFetchAll.mockResolvedValueOnce([
        { catalog: 'main', owner: 'data-eng', comment: 'Primary', created_at: '2025-01-01T00:00:00Z' },
        { catalog: 'hive_metastore', owner: 'admin', comment: 'Legacy', created_at: '2024-01-01T00:00:00Z' },
      ]);

      const catalogs = await client.listCatalogs();
      expect(catalogs).toHaveLength(2);
      expect(catalogs[0].name).toBe('main');
      expect(catalogs[0].owner).toBe('data-eng');
      expect(catalogs[0].comment).toBe('Primary');
      expect(catalogs[1].name).toBe('hive_metastore');
    });
  });

  describe('listSchemas', () => {
    it('should return mapped schemas for a catalog', async () => {
      const client = await RealDatabricksClient.connect({
        host: 'https://ws.databricks.com',
        token: 'tok',
      });

      mockFetchAll.mockResolvedValueOnce([
        { databaseName: 'default', owner: 'data-eng', comment: 'Default schema', created_at: '2025-01-01T00:00:00Z' },
        { databaseName: 'analytics', owner: 'analysts', comment: 'Analytics', created_at: '2025-02-01T00:00:00Z' },
      ]);

      const schemas = await client.listSchemas('main');
      expect(schemas).toHaveLength(2);
      expect(schemas[0].name).toBe('default');
      expect(schemas[0].catalogName).toBe('main');
      expect(schemas[1].name).toBe('analytics');
    });
  });

  describe('listTables', () => {
    it('should return tables with columns from SHOW TABLES + DESCRIBE', async () => {
      const client = await RealDatabricksClient.connect({
        host: 'https://ws.databricks.com',
        token: 'tok',
      });

      // First call: SHOW TABLES
      mockFetchAll.mockResolvedValueOnce([
        { tableName: 'orders', tableType: 'MANAGED', owner: 'data-eng' },
      ]);
      // Second call: DESCRIBE TABLE for 'orders'
      mockFetchAll.mockResolvedValueOnce([
        { col_name: 'order_id', data_type: 'BIGINT', comment: 'PK' },
        { col_name: 'amount', data_type: 'DECIMAL(12,2)', comment: '' },
      ]);

      const tables = await client.listTables('main', 'default');
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('orders');
      expect(tables[0].catalogName).toBe('main');
      expect(tables[0].schemaName).toBe('default');
      expect(tables[0].tableType).toBe('MANAGED');
      expect(tables[0].columns).toHaveLength(2);
      expect(tables[0].columns[0].name).toBe('order_id');
      expect(tables[0].columns[0].type).toBe('BIGINT');
    });
  });

  describe('getTable', () => {
    it('should return table details from DESCRIBE EXTENDED', async () => {
      const client = await RealDatabricksClient.connect({
        host: 'https://ws.databricks.com',
        token: 'tok',
      });

      mockFetchAll.mockResolvedValueOnce([
        { col_name: 'id', data_type: 'BIGINT', comment: 'PK' },
        { col_name: 'name', data_type: 'STRING', comment: '' },
        { col_name: '# Detailed Table Information', data_type: '', comment: '' },
        { col_name: 'Type', data_type: 'MANAGED', comment: '' },
        { col_name: 'Provider', data_type: 'delta', comment: '' },
        { col_name: 'Location', data_type: 'dbfs:/warehouse/tbl', comment: '' },
        { col_name: 'Owner', data_type: 'data-eng', comment: '' },
      ]);

      const table = await client.getTable('main', 'default', 'users');
      expect(table.name).toBe('users');
      expect(table.catalogName).toBe('main');
      expect(table.schemaName).toBe('default');
      expect(table.tableType).toBe('MANAGED');
      expect(table.dataSourceFormat).toBe('DELTA');
      expect(table.storageLocation).toBe('dbfs:/warehouse/tbl');
      expect(table.owner).toBe('data-eng');
      expect(table.columns).toHaveLength(2);
      expect(table.columns[0].name).toBe('id');
    });
  });

  describe('getQueryHistory', () => {
    it('should return mapped query history from system.query.history', async () => {
      const client = await RealDatabricksClient.connect({
        host: 'https://ws.databricks.com',
        token: 'tok',
      });

      mockFetchAll.mockResolvedValueOnce([
        {
          query_id: 'q-1',
          query_text: 'SELECT 1',
          status: 'FINISHED',
          execution_duration_ms: 150,
          rows_produced: 1,
          read_bytes: 1024,
          user_name: 'analyst',
          warehouse_id: 'wh-1',
          query_start_time_ms: 1700000000000,
        },
      ]);

      const history = await client.getQueryHistory(10);
      expect(history).toHaveLength(1);
      expect(history[0].queryId).toBe('q-1');
      expect(history[0].queryText).toBe('SELECT 1');
      expect(history[0].status).toBe('FINISHED');
      expect(history[0].durationMs).toBe(150);
      expect(history[0].user).toBe('analyst');
    });

    it('should return empty array when system.query.history is unavailable', async () => {
      const client = await RealDatabricksClient.connect({
        host: 'https://ws.databricks.com',
        token: 'tok',
      });

      mockFetchAll.mockRejectedValueOnce(new Error('Table not found'));

      const history = await client.getQueryHistory();
      expect(history).toEqual([]);
    });
  });

  describe('table type and format mapping', () => {
    it('should correctly map VIEW type', async () => {
      const client = await RealDatabricksClient.connect({
        host: 'https://ws.databricks.com',
        token: 'tok',
      });

      mockFetchAll.mockResolvedValueOnce([
        { col_name: '# Metadata', data_type: '', comment: '' },
        { col_name: 'Type', data_type: 'VIEW', comment: '' },
        { col_name: 'Provider', data_type: 'parquet', comment: '' },
      ]);

      const table = await client.getTable('c', 's', 't');
      expect(table.tableType).toBe('VIEW');
      expect(table.dataSourceFormat).toBe('PARQUET');
    });

    it('should correctly map EXTERNAL type', async () => {
      const client = await RealDatabricksClient.connect({
        host: 'https://ws.databricks.com',
        token: 'tok',
      });

      mockFetchAll.mockResolvedValueOnce([
        { col_name: '# Metadata', data_type: '', comment: '' },
        { col_name: 'Type', data_type: 'EXTERNAL', comment: '' },
        { col_name: 'Provider', data_type: 'csv', comment: '' },
      ]);

      const table = await client.getTable('c', 's', 't');
      expect(table.tableType).toBe('EXTERNAL');
      expect(table.dataSourceFormat).toBe('CSV');
    });
  });
});
