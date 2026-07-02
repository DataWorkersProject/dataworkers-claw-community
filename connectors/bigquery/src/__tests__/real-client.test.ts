import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @google-cloud/bigquery at module level
const mockGetDatasets = vi.fn();
const mockGetTables = vi.fn();
const mockGetMetadata = vi.fn();
const mockGetJobs = vi.fn();
const mockCreateQueryJob = vi.fn();

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn().mockImplementation(() => ({
    getDatasets: mockGetDatasets,
    dataset: vi.fn(() => ({
      getTables: mockGetTables,
      table: vi.fn(() => ({
        getMetadata: mockGetMetadata,
      })),
    })),
    getJobs: mockGetJobs,
    createQueryJob: mockCreateQueryJob,
  })),
}));

import { RealBigQueryClient } from '../real-client.js';

describe('RealBigQueryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: connectivity check succeeds
    mockGetDatasets.mockResolvedValue([[]]);
  });

  describe('connect', () => {
    it('should create a client with the provided config', async () => {
      const client = await RealBigQueryClient.connect({
        projectId: 'my-project',
        keyFilename: '/path/to/key.json',
      });
      expect(client).toBeInstanceOf(RealBigQueryClient);
    });

    it('should throw when connectivity check fails', async () => {
      mockGetDatasets.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(
        RealBigQueryClient.connect({ projectId: 'bad-project' }),
      ).rejects.toThrow('BigQuery connection failed: Permission denied');
    });
  });

  describe('listDatasets', () => {
    it('should return mapped datasets', async () => {
      const client = await RealBigQueryClient.connect({ projectId: 'my-proj' });

      mockGetDatasets.mockResolvedValueOnce([
        [
          {
            id: 'analytics',
            metadata: { location: 'US', creationTime: '1700000000000', description: 'Analytics data' },
          },
          {
            id: 'raw_events',
            metadata: { location: 'EU', creationTime: '1690000000000', description: 'Raw events' },
          },
        ],
      ]);

      const datasets = await client.listDatasets();
      expect(datasets).toHaveLength(2);
      expect(datasets[0].datasetId).toBe('analytics');
      expect(datasets[0].projectId).toBe('my-proj');
      expect(datasets[0].location).toBe('US');
      expect(datasets[0].description).toBe('Analytics data');
      expect(datasets[1].datasetId).toBe('raw_events');
    });
  });

  describe('listTables', () => {
    it('should return mapped tables for a dataset', async () => {
      const client = await RealBigQueryClient.connect({ projectId: 'my-proj' });

      mockGetTables.mockResolvedValueOnce([
        [
          {
            id: 'orders',
            metadata: { type: 'TABLE', numRows: '10000', numBytes: '5000000', creationTime: '1700000000000' },
          },
          {
            id: 'revenue_view',
            metadata: { type: 'VIEW', numRows: '0', numBytes: '0', creationTime: '1700100000000' },
          },
        ],
      ]);

      const tables = await client.listTables('analytics');
      expect(tables).toHaveLength(2);
      expect(tables[0].tableId).toBe('orders');
      expect(tables[0].datasetId).toBe('analytics');
      expect(tables[0].type).toBe('TABLE');
      expect(tables[0].numRows).toBe(10000);
      expect(tables[1].tableId).toBe('revenue_view');
      expect(tables[1].type).toBe('VIEW');
    });
  });

  describe('getTableSchema', () => {
    it('should return mapped schema with columns', async () => {
      const client = await RealBigQueryClient.connect({ projectId: 'my-proj' });

      mockGetMetadata.mockResolvedValueOnce([
        {
          lastModifiedTime: '1700500000000',
          schema: {
            fields: [
              { name: 'order_id', type: 'INT64', mode: 'REQUIRED', description: 'PK' },
              { name: 'amount', type: 'NUMERIC', mode: 'NULLABLE', description: 'Total' },
            ],
          },
        },
      ]);

      const schema = await client.getTableSchema('analytics', 'orders');
      expect(schema.datasetId).toBe('analytics');
      expect(schema.tableId).toBe('orders');
      expect(schema.columns).toHaveLength(2);
      expect(schema.columns[0].name).toBe('order_id');
      expect(schema.columns[0].type).toBe('INT64');
      expect(schema.columns[0].mode).toBe('REQUIRED');
      expect(schema.columns[1].mode).toBe('NULLABLE');
    });
  });

  describe('getJobHistory', () => {
    it('should return mapped job history', async () => {
      const client = await RealBigQueryClient.connect({ projectId: 'my-proj' });

      mockGetJobs.mockResolvedValueOnce([
        [
          {
            id: 'job_1',
            metadata: {
              configuration: { query: { query: 'SELECT 1' } },
              status: { state: 'DONE' },
              statistics: {
                query: { totalBytesProcessed: '1024', totalSlotMs: '500' },
                creationTime: '1700000000000',
              },
              user_email: 'user@example.com',
            },
          },
        ],
      ]);

      const jobs = await client.getJobHistory(10);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].jobId).toBe('job_1');
      expect(jobs[0].queryText).toBe('SELECT 1');
      expect(jobs[0].status).toBe('DONE');
      expect(jobs[0].totalBytesProcessed).toBe(1024);
      expect(jobs[0].user).toBe('user@example.com');
    });
  });

  describe('estimateQueryCost', () => {
    it('should return cost estimate from dry-run', async () => {
      const client = await RealBigQueryClient.connect({ projectId: 'my-proj' });

      mockCreateQueryJob.mockResolvedValueOnce([
        {
          metadata: {
            statistics: { totalBytesProcessed: '10737418240' }, // 10 GB
          },
        },
      ]);

      const estimate = await client.estimateQueryCost('SELECT * FROM big_table');
      expect(estimate.queryText).toBe('SELECT * FROM big_table');
      expect(estimate.estimatedBytesProcessed).toBe(10737418240);
      expect(estimate.estimatedCostUSD).toBeGreaterThan(0);
      expect(estimate.tier).toBe('on-demand');
    });
  });
});
