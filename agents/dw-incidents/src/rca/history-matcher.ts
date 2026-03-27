import type { IVectorStore, IRelationalStore } from '@data-workers/infrastructure-stubs';
import type { Incident, IncidentType } from '../types.js';

/**
 * Incident History Matcher (REQ-INC-002).
 *
 * Cross-references current incident against historical incidents
 * using vector similarity for pattern matching.
 * Returns resolution patterns from past similar incidents.
 */

export interface MatchResult {
  incident: Incident;
  similarity: number;
  resolutionPattern?: string;
  timeToResolve?: number;
}

// --- Hierarchical Knowledge Levels ---

export interface KnowledgeLevel {
  level: 1 | 2 | 3;
  label: 'individual' | 'pattern' | 'category';
  entries: KnowledgeEntry[];
}

export interface KnowledgeEntry {
  id: string;
  summary: string;
  confidence: number;
  supportingIncidentIds: string[];
  lastUpdated: number;
}

export class HistoryMatcher {
  private patterns = new Map<string, KnowledgeEntry>();

  constructor(
    private vectorStore: IVectorStore,
    private relationalStore: IRelationalStore,
  ) {}

  /**
   * Add an incident to history for future matching.
   */
  async addToHistory(incident: Incident): Promise<void> {
    // Embed and store in vector store for similarity search
    try {
      const description = `${incident.type} ${incident.severity} incident on ${incident.affectedResources.join(', ')}`;
      const vector = await this.vectorStore.embed(description);
      await this.vectorStore.upsert(incident.id, vector, {
        customerId: incident.customerId,
        type: incident.type,
        severity: incident.severity,
        affectedResources: incident.affectedResources,
      }, 'incidents');
    } catch { /* Don't crash on embedding failure */ }
  }

  /**
   * Find similar historical incidents.
   * Uses vector similarity via the injected vector store.
   */
  async findSimilar(
    currentType: IncidentType,
    affectedResources: string[],
    customerId: string,
    limit = 5,
  ): Promise<MatchResult[]> {
    // Step 1: Vector similarity search
    const description = `${currentType} incident on ${affectedResources.join(', ')}`;
    let vectorResults: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];
    try {
      const queryVector = await this.vectorStore.embed(description);
      vectorResults = await this.vectorStore.query(queryVector, limit * 2, 'incidents', (meta) => {
        return meta.customerId === customerId;
      });
    } catch { /* Fallback to empty */ }

    // Step 2: Enrich from relational store
    const results: MatchResult[] = [];
    for (const vr of vectorResults) {
      const rows = await this.relationalStore.query('incidents', (row) => row.id === vr.id);
      if (rows.length === 0) continue;
      const row = rows[0];

      const incident: Incident = {
        id: row.id as string,
        customerId: row.customerId as string,
        type: row.type as IncidentType,
        severity: row.severity as Incident['severity'],
        status: (row.status as Incident['status']) ?? 'resolved',
        title: (row.title as string) ?? '',
        description: (row.description as string) ?? '',
        affectedResources: (() => { try { return JSON.parse(row.affectedResources as string); } catch { return []; } })(),
        detectedAt: row.detectedAt as number,
        resolvedAt: row.resolvedAt as number | undefined,
        confidence: row.confidence as number,
        metadata: {},
      };

      // Step 3: Composite scoring (vector similarity + type match + resource overlap + recency)
      let similarity = vr.score * 0.4; // Vector similarity contributes 40%
      if (incident.type === currentType) similarity += 0.3; // Type match 30%
      const overlap = incident.affectedResources.filter(r => affectedResources.includes(r)).length;
      similarity += (overlap / Math.max(affectedResources.length, 1)) * 0.2; // Resource overlap 20%
      const ageHours = (Date.now() - incident.detectedAt) / 3_600_000;
      if (ageHours < 24) similarity += 0.1;
      else if (ageHours < 168) similarity += 0.05; // Recency 10%

      results.push({
        incident,
        similarity: Math.min(1.0, similarity),
        resolutionPattern: row.playbook as string | undefined,
        timeToResolve: incident.resolvedAt ? incident.resolvedAt - incident.detectedAt : undefined,
      });
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  /**
   * Get resolution success rate for a given incident type.
   */
  async getResolutionStats(customerId: string, type?: IncidentType): Promise<{
    total: number;
    resolved: number;
    autoResolved: number;
    avgTimeToResolveMs: number;
  }> {
    const rows = await this.relationalStore.query('incidents', (row) => {
      if (row.customerId !== customerId) return false;
      if (type && row.type !== type) return false;
      return true;
    });
    const resolved = rows.filter(r => r.status === 'resolved');
    const autoResolved = resolved.filter(r => r.resolution === 'automated');
    const withTime = resolved.filter(r => r.resolvedAt);
    const avgTime = withTime.length > 0
      ? withTime.reduce((sum, r) => sum + ((r.resolvedAt as number) - (r.detectedAt as number)), 0) / withTime.length
      : 0;
    return { total: rows.length, resolved: resolved.length, autoResolved: autoResolved.length, avgTimeToResolveMs: avgTime };
  }

  /**
   * Build hierarchical knowledge from incident history.
   * Level 1: Individual incidents (existing vector search)
   * Level 2: Recurring patterns ("schema changes on orders happen Tuesdays")
   * Level 3: Root cause categories ("source_delay is 80% Fivetran sync failures")
   */
  async buildKnowledge(customerId: string): Promise<KnowledgeLevel[]> {
    // Level 1: Individual incidents from relational store
    const incidents = await this.relationalStore.query('incidents',
      (row) => row.customerId === customerId,
      { column: 'detectedAt', direction: 'desc' },
      100
    );

    // Level 2: Pattern detection — group by type + resource
    const patternGroups = new Map<string, typeof incidents>();
    for (const inc of incidents) {
      const key = `${inc.type}:${inc.affectedResources}`;
      if (!patternGroups.has(key)) patternGroups.set(key, []);
      patternGroups.get(key)!.push(inc);
    }

    const level2: KnowledgeEntry[] = [];
    for (const [key, group] of patternGroups) {
      if (group.length >= 2) { // Pattern = 2+ occurrences
        const [type, resource] = key.split(':');
        const entry: KnowledgeEntry = {
          id: `pattern-${key}`,
          summary: `${type} incidents on ${resource}: ${group.length} occurrences`,
          confidence: Math.min(0.95, 0.5 + group.length * 0.1),
          supportingIncidentIds: group.map(g => g.id as string),
          lastUpdated: Date.now(),
        };
        level2.push(entry);
        this.patterns.set(key, entry);
      }
    }

    // Level 3: Category-level insights
    const typeGroups = new Map<string, typeof incidents>();
    for (const inc of incidents) {
      const type = inc.type as string;
      if (!typeGroups.has(type)) typeGroups.set(type, []);
      typeGroups.get(type)!.push(inc);
    }

    const level3: KnowledgeEntry[] = [];
    for (const [type, group] of typeGroups) {
      const autoResolved = group.filter(g => g.resolution === 'automated');
      const autoRate = group.length > 0 ? (autoResolved.length / group.length * 100).toFixed(0) : '0';
      level3.push({
        id: `category-${type}`,
        summary: `${type}: ${group.length} total, ${autoRate}% auto-resolved`,
        confidence: 0.9,
        supportingIncidentIds: group.map(g => g.id as string),
        lastUpdated: Date.now(),
      });
    }

    return [
      { level: 1, label: 'individual', entries: incidents.map(i => ({ id: i.id as string, summary: `${i.type} on ${i.affectedResources}`, confidence: i.confidence as number, supportingIncidentIds: [i.id as string], lastUpdated: i.detectedAt as number })) },
      { level: 2, label: 'pattern', entries: level2 },
      { level: 3, label: 'category', entries: level3 },
    ];
  }
}
