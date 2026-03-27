/**
 * Stubbed Azure Purview client.
 * Uses in-memory stores to simulate Purview REST API.
 */

import type {
  IPurviewClient,
  PurviewEntity,
  PurviewSearchResult,
  PurviewLineageResult,
  PurviewLineageRelation,
  PurviewGlossaryTerm,
  PurviewCollection,
} from './types.js';

export class PurviewStubClient implements IPurviewClient {
  private entities: Map<string, PurviewEntity> = new Map();
  private lineageRelations: Map<string, PurviewLineageRelation[]> = new Map();
  private glossaryTerms: PurviewGlossaryTerm[] = [];
  private collections: PurviewCollection[] = [];
  private seeded = false;

  /** Pre-load with realistic Purview metadata. */
  seed(): void {
    if (this.seeded) return;

    // --- Entities ---
    const entities: PurviewEntity[] = [
      {
        guid: 'pv-001',
        typeName: 'azure_sql_table',
        attributes: { qualifiedName: 'mssql://server.database.dbo.customers', name: 'customers', description: 'Customer master data' },
        status: 'ACTIVE',
        classifications: ['PII', 'Confidential'],
      },
      {
        guid: 'pv-002',
        typeName: 'azure_sql_table',
        attributes: { qualifiedName: 'mssql://server.database.dbo.orders', name: 'orders', description: 'Orders fact table' },
        status: 'ACTIVE',
        classifications: ['Internal'],
      },
      {
        guid: 'pv-003',
        typeName: 'azure_datalake_gen2_path',
        attributes: { qualifiedName: 'adl://datalake.blob.core.windows.net/raw/events/', name: 'events', description: 'Raw event data' },
        status: 'ACTIVE',
        classifications: [],
      },
      {
        guid: 'pv-004',
        typeName: 'azure_sql_table',
        attributes: { qualifiedName: 'mssql://server.database.dbo.daily_revenue', name: 'daily_revenue', description: 'Daily revenue aggregation' },
        status: 'ACTIVE',
        classifications: ['Internal', 'Financial'],
      },
      {
        guid: 'pv-005',
        typeName: 'azure_sql_column',
        attributes: { qualifiedName: 'mssql://server.database.dbo.customers#email', name: 'email', description: 'Customer email address' },
        status: 'ACTIVE',
        classifications: ['PII', 'Email'],
      },
      {
        guid: 'pv-006',
        typeName: 'azure_datalake_gen2_path',
        attributes: { qualifiedName: 'adl://datalake.blob.core.windows.net/curated/metrics/', name: 'metrics', description: 'Curated metrics data' },
        status: 'ACTIVE',
        classifications: [],
      },
    ];

    for (const e of entities) {
      this.entities.set(e.guid, e);
    }

    // --- Lineage ---
    this.lineageRelations.set('pv-004', [
      { fromEntityId: 'pv-002', toEntityId: 'pv-004', relationshipType: 'process' },
      { fromEntityId: 'pv-001', toEntityId: 'pv-004', relationshipType: 'process' },
    ]);
    this.lineageRelations.set('pv-002', [
      { fromEntityId: 'pv-003', toEntityId: 'pv-002', relationshipType: 'process' },
    ]);

    // --- Glossary Terms ---
    this.glossaryTerms = [
      { guid: 'gt-001', qualifiedName: 'Glossary.Revenue', shortDescription: 'Total revenue from sales', status: 'Approved' },
      { guid: 'gt-002', qualifiedName: 'Glossary.Customer', shortDescription: 'An individual or organization that purchases goods', status: 'Approved' },
      { guid: 'gt-003', qualifiedName: 'Glossary.PII', shortDescription: 'Personally identifiable information', status: 'Approved' },
      { guid: 'gt-004', qualifiedName: 'Glossary.DataQuality', shortDescription: 'Measure of data fitness for use', status: 'Draft' },
    ];

    // --- Collections ---
    this.collections = [
      { name: 'root', friendlyName: 'Root Collection', parentCollection: '' },
      { name: 'finance', friendlyName: 'Finance', parentCollection: 'root' },
      { name: 'marketing', friendlyName: 'Marketing', parentCollection: 'root' },
      { name: 'engineering', friendlyName: 'Engineering', parentCollection: 'root' },
    ];

    this.seeded = true;
  }

  /** Search entities by name, type, or classification. */
  searchEntities(query: string): PurviewSearchResult {
    const q = query.toLowerCase();
    const results: PurviewEntity[] = [];
    for (const entity of this.entities.values()) {
      const name = String(entity.attributes['name'] ?? '').toLowerCase();
      const desc = String(entity.attributes['description'] ?? '').toLowerCase();
      if (
        name.includes(q) ||
        desc.includes(q) ||
        entity.typeName.toLowerCase().includes(q) ||
        entity.classifications.some((c) => c.toLowerCase().includes(q))
      ) {
        results.push(entity);
      }
    }
    return { entities: results, searchCount: results.length };
  }

  /** Get a specific entity by GUID. */
  getEntity(guid: string): PurviewEntity {
    const entity = this.entities.get(guid);
    if (!entity) {
      throw new Error(`Entity not found: ${guid}`);
    }
    return entity;
  }

  /** Get lineage for an entity. */
  getLineage(guid: string): PurviewLineageResult {
    const relations = this.lineageRelations.get(guid) ?? [];
    const guidEntityMap: Record<string, PurviewEntity> = {};

    // Add the root entity
    const rootEntity = this.entities.get(guid);
    if (rootEntity) {
      guidEntityMap[guid] = rootEntity;
    }

    // Add related entities
    for (const rel of relations) {
      const fromEntity = this.entities.get(rel.fromEntityId);
      const toEntity = this.entities.get(rel.toEntityId);
      if (fromEntity) guidEntityMap[rel.fromEntityId] = fromEntity;
      if (toEntity) guidEntityMap[rel.toEntityId] = toEntity;
    }

    return { guidEntityMap, relations };
  }

  /** List all glossary terms. */
  listGlossaryTerms(): PurviewGlossaryTerm[] {
    return this.glossaryTerms;
  }

  /** List all collections. */
  listCollections(): PurviewCollection[] {
    return this.collections;
  }
}
