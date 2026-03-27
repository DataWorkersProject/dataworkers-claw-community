/**
 * Local dbt manifest.json parser.
 * Parses and queries a dbt manifest without requiring the Cloud API.
 */

import { readFileSync } from 'node:fs';
import type { DbtManifest, DbtModel, DbtLineageEdge } from './types.js';

export class DbtManifestParser {
  private manifest: DbtManifest | null = null;

  /**
   * Create a DbtManifestParser from a manifest.json file on disk.
   * Reads and parses the file synchronously.
   */
  static fromFile(filePath: string): DbtManifestParser {
    const raw = readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);

    // Normalize a real dbt manifest.json into our DbtManifest shape
    const manifest: DbtManifest = {
      metadata: {
        dbtVersion: json.metadata?.dbt_version ?? json.metadata?.dbtVersion ?? 'unknown',
        projectName: json.metadata?.project_name ?? json.metadata?.projectName ?? 'unknown',
        generatedAt: json.metadata?.generated_at ?? json.metadata?.generatedAt ?? new Date().toISOString(),
      },
      nodes: normalizeNodes(json.nodes ?? {}),
      sources: normalizeNodes(json.sources ?? {}),
    };

    const parser = new DbtManifestParser();
    parser.parse(manifest);
    return parser;
  }

  /** Parse and store a manifest. */
  parse(manifest: DbtManifest): void {
    this.manifest = manifest;
  }

  /** List all model nodes from the manifest. */
  listModels(): DbtModel[] {
    this.ensureParsed();
    return Object.values(this.manifest!.nodes);
  }

  /** Get a specific model by uniqueId (checks both nodes and sources). */
  getModel(uniqueId: string): DbtModel {
    this.ensureParsed();
    const model = this.manifest!.nodes[uniqueId] ?? this.manifest!.sources[uniqueId];
    if (!model) {
      throw new Error(`Model not found in manifest: ${uniqueId}`);
    }
    return model;
  }

  /** Build lineage edges for a model by tracing dependsOn. */
  getModelLineage(uniqueId: string): DbtLineageEdge[] {
    this.ensureParsed();
    const model = this.manifest!.nodes[uniqueId] ?? this.manifest!.sources[uniqueId];
    if (!model) {
      throw new Error(`Model not found in manifest: ${uniqueId}`);
    }

    const edges: DbtLineageEdge[] = [];

    // Parents (this model depends on)
    for (const parentId of model.dependsOn) {
      edges.push({
        parent: parentId,
        child: uniqueId,
        relationship: parentId.startsWith('source.') ? 'source' : 'ref',
      });
    }

    // Children (models that depend on this one)
    for (const [childId, childModel] of Object.entries(this.manifest!.nodes)) {
      if (childModel.dependsOn.includes(uniqueId)) {
        edges.push({
          parent: uniqueId,
          child: childId,
          relationship: 'ref',
        });
      }
    }

    return edges;
  }

  /** Get the parsed manifest metadata. */
  getMetadata(): DbtManifest['metadata'] {
    this.ensureParsed();
    return this.manifest!.metadata;
  }

  private ensureParsed(): void {
    if (!this.manifest) {
      throw new Error('No manifest loaded. Call parse() first.');
    }
  }
}

/**
 * Normalize raw dbt manifest nodes into our DbtModel shape.
 * Handles both our internal format and the real dbt manifest format (snake_case keys).
 */
function normalizeNodes(nodes: Record<string, any>): Record<string, DbtModel> {
  const result: Record<string, DbtModel> = {};
  for (const [key, node] of Object.entries(nodes)) {
    // Skip non-model resource types unless they are sources
    if (node.resource_type && node.resource_type !== 'model' && node.resource_type !== 'source') {
      continue;
    }

    const uniqueId = node.unique_id ?? node.uniqueId ?? key;
    const columns = node.columns
      ? (typeof node.columns === 'object' && !Array.isArray(node.columns))
        ? Object.values(node.columns).map((col: any) => ({
            name: col.name,
            description: col.description ?? '',
            type: col.data_type ?? col.type ?? 'unknown',
            tests: col.tests ?? [],
          }))
        : (node.columns as DbtModel['columns'])
      : [];

    result[uniqueId] = {
      uniqueId,
      name: node.name ?? '',
      schema: node.schema ?? '',
      database: node.database ?? '',
      materialization: (node.config?.materialized ?? node.materialization ?? 'view') as DbtModel['materialization'],
      description: node.description ?? '',
      columns,
      dependsOn: node.depends_on?.nodes ?? node.dependsOn ?? [],
      tags: node.tags ?? [],
    };
  }
  return result;
}
