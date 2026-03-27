/**
 * Type definitions for the Apache Iceberg REST Catalog connector.
 */

export interface IcebergNamespace {
  name: string[];
  properties: Record<string, string>;
}

export interface IcebergTable {
  namespace: string[];
  name: string;
}

export interface IcebergField {
  id: number;
  name: string;
  type: string;
  required: boolean;
  doc?: string;
}

export interface IcebergSchema {
  schemaId: number;
  fields: IcebergField[];
}

export interface IcebergPartitionSpec {
  specId: number;
  fields: {
    sourceId: number;
    fieldId: number;
    name: string;
    transform: string;
  }[];
}

export interface IcebergSortOrder {
  orderId: number;
  fields: {
    sourceId: number;
    direction: 'asc' | 'desc';
    nullOrder: 'first' | 'last';
  }[];
}

export interface IcebergSnapshot {
  snapshotId: number;
  timestamp: number;
  summary: {
    operation: string;
    totalRecords?: number;
    totalDataFiles?: number;
    totalSizeBytes?: number;
  };
}

export interface IcebergTableMetadata {
  tableId: string;
  schema: IcebergSchema;
  partitionSpec: IcebergPartitionSpec;
  sortOrder: IcebergSortOrder;
  currentSnapshotId: number;
  snapshots: IcebergSnapshot[];
  properties: Record<string, string>;
}
