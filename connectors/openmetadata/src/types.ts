/**
 * Type definitions for the OpenMetadata connector.
 */

export interface OMDatabase {
  id: string;
  name: string;
  fullyQualifiedName: string;
  service: string;
}

export interface OMTag {
  tagFQN: string;
  source: string;
}

export interface OMColumn {
  name: string;
  dataType: string;
  description: string;
  tags: OMTag[];
}

export interface OMTable {
  id: string;
  name: string;
  fullyQualifiedName: string;
  columns: OMColumn[];
  database: string;
  tags: OMTag[];
}

export interface OMLineageEdge {
  fromEntity: string;
  toEntity: string;
}

export interface OMLineageGraph {
  entity: string;
  nodes: string[];
  upstreamEdges: OMLineageEdge[];
  downstreamEdges: OMLineageEdge[];
}

export interface OMQualityTestResult {
  name: string;
  testDefinition: string;
  testCaseStatus: 'Success' | 'Failed' | 'Aborted';
  timestamp: number;
}

/**
 * Connection configuration for a real OpenMetadata client.
 */
export interface OpenMetadataConnectionConfig {
  url: string;
  token: string;
}

/**
 * Interface that both stub and real OpenMetadata clients implement.
 */
export interface IOpenMetadataClient {
  seed(): void;
  listDatabases(): OMDatabase[] | Promise<OMDatabase[]>;
  listTables(database: string): OMTable[] | Promise<OMTable[]>;
  getTable(tableId: string): OMTable | Promise<OMTable>;
  searchTables(query: string): OMTable[] | Promise<OMTable[]>;
  getLineage(tableId: string, direction: 'upstream' | 'downstream', depth?: number): OMLineageGraph | Promise<OMLineageGraph>;
  getQualityTests(tableId: string): OMQualityTestResult[] | Promise<OMQualityTestResult[]>;
}
