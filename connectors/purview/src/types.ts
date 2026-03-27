/**
 * Type definitions for the Azure Purview data governance connector.
 */

export interface PurviewEntity {
  guid: string;
  typeName: string;
  attributes: Record<string, unknown>;
  status: string;
  classifications: string[];
}

export interface PurviewSearchResult {
  entities: PurviewEntity[];
  searchCount: number;
}

export interface PurviewLineageRelation {
  fromEntityId: string;
  toEntityId: string;
  relationshipType: string;
}

export interface PurviewLineageResult {
  guidEntityMap: Record<string, PurviewEntity>;
  relations: PurviewLineageRelation[];
}

export interface PurviewGlossaryTerm {
  guid: string;
  qualifiedName: string;
  shortDescription: string;
  status: string;
}

export interface PurviewCollection {
  name: string;
  friendlyName: string;
  parentCollection: string;
}

/**
 * Interface that both stub and real Purview clients implement.
 */
export interface IPurviewClient {
  seed(): void;
  searchEntities(query: string): PurviewSearchResult | Promise<PurviewSearchResult>;
  getEntity(guid: string): PurviewEntity | Promise<PurviewEntity>;
  getLineage(guid: string): PurviewLineageResult | Promise<PurviewLineageResult>;
  listGlossaryTerms(): PurviewGlossaryTerm[] | Promise<PurviewGlossaryTerm[]>;
  listCollections(): PurviewCollection[] | Promise<PurviewCollection[]>;
}
