/**
 * Confidence Cascade (REQ-CONFL-006).
 *
 * When agents chain actions, cumulative confidence = upstream * self.
 * If cumulative drops below 0.6, triggers human review.
 * Rate limit: max 10 downstream actions/hour without human confirmation.
 */

export class ConfidenceCascade {
  private actionCounts = new Map<string, { count: number; windowStart: number }>();
  private maxActionsPerHour: number;
  private humanReviewThreshold: number;

  constructor(maxActionsPerHour = 10, humanReviewThreshold = 0.6) {
    this.maxActionsPerHour = maxActionsPerHour;
    this.humanReviewThreshold = humanReviewThreshold;
  }

  /**
   * Calculate cumulative confidence through a chain of agents.
   */
  calculateCumulative(confidences: number[]): number {
    return confidences.reduce((acc, c) => acc * c, 1);
  }

  /**
   * Check if cumulative confidence requires human review.
   */
  needsHumanReview(cumulativeConfidence: number): boolean {
    return cumulativeConfidence < this.humanReviewThreshold;
  }

  /**
   * Check if an agent has exceeded its hourly action rate limit.
   */
  isRateLimited(agentId: string): boolean {
    const entry = this.actionCounts.get(agentId);
    if (!entry) return false;
    if (Date.now() - entry.windowStart > 3_600_000) return false;
    return entry.count >= this.maxActionsPerHour;
  }

  /**
   * Record an action for rate limiting.
   */
  recordAction(agentId: string): void {
    const entry = this.actionCounts.get(agentId);
    if (!entry || Date.now() - entry.windowStart > 3_600_000) {
      this.actionCounts.set(agentId, { count: 1, windowStart: Date.now() });
    } else {
      entry.count++;
    }
  }

  /**
   * Get remaining actions for an agent in the current hour.
   */
  getRemainingActions(agentId: string): number {
    const entry = this.actionCounts.get(agentId);
    if (!entry || Date.now() - entry.windowStart > 3_600_000) return this.maxActionsPerHour;
    return Math.max(0, this.maxActionsPerHour - entry.count);
  }
}
