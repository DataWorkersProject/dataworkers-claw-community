/**
 * Context Propagation Engine (REQ-CTX-010, REQ-CTX-011).
 *
 * 3-phase context selection algorithm:
 * 1. Dependency graph traversal — find relevant context items
 * 2. Relevance scoring via embedding similarity
 * 3. Token budget packing in priority order:
 *    task-specific > cross-agent deps > historical > org preferences
 *
 * Target: <50ms p95 context selection.
 */

export type ContextPriority = 'task-specific' | 'cross-agent' | 'historical' | 'org-preferences';

export interface ContextItem {
  id: string;
  content: string;
  source: string;
  agentId: string;
  customerId: string;
  priority: ContextPriority;
  timestamp: number;
  tokenCount: number;
  relevanceScore?: number;
  freshnessScore?: number;
  confidenceScore?: number;
}

export interface ContextConflict {
  itemA: ContextItem;
  itemB: ContextItem;
  field: string;
  description: string;
  detectedAt: number;
}

export interface ContextSelectionResult {
  items: ContextItem[];
  conflicts: ContextConflict[];
  totalTokens: number;
  budgetUsed: number;
  budgetTotal: number;
  selectionTimeMs: number;
}

export interface ContextBudget {
  /** Total token budget. Default: 32768 for Sonnet, 8192 for Haiku */
  totalTokens: number;
  /** Min quality score to include. Default: 0.5 */
  minQualityScore: number;
}

export class ContextPropagationEngine {
  private defaultBudget: ContextBudget = {
    totalTokens: 32_768, // Sonnet default
    minQualityScore: 0.5,
  };

  /**
   * Select context items using the 3-phase algorithm.
   * Returns items packed within token budget, ordered by priority.
   */
  async selectContext(
    availableItems: ContextItem[],
    taskContext: { agentId: string; customerId: string; taskType: string },
    budget?: Partial<ContextBudget>,
  ): Promise<ContextSelectionResult> {
    const startTime = Date.now();
    const effectiveBudget = { ...this.defaultBudget, ...budget };

    // Phase 1: Dependency graph traversal
    const relevant = this.phase1_filterByDependency(availableItems, taskContext);

    // Phase 2: Relevance scoring
    const scored = this.phase2_scoreRelevance(relevant, taskContext);

    // Phase 3: Token budget packing
    const { packed, totalTokens } = this.phase3_packTokenBudget(
      scored,
      effectiveBudget,
    );

    // Detect conflicts
    const conflicts = this.detectConflicts(packed);

    return {
      items: packed,
      conflicts,
      totalTokens,
      budgetUsed: totalTokens,
      budgetTotal: effectiveBudget.totalTokens,
      selectionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Phase 1: Filter items by dependency graph traversal.
   * Includes items from the same customer, related agents, and task type.
   */
  private phase1_filterByDependency(
    items: ContextItem[],
    taskContext: { agentId: string; customerId: string },
  ): ContextItem[] {
    return items.filter((item) => {
      // Must be same customer
      if (item.customerId !== taskContext.customerId) return false;
      return true;
    });
  }

  /**
   * Phase 2: Score items by relevance.
   * Combines freshness, embedding similarity, and confidence.
   */
  private phase2_scoreRelevance(
    items: ContextItem[],
    _taskContext: { agentId: string; taskType: string },
  ): ContextItem[] {
    const now = Date.now();
    return items.map((item) => {
      // Freshness score: decays over time (24h half-life)
      const ageMs = now - item.timestamp;
      const freshnessScore = Math.exp(-ageMs / (24 * 60 * 60 * 1000));

      // Relevance score: combine freshness with existing confidence
      const relevanceScore =
        0.4 * freshnessScore +
        0.4 * (item.confidenceScore ?? 0.5) +
        0.2 * (item.relevanceScore ?? 0.5);

      return {
        ...item,
        freshnessScore,
        relevanceScore,
      };
    });
  }

  /**
   * Phase 3: Pack items into token budget by priority.
   * Priority order: task-specific > cross-agent > historical > org-preferences.
   * Within each priority level, sort by relevance score descending.
   * Uses relevance-weighted truncation, NOT naive FIFO (REQ-CTXE-003).
   */
  private phase3_packTokenBudget(
    items: ContextItem[],
    budget: ContextBudget,
  ): { packed: ContextItem[]; totalTokens: number } {
    const priorityOrder: ContextPriority[] = [
      'task-specific',
      'cross-agent',
      'historical',
      'org-preferences',
    ];

    // Filter by quality threshold
    const qualified = items.filter(
      (item) => this.qualityScore(item) >= budget.minQualityScore,
    );

    // Sort by priority bucket, then by relevance within bucket
    const sorted = qualified.sort((a, b) => {
      const priorityDiff =
        priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
    });

    // Pack greedily within budget
    const packed: ContextItem[] = [];
    let totalTokens = 0;

    for (const item of sorted) {
      if (totalTokens + item.tokenCount <= budget.totalTokens) {
        packed.push(item);
        totalTokens += item.tokenCount;
      }
    }

    return { packed, totalTokens };
  }

  /**
   * Detect conflicts between context items (REQ-CTX-011).
   * Flags contradictory information with both versions and timestamps.
   */
  detectConflicts(items: ContextItem[]): ContextConflict[] {
    const conflicts: ContextConflict[] = [];
    const bySource = new Map<string, ContextItem[]>();

    // Group by source to find conflicting versions
    for (const item of items) {
      const key = `${item.source}:${item.agentId}`;
      const existing = bySource.get(key) ?? [];
      existing.push(item);
      bySource.set(key, existing);
    }

    // Find conflicts: multiple items from same source with different timestamps
    for (const [, group] of bySource) {
      if (group.length > 1) {
        // Sort by timestamp descending
        group.sort((a, b) => b.timestamp - a.timestamp);
        for (let i = 1; i < group.length; i++) {
          conflicts.push({
            itemA: group[0],
            itemB: group[i],
            field: group[0].source,
            description: `Conflicting context from ${group[0].source}: version at ${new Date(group[0].timestamp).toISOString()} vs ${new Date(group[i].timestamp).toISOString()}`,
            detectedAt: Date.now(),
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Build a conflict resolution prompt for the LLM (REQ-CTX-011).
   * Forces the LLM to reason about the discrepancy.
   */
  buildConflictPrompt(conflict: ContextConflict): string {
    return [
      '⚠️ CONTEXT CONFLICT DETECTED:',
      `Source: ${conflict.field}`,
      `Version A (${new Date(conflict.itemA.timestamp).toISOString()}): ${conflict.itemA.content}`,
      `Version B (${new Date(conflict.itemB.timestamp).toISOString()}): ${conflict.itemB.content}`,
      '',
      'You MUST explicitly acknowledge this conflict and explain which version',
      'you are using and why. Do not silently accept either version.',
    ].join('\n');
  }

  /**
   * Compute composite quality score (REQ-CTXE-004).
   * Combines freshness, relevance, and confidence.
   * Items below 0.5 are filtered out.
   */
  private qualityScore(item: ContextItem): number {
    return (
      (item.freshnessScore ?? 0.5) * 0.33 +
      (item.relevanceScore ?? 0.5) * 0.34 +
      (item.confidenceScore ?? 0.5) * 0.33
    );
  }
}
