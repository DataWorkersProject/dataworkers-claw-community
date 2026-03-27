/**
 * InMemoryContextFeedbackStore — 
 * In-memory implementation of IContextFeedbackStore for development and testing.
 */

import type { IContextFeedbackStore, ContextFeedbackRecord } from './interfaces/index.js';

export class InMemoryContextFeedbackStore implements IContextFeedbackStore {
  private feedback = new Map<string, ContextFeedbackRecord>();

  async recordFeedback(record: ContextFeedbackRecord): Promise<void> {
    this.feedback.set(record.id, { ...record });
  }

  async getFeedbackForAsset(assetId: string): Promise<ContextFeedbackRecord[]> {
    const results: ContextFeedbackRecord[] = [];
    for (const fb of this.feedback.values()) {
      if (fb.assetId === assetId) {
        results.push({ ...fb });
      }
    }
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getAggregatedScore(assetId: string): Promise<{ positive: number; negative: number; total: number; score: number }> {
    const items = await this.getFeedbackForAsset(assetId);
    let positive = 0;
    let negative = 0;
    for (const fb of items) {
      if (fb.feedbackType === 'positive' || fb.feedbackType === 'upvote' || fb.feedbackType === 'endorse') {
        positive++;
      } else if (fb.feedbackType === 'negative' || fb.feedbackType === 'downvote' || fb.feedbackType === 'correction') {
        negative++;
      }
    }
    const total = items.length;
    const score = total > 0 ? positive / total : 0;
    return { positive, negative, total, score };
  }

  seed(): void {
    // Seed feedback added via backends.ts
  }
}
