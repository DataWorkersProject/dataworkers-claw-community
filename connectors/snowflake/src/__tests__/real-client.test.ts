import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock snowflake-sdk at module level
let mockConnectCallback: (err?: Error) => void = () => {};
const mockExecute = vi.fn();

vi.mock('snowflake-sdk', () => ({
  createConnection: () => ({
    connect: (cb: (err?: Error) => void) => {
      mockConnectCallback(cb);
    },
    execute: (params: { sqlText: string; complete: (err: Error | undefined, stmt: unknown, rows: any[]) => void }) => {
      mockExecute(params);
    },
  }),
}));

import { RealSnowflakeClient } from '../real-client.js';

describe('RealSnowflakeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: connection succeeds
    mockConnectCallback = (cb) => cb();
    // Default: execute returns empty rows
    mockExecute.mockImplementation((params: any) => {
      params.complete(undefined, null, []);
    });
  });

  describe('connect', () => {
    it('should create a client when connection succeeds', async () => {
      const client = await RealSnowflakeClient.connect({
        account: 'test-account',
        username: 'user',
        password: 'pass',
        warehouse: 'WH',
      });
      expect(client).toBeInstanceOf(RealSnowflakeClient);
    });

    it('should throw when connection fails', async () => {
      mockConnectCallback = (cb) => cb(new Error('Auth failed'));

      await expect(
        RealSnowflakeClient.connect({
          account: 'bad',
          username: 'user',
          password: 'wrong',
        }),
      ).rejects.toThrow('Snowflake connection failed: Auth failed');
    });
  });

  describe('listDatabases', () => {
    it('should translate SHOW DATABASES rows to SnowflakeDatabase[]', async () => {
      const client = await RealSnowflakeClient.connect({
        account: 'test',
        username: 'u',
        password: 'p',
      });

      mockExecute.mockImplementation((params: any) => {
        params.complete(undefined, null, [
          { name: 'ANALYTICS', owner: 'SYSADMIN', created_on: '2025-01-01T00:00:00Z', comment: 'Analytics DB' },
          { name: 'RAW', owner: 'LOADER', created_on: '2024-06-15T00:00:00Z', comment: '' },
        ]);
      });

      const databases = await client.listDatabases();
      expect(databases).toHaveLength(2);
      expect(databases[0].name).toBe('ANALYTICS');
      expect(databases[0].owner).toBe('SYSADMIN');
      expect(databases[0].comment).toBe('Analytics DB');
      expect(databases[1].name).toBe('RAW');
    });
  });

  describe('listSchemas', () => {
    it('should execute SHOW SCHEMAS and return mapped results', async () => {
      const client = await RealSnowflakeClient.connect({
        account: 'test',
        username: 'u',
        password: 'p',
      });

      mockExecute.mockImplementation((params: any) => {
        params.complete(undefined, null, [
          { name: 'PUBLIC', owner: 'SYSADMIN', created_on: '2025-01-01T00:00:00Z' },
          { name: 'MARTS', owner: 'ADMIN', created_on: '2025-02-01T00:00:00Z' },
        ]);
      });

      const schemas = await client.listSchemas('ANALYTICS');
      expect(schemas).toHaveLength(2);
      expect(schemas[0].name).toBe('PUBLIC');
      expect(schemas[0].database).toBe('ANALYTICS');
      expect(schemas[1].name).toBe('MARTS');
    });
  });

  describe('listTables', () => {
    it('should execute SHOW TABLES and return mapped results', async () => {
      const client = await RealSnowflakeClient.connect({
        account: 'test',
        username: 'u',
        password: 'p',
      });

      mockExecute.mockImplementation((params: any) => {
        params.complete(undefined, null, [
          { name: 'ORDERS', kind: 'TABLE', rows: 1000, bytes: 50000, owner: 'SYSADMIN', created_on: '2025-01-15T00:00:00Z' },
        ]);
      });

      const tables = await client.listTables('ANALYTICS', 'PUBLIC');
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('ORDERS');
      expect(tables[0].database).toBe('ANALYTICS');
      expect(tables[0].schema).toBe('PUBLIC');
      expect(tables[0].kind).toBe('TABLE');
      expect(tables[0].rowCount).toBe(1000);
    });
  });

  describe('getTableDDL', () => {
    it('should return columns and clustering keys', async () => {
      const client = await RealSnowflakeClient.connect({
        account: 'test',
        username: 'u',
        password: 'p',
      });

      mockExecute.mockImplementation((params: any) => {
        if (params.sqlText.includes('SHOW COLUMNS')) {
          params.complete(undefined, null, [
            { column_name: 'ID', data_type: '{"type":"NUMBER"}', is_nullable: 'NO', default: null, comment: 'PK' },
            { column_name: 'NAME', data_type: 'VARCHAR', is_nullable: 'YES', default: null, comment: '' },
          ]);
        } else if (params.sqlText.includes('SHOW TABLES LIKE')) {
          params.complete(undefined, null, [
            { cluster_by: 'LINEAR(ID)' },
          ]);
        } else {
          params.complete(undefined, null, []);
        }
      });

      const ddl = await client.getTableDDL('DB', 'PUBLIC', 'USERS');
      expect(ddl.database).toBe('DB');
      expect(ddl.schema).toBe('PUBLIC');
      expect(ddl.table).toBe('USERS');
      expect(ddl.columns).toHaveLength(2);
      expect(ddl.columns[0].name).toBe('ID');
      expect(ddl.columns[0].type).toBe('NUMBER');
      expect(ddl.columns[0].nullable).toBe(false);
      expect(ddl.columns[1].nullable).toBe(true);
      expect(ddl.clusteringKeys).toEqual(['ID']);
    });
  });

  describe('queryWarehouseUsage', () => {
    it('should return mapped warehouse usage records', async () => {
      const client = await RealSnowflakeClient.connect({
        account: 'test',
        username: 'u',
        password: 'p',
      });

      mockExecute.mockImplementation((params: any) => {
        params.complete(undefined, null, [
          {
            WAREHOUSE_NAME: 'COMPUTE_WH',
            CREDITS_USED: 100.5,
            QUERIES_EXECUTED: 500,
            AVG_EXECUTION_TIME_MS: 3000,
            PERIOD_START: '2025-03-01T00:00:00Z',
            PERIOD_END: '2025-03-08T00:00:00Z',
          },
        ]);
      });

      const usage = await client.queryWarehouseUsage();
      expect(usage).toHaveLength(1);
      expect(usage[0].warehouseName).toBe('COMPUTE_WH');
      expect(usage[0].creditsUsed).toBe(100.5);
      expect(usage[0].queriesExecuted).toBe(500);
    });
  });

  describe('getQueryHistory', () => {
    it('should return mapped query history entries with a limit', async () => {
      const client = await RealSnowflakeClient.connect({
        account: 'test',
        username: 'u',
        password: 'p',
      });

      mockExecute.mockImplementation((params: any) => {
        params.complete(undefined, null, [
          {
            QUERY_ID: 'q-1',
            QUERY_TEXT: 'SELECT 1',
            EXECUTION_STATUS: 'SUCCESS',
            TOTAL_ELAPSED_TIME: 150,
            BYTES_SCANNED: 1024,
            ROWS_PRODUCED: 1,
            USER_NAME: 'USER1',
            WAREHOUSE_NAME: 'WH1',
            START_TIME: '2025-03-07T12:00:00Z',
          },
        ]);
      });

      const history = await client.getQueryHistory(10);
      expect(history).toHaveLength(1);
      expect(history[0].queryId).toBe('q-1');
      expect(history[0].queryText).toBe('SELECT 1');
      expect(history[0].status).toBe('SUCCESS');
      expect(history[0].durationMs).toBe(150);
      expect(history[0].user).toBe('USER1');
    });
  });

  describe('seed', () => {
    it('should be a no-op', async () => {
      const client = await RealSnowflakeClient.connect({
        account: 'test',
        username: 'u',
        password: 'p',
      });
      // Should not throw
      client.seed();
    });
  });

  describe('SQL error handling', () => {
    it('should reject when a SQL statement fails', async () => {
      const client = await RealSnowflakeClient.connect({
        account: 'test',
        username: 'u',
        password: 'p',
      });

      mockExecute.mockImplementation((params: any) => {
        params.complete(new Error('SQL compilation error'), null, []);
      });

      await expect(client.listDatabases()).rejects.toThrow('SQL compilation error');
    });
  });
});
