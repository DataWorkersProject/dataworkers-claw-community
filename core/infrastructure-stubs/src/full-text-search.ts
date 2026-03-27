/**
 * In-memory full-text search stub with BM25-approximated scoring.
 */

import { getSeedAssets } from './vector-store.js';

export interface FTSDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  customerId: string;
}

interface IndexEntry {
  docId: string;
  termFrequency: number;
  totalTerms: number;
}

export interface FTSResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

import type { IFullTextSearch } from './interfaces/index.js';

export class InMemoryFullTextSearch implements IFullTextSearch {
  private documents: Map<string, FTSDocument> = new Map();
  private invertedIndex: Map<string, Map<string, IndexEntry>> = new Map();

  /**
   * Tokenize text into lowercase terms.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  async index(id: string, content: string, metadata: Record<string, unknown>, customerId: string): Promise<void> {
    // Remove existing entry if present (call internal sync logic directly
    // so seed() can call index() without awaiting)
    this.removeSync(id);

    this.documents.set(id, { id, content, metadata, customerId });

    const tokens = this.tokenize(content);
    const totalTerms = tokens.length;
    const termCounts = new Map<string, number>();

    for (const token of tokens) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
    }

    for (const [term, count] of termCounts.entries()) {
      if (!this.invertedIndex.has(term)) {
        this.invertedIndex.set(term, new Map());
      }
      this.invertedIndex.get(term)!.set(id, {
        docId: id,
        termFrequency: count,
        totalTerms,
      });
    }
  }

  async search(query: string, customerId: string, limit: number): Promise<FTSResult[]> {
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) return [];

    const totalDocs = this.documents.size;
    const scores = new Map<string, number>();

    for (const term of queryTerms) {
      const postings = this.invertedIndex.get(term);
      if (!postings) continue;

      const df = postings.size;
      const idf = Math.log((totalDocs) / (df + 1));

      for (const [docId, entry] of postings.entries()) {
        const doc = this.documents.get(docId);
        if (!doc || doc.customerId !== customerId) continue;

        const tf = entry.termFrequency / entry.totalTerms;
        const score = tf * idf;

        scores.set(docId, (scores.get(docId) || 0) + score);
      }
    }

    const results: FTSResult[] = [];
    for (const [docId, score] of scores.entries()) {
      const doc = this.documents.get(docId)!;
      results.push({ id: docId, score, metadata: doc.metadata });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private removeSync(id: string): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;

    this.documents.delete(id);

    // Remove from inverted index
    for (const [term, postings] of this.invertedIndex.entries()) {
      postings.delete(id);
      if (postings.size === 0) {
        this.invertedIndex.delete(term);
      }
    }

    return true;
  }

  async remove(id: string): Promise<boolean> {
    return this.removeSync(id);
  }

  seed(): void {
    const assets = getSeedAssets();
    for (const asset of assets) {
      const content = `${asset.name} ${asset.description} ${asset.tags.join(' ')}`;
      this.index(asset.id, content, {
        name: asset.name,
        type: asset.type,
        platform: asset.platform,
        description: asset.description,
        tags: asset.tags,
        owner: asset.owner,
        qualityScore: asset.qualityScore,
        freshnessScore: asset.freshnessScore,
        customerId: asset.customerId,
      }, asset.customerId);
    }
  }
}
