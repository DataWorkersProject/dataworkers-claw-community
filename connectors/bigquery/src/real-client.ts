/**
 * Real BigQuery client.
 * Uses the @google-cloud/bigquery npm package to connect to a live BigQuery instance.
 * Implements IBigQueryClient so it can be used interchangeably with the stub.
 */

import type {
  IBigQueryClient,
  BigQueryConnectionConfig,
  BQDataset,
  BQTable,
  BQTableSchema,
  BQJob,
  BQCostEstimate,
} from './types.js';

export class RealBigQueryClient implements IBigQueryClient {
  private bqClient: any;
  private projectId: string;

  private constructor(bqClient: any, projectId: string) {
    this.bqClient = bqClient;
    this.projectId = projectId;
  }

  /**
   * Create a RealBigQueryClient from configuration.
   * Uses a dynamic import so @google-cloud/bigquery is only loaded when needed.
   */
  static async connect(config: BigQueryConnectionConfig): Promise<RealBigQueryClient> {
    const { BigQuery } = await import('@google-cloud/bigquery');
    const options: Record<string, unknown> = {
      projectId: config.projectId,
    };
    if (config.keyFilename) {
      options.keyFilename = config.keyFilename;
    }
    if (config.credentials) {
      options.credentials = config.credentials;
    }
    const client = new BigQuery(options);

    // Verify connectivity by listing datasets (lightweight call)
    try {
      await client.getDatasets({ maxResults: 1 });
    } catch (err: any) {
      throw new Error(`BigQuery connection failed: ${err.message}`);
    }

    return new RealBigQueryClient(client, config.projectId);
  }

  async listDatasets(): Promise<BQDataset[]> {
    const [datasets] = await this.bqClient.getDatasets();
    return datasets.map((ds: any) => ({
      datasetId: ds.id ?? '',
      projectId: this.projectId,
      location: ds.metadata?.location ?? 'US',
      createdAt: ds.metadata?.creationTime
        ? Number(ds.metadata.creationTime)
        : Date.now(),
      description: ds.metadata?.description ?? '',
    }));
  }

  async listTables(datasetId: string): Promise<BQTable[]> {
    const dataset = this.bqClient.dataset(datasetId);
    const [tables] = await dataset.getTables();
    return tables.map((t: any) => ({
      tableId: t.id ?? '',
      datasetId,
      projectId: this.projectId,
      type: (t.metadata?.type ?? 'TABLE') as 'TABLE' | 'VIEW' | 'EXTERNAL',
      numRows: Number(t.metadata?.numRows ?? 0),
      numBytes: Number(t.metadata?.numBytes ?? 0),
      createdAt: t.metadata?.creationTime
        ? Number(t.metadata.creationTime)
        : Date.now(),
    }));
  }

  async getTableSchema(datasetId: string, tableId: string): Promise<BQTableSchema> {
    const table = this.bqClient.dataset(datasetId).table(tableId);
    const [metadata] = await table.getMetadata();
    const fields = metadata.schema?.fields ?? [];
    return {
      datasetId,
      tableId,
      lastModified: metadata.lastModifiedTime
        ? Number(metadata.lastModifiedTime)
        : Date.now(),
      columns: fields.map((f: any) => ({
        name: f.name ?? '',
        type: f.type ?? 'STRING',
        mode: (f.mode ?? 'NULLABLE') as 'NULLABLE' | 'REQUIRED' | 'REPEATED',
        description: f.description ?? '',
      })),
    };
  }

  async getJobHistory(limit?: number): Promise<BQJob[]> {
    const effectiveLimit = limit && limit > 0 ? limit : 50;
    const [jobs] = await this.bqClient.getJobs({
      maxResults: effectiveLimit,
      allUsers: true,
    });
    return jobs.map((j: any) => ({
      jobId: j.id ?? '',
      queryText: j.metadata?.configuration?.query?.query ?? '',
      status: mapJobStatus(j.metadata?.status?.state),
      totalBytesProcessed: Number(
        j.metadata?.statistics?.query?.totalBytesProcessed ?? 0,
      ),
      totalSlotMs: Number(
        j.metadata?.statistics?.query?.totalSlotMs ?? 0,
      ),
      createdAt: j.metadata?.statistics?.creationTime
        ? Number(j.metadata.statistics.creationTime)
        : Date.now(),
      user: j.metadata?.user_email ?? '',
    }));
  }

  async estimateQueryCost(queryText: string): Promise<BQCostEstimate> {
    // Use a dry-run query to get the estimated bytes processed
    const [job] = await this.bqClient.createQueryJob({
      query: queryText,
      dryRun: true,
    });
    const estimatedBytes = Number(
      job.metadata?.statistics?.totalBytesProcessed ?? 0,
    );
    // On-demand pricing: $5 per TB
    const COST_PER_BYTE = 5 / (1024 * 1024 * 1024 * 1024);
    const estimatedCost = estimatedBytes * COST_PER_BYTE;

    return {
      queryText,
      estimatedBytesProcessed: estimatedBytes,
      estimatedCostUSD: Math.round(estimatedCost * 10000) / 10000,
      tier: 'on-demand',
    };
  }
}

function mapJobStatus(state: string | undefined): 'DONE' | 'RUNNING' | 'PENDING' {
  switch (state) {
    case 'DONE':
      return 'DONE';
    case 'RUNNING':
      return 'RUNNING';
    case 'PENDING':
      return 'PENDING';
    default:
      return 'DONE';
  }
}
