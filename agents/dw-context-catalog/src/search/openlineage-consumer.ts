/**
 * OpenLineageConsumer — ingest OpenLineage events into the catalog's graph DB.
 * OpenLineage event consumer — ingest lineage events into graph.
 */

import type { IGraphDB } from '@data-workers/infrastructure-stubs';

export interface OpenLineageRunEvent {
  eventType: 'START' | 'RUNNING' | 'COMPLETE' | 'FAIL' | 'ABORT';
  eventTime: string;
  run: { runId: string; facets?: Record<string, unknown> };
  job: { namespace: string; name: string; facets?: Record<string, unknown> };
  inputs: OpenLineageDataset[];
  outputs: OpenLineageDataset[];
  producer: string;
}

export interface OpenLineageDataset {
  namespace: string;
  name: string;
  facets?: {
    schema?: {
      fields: Array<{ name: string; type: string; description?: string }>;
    };
    columnLineage?: {
      fields: Record<string, {
        inputFields: Array<{ namespace: string; name: string; field: string }>;
        transformationType?: string;
      }>;
    };
    [key: string]: unknown;
  };
}

export interface IngestResult {
  eventsProcessed: number;
  nodesCreated: number;
  edgesCreated: number;
  columnLineageEdges: number;
  errors: string[];
}

export class OpenLineageConsumer {
  private graphDB: IGraphDB;
  private customerId: string;

  constructor(graphDB: IGraphDB, customerId: string) {
    this.graphDB = graphDB;
    this.customerId = customerId;
  }

  /**
   * Ingest a batch of OpenLineage events into the graph DB.
   */
  async ingestEvents(events: OpenLineageRunEvent[]): Promise<IngestResult> {
    const result: IngestResult = {
      eventsProcessed: 0,
      nodesCreated: 0,
      edgesCreated: 0,
      columnLineageEdges: 0,
      errors: [],
    };

    for (const event of events) {
      try {
        await this.processEvent(event, result);
        result.eventsProcessed++;
      } catch (err) {
        result.errors.push(
          `Failed to process event ${event.run.runId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return result;
  }

  private async processEvent(event: OpenLineageRunEvent, result: IngestResult): Promise<void> {
    // Only process COMPLETE events for lineage (they have final inputs/outputs)
    if (event.eventType !== 'COMPLETE' && event.eventType !== 'RUNNING') return;

    // Create job node
    const jobId = `job:${event.job.namespace}:${event.job.name}`;
    if (!(await this.graphDB.getNode(jobId))) {
      await this.graphDB.addNode({
        id: jobId,
        type: 'pipeline',
        name: event.job.name,
        platform: event.job.namespace,
        properties: {
          namespace: event.job.namespace,
          lastRunId: event.run.runId,
          lastEventTime: event.eventTime,
          producer: event.producer,
        },
        customerId: this.customerId,
      });
      result.nodesCreated++;
    }

    // Create input dataset nodes and edges
    for (const input of event.inputs) {
      const inputId = `dataset:${input.namespace}:${input.name}`;
      if (!(await this.graphDB.getNode(inputId))) {
        await this.graphDB.addNode({
          id: inputId,
          type: 'table',
          name: input.name,
          platform: input.namespace,
          properties: {
            namespace: input.namespace,
            columns: input.facets?.schema?.fields ?? [],
          },
          customerId: this.customerId,
        });
        result.nodesCreated++;
      }

      // input → job edge
      await this.graphDB.addEdge({
        source: inputId,
        target: jobId,
        relationship: 'consumed_by',
        properties: { eventTime: event.eventTime },
      });
      result.edgesCreated++;
    }

    // Create output dataset nodes and edges
    for (const output of event.outputs) {
      const outputId = `dataset:${output.namespace}:${output.name}`;
      if (!(await this.graphDB.getNode(outputId))) {
        await this.graphDB.addNode({
          id: outputId,
          type: 'table',
          name: output.name,
          platform: output.namespace,
          properties: {
            namespace: output.namespace,
            columns: output.facets?.schema?.fields ?? [],
          },
          customerId: this.customerId,
        });
        result.nodesCreated++;
      }

      // job → output edge
      await this.graphDB.addEdge({
        source: jobId,
        target: outputId,
        relationship: 'produces',
        properties: { eventTime: event.eventTime },
      });
      result.edgesCreated++;

      // Direct input → output edges for lineage traversal
      for (const input of event.inputs) {
        const inputId = `dataset:${input.namespace}:${input.name}`;
        await this.graphDB.addEdge({
          source: inputId,
          target: outputId,
          relationship: 'derives_from',
          properties: { via: jobId },
        });
        result.edgesCreated++;
      }

      // Column-level lineage
      if (output.facets?.columnLineage) {
        for (const [targetCol, colInfo] of Object.entries(output.facets.columnLineage.fields)) {
          for (const inputField of colInfo.inputFields) {
            const sourceId = `dataset:${inputField.namespace}:${inputField.name}`;
            await this.graphDB.addEdge({
              source: sourceId,
              target: outputId,
              relationship: 'column_lineage',
              properties: {
                sourceColumn: inputField.field,
                targetColumn: targetCol,
                transformation: colInfo.transformationType ?? 'direct',
              },
            });
            result.columnLineageEdges++;
          }
        }
      }
    }
  }
}
