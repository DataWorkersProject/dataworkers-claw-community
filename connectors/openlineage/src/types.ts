/**
 * Type definitions for the OpenLineage/Marquez connector.
 */

export interface MarquezNamespace {
  name: string;
  createdAt: number;
  ownerName: string;
}

export interface DatasetField {
  name: string;
  type: string;
  description: string;
}

export interface MarquezDataset {
  name: string;
  namespace: string;
  sourceName: string;
  fields: DatasetField[];
  createdAt: number;
}

export interface MarquezJob {
  name: string;
  namespace: string;
  type: string;
  inputs: string[];
  outputs: string[];
  createdAt: number;
}

export interface MarquezLineageNode {
  id: string;
  type: 'DATASET' | 'JOB';
  data: Record<string, unknown>;
  inEdges: Array<{ origin: string }>;
  outEdges: Array<{ destination: string }>;
}

export interface MarquezLineageGraph {
  graph: MarquezLineageNode[];
}

export interface OpenLineageRunEvent {
  eventType: 'START' | 'RUNNING' | 'COMPLETE' | 'FAIL' | 'ABORT';
  eventTime: string;
  run: { runId: string };
  job: { namespace: string; name: string };
  inputs: Array<{ namespace: string; name: string }>;
  outputs: Array<{ namespace: string; name: string }>;
  producer: string;
}

/**
 * Connection configuration.
 */
export interface MarquezConnectionConfig {
  marquezUrl: string;
  openlineageUrl?: string;
  apiKey?: string;
}

/**
 * Interface that both stub and real clients implement.
 */
export interface IMarquezClient {
  seed(): void;
  listNamespaces(): MarquezNamespace[] | Promise<MarquezNamespace[]>;
  listDatasets(namespace: string): MarquezDataset[] | Promise<MarquezDataset[]>;
  listJobs(namespace: string): MarquezJob[] | Promise<MarquezJob[]>;
  getLineage(nodeId: string, depth?: number): MarquezLineageGraph | Promise<MarquezLineageGraph>;
  emitRunEvent(event: OpenLineageRunEvent): void | Promise<void>;
}
