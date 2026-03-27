/**
 * Entity Resolution Module.
 *
 * Matches data assets across platforms using 4 confidence tiers:
 *  1. Exact qualified name match (1.0)
 *  2. Fuzzy qualified name match (0.8)
 *  3. Lineage-inferred match (0.7)
 *  4. Alias-based match (0.6)
 *
 * Implements inline Levenshtein distance — no external deps.
 */

import type { IGraphDB, GraphNode } from '@data-workers/infrastructure-stubs';
import type { CatalogRegistry } from '@data-workers/connector-shared';

export interface EntityMatch {
  assetId: string;
  assetName: string;
  platform: string;
  confidence: number;
  method: 'exact_qualified' | 'fuzzy_qualified' | 'lineage_inferred' | 'alias_based';
  qualifiedName?: string;
  entityType?: string;
}

export interface ResolveOptions {
  maxCandidates?: number;
  minConfidence?: number;
  platforms?: string[];
  /** Filter results to only include assets of this entity type (e.g. 'table', 'model', 'dashboard'). */
  entityType?: string;
}

interface CacheEntry {
  results: EntityMatch[];
  timestamp: number;
}

const CACHE_TTL_MS = 200;
const DEFAULT_MAX_CANDIDATES = 5;
const DEFAULT_MIN_CONFIDENCE = 0.5;
const FUZZY_THRESHOLD = 4; // max Levenshtein distance for fuzzy match

/**
 * Compute Levenshtein distance between two strings.
 * Uses a single-row DP approach for O(min(m,n)) space.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space efficiency
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const aLen = a.length;
  const bLen = b.length;
  const row = new Array<number>(aLen + 1);

  for (let i = 0; i <= aLen; i++) row[i] = i;

  for (let j = 1; j <= bLen; j++) {
    let prev = row[0];
    row[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const temp = row[i];
      row[i] = Math.min(
        row[i] + 1,      // deletion
        row[i - 1] + 1,  // insertion
        prev + cost,      // substitution
      );
      prev = temp;
    }
  }

  return row[aLen];
}

/**
 * Extract the table name portion from a potentially qualified identifier.
 * E.g. "analytics.public.orders" → "orders", "stg_orders" → "stg_orders"
 */
function extractTableName(identifier: string): string {
  const parts = identifier.split('.');
  return parts[parts.length - 1];
}

/**
 * Build a qualified name from a graph node's properties.
 */
function buildQualifiedName(node: GraphNode): string {
  const db = node.properties.database as string | undefined;
  const schema = node.properties.schema as string | undefined;
  const parts: string[] = [];
  if (db) parts.push(db);
  if (schema) parts.push(schema);
  parts.push(node.name);
  return parts.join('.');
}

export class EntityResolver {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private graphDB: IGraphDB,
    private catalogRegistry?: CatalogRegistry,
  ) {}

  async resolve(
    assetIdentifier: string,
    customerId: string,
    options?: ResolveOptions,
  ): Promise<EntityMatch[]> {
    const maxCandidates = options?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
    const minConfidence = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const platforms = options?.platforms;
    const entityType = options?.entityType;

    // Check cache
    const cacheKey = `${customerId}:${assetIdentifier}:${maxCandidates}:${minConfidence}:${platforms?.join(',') ?? ''}:${entityType ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.results;
    }

    const matches = new Map<string, EntityMatch>();

    // Fetch all nodes for this customer
    const allNodes = await this.graphDB.getAllNodes();
    const customerNodes = allNodes.filter(n => n.customerId === customerId);
    const filteredNodes = platforms
      ? customerNodes.filter(n => platforms.includes(n.platform))
      : customerNodes;

    const identifierLower = assetIdentifier.toLowerCase();
    const tablePortion = extractTableName(assetIdentifier).toLowerCase();

    // --- Tier 1: Exact qualified name match (confidence 1.0) ---
    for (const node of filteredNodes) {
      const qualifiedName = buildQualifiedName(node).toLowerCase();
      const nameLower = node.name.toLowerCase();

      if (qualifiedName === identifierLower || nameLower === identifierLower) {
        matches.set(node.id, {
          assetId: node.id,
          assetName: node.name,
          platform: node.platform,
          confidence: 1.0,
          method: 'exact_qualified',
          qualifiedName: buildQualifiedName(node),
          entityType: node.type,
        });
      }
    }

    // --- Tier 2: Fuzzy qualified name match (confidence 0.8) ---
    for (const node of filteredNodes) {
      if (matches.has(node.id)) continue;

      const nodeTableName = extractTableName(node.name).toLowerCase();
      const dist = levenshtein(tablePortion, nodeTableName);

      if (dist > 0 && dist <= FUZZY_THRESHOLD) {
        // Scale confidence: closer distance → higher confidence
        // Range: [0.5, 0.8] based on edit distance ratio
        const maxLen = Math.max(tablePortion.length, nodeTableName.length);
        const similarity = 1 - dist / maxLen;
        const confidence = Math.round((0.5 + similarity * 0.3) * 100) / 100;

        if (confidence >= minConfidence) {
          matches.set(node.id, {
            assetId: node.id,
            assetName: node.name,
            platform: node.platform,
            confidence,
            method: 'fuzzy_qualified',
            qualifiedName: buildQualifiedName(node),
            entityType: node.type,
          });
        }
      }
    }

    // --- Tier 3: Lineage-inferred match (confidence 0.7) ---
    // Find exact/fuzzy matches and expand via graph edges
    const seedIds = Array.from(matches.keys());
    for (const seedId of seedIds) {
      const [upstream, downstream] = await Promise.all([
        this.graphDB.traverseUpstream(seedId, 1),
        this.graphDB.traverseDownstream(seedId, 1),
      ]);

      const neighbors = [...upstream, ...downstream];
      for (const { node } of neighbors) {
        if (matches.has(node.id)) continue;
        if (node.customerId !== customerId) continue;
        if (platforms && !platforms.includes(node.platform)) continue;

        matches.set(node.id, {
          assetId: node.id,
          assetName: node.name,
          platform: node.platform,
          confidence: 0.7,
          method: 'lineage_inferred',
          qualifiedName: buildQualifiedName(node),
          entityType: node.type,
        });
      }
    }

    // --- Tier 4: Alias-based match (confidence 0.6) ---
    for (const node of filteredNodes) {
      if (matches.has(node.id)) continue;

      const tags = (node.properties.tags as string[]) || [];
      const aliases = (node.properties.aliases as string[]) || [];
      const description = ((node.properties.description as string) || '').toLowerCase();

      const searchTerms = [...tags.map(t => t.toLowerCase()), ...aliases.map(a => a.toLowerCase())];

      const matchesByAlias =
        searchTerms.some(term => term === tablePortion || term.includes(tablePortion)) ||
        description.includes(tablePortion);

      if (matchesByAlias) {
        matches.set(node.id, {
          assetId: node.id,
          assetName: node.name,
          platform: node.platform,
          confidence: 0.6,
          method: 'alias_based',
          qualifiedName: buildQualifiedName(node),
          entityType: node.type,
        });
      }
    }

    // Filter by entity type if specified (prevent cross-type matching)
    let candidates = Array.from(matches.values())
      .filter(m => m.confidence >= minConfidence);

    if (entityType) {
      candidates = candidates.filter(m => {
        const node = filteredNodes.find(n => n.id === m.assetId);
        return node ? node.type === entityType : true;
      });
    }

    // Sort by confidence descending, with exact name match preference.
    // When two candidates share the same confidence tier, prefer the one whose
    // asset name exactly matches the query's table portion — this prevents
    // "orders" from resolving to "raw_orders" when an exact "orders" exists.
    const results = candidates
      .sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        const aExact = a.assetName.toLowerCase() === tablePortion ? 1 : 0;
        const bExact = b.assetName.toLowerCase() === tablePortion ? 1 : 0;
        return bExact - aExact;
      })
      .slice(0, maxCandidates);

    // Cache results
    this.cache.set(cacheKey, { results, timestamp: Date.now() });

    return results;
  }
}
