/**
 * Type definitions for the Apache Nessie catalog versioning connector.
 */

export interface NessieBranch {
  name: string;
  hash: string;
  type: 'BRANCH' | 'TAG';
}

export interface NessieContentKey {
  elements: string[];
}

export interface NessieEntry {
  type: 'ICEBERG_TABLE' | 'DELTA_LAKE_TABLE' | 'NAMESPACE';
  key: NessieContentKey;
  contentId: string;
}

export interface NessieIcebergTable {
  id: string;
  metadataLocation: string;
  snapshotId: number;
  schemaId: number;
  specId: number;
  sortOrderId: number;
}

export interface NessieDiff {
  key: NessieContentKey;
  from: string | null;
  to: string | null;
}

export interface NessieCommit {
  hash: string;
  message: string;
  author: string;
  commitTime: string;
}

/**
 * Interface that both stub and real Nessie clients implement.
 */
export interface INessieClient {
  seed(): void;
  listReferences(): NessieBranch[] | Promise<NessieBranch[]>;
  listContent(ref: string): NessieEntry[] | Promise<NessieEntry[]>;
  getContent(ref: string, key: NessieContentKey): NessieIcebergTable | Promise<NessieIcebergTable>;
  createBranch(name: string, from: string): NessieBranch | Promise<NessieBranch>;
  mergeBranch(from: string, to: string): { hash: string } | Promise<{ hash: string }>;
  diffRefs(from: string, to: string): NessieDiff[] | Promise<NessieDiff[]>;
  commitLog(ref: string): NessieCommit[] | Promise<NessieCommit[]>;
}
