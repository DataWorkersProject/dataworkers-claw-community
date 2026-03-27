/**
 * Token Budget Manager (REQ-CTXE-001, REQ-CTXE-002).
 *
 * Per-agent configurable token budgets:
 * - Sonnet operations: 32K default
 * - Haiku operations: 8K default
 *
 * Priority allocation:
 * 1. Task-specific context
 * 2. Cross-agent dependencies
 * 3. Historical patterns
 * 4. Organizational preferences
 */

export interface TokenBudget {
  agentId: string;
  model: 'sonnet' | 'haiku' | 'opus';
  totalTokens: number;
  allocated: {
    taskSpecific: number;
    crossAgent: number;
    historical: number;
    orgPreferences: number;
  };
  used: number;
  remaining: number;
}

const DEFAULT_BUDGETS: Record<string, number> = {
  sonnet: 32_768,
  haiku: 8_192,
  opus: 65_536,
};

const ALLOCATION_RATIOS = {
  taskSpecific: 0.50,
  crossAgent: 0.25,
  historical: 0.15,
  orgPreferences: 0.10,
};

export class TokenBudgetManager {
  private budgets = new Map<string, TokenBudget>();
  private overrides = new Map<string, number>();

  /**
   * Get or create a budget for an agent + model combination.
   */
  getBudget(agentId: string, model: 'sonnet' | 'haiku' | 'opus' = 'sonnet'): TokenBudget {
    const key = `${agentId}:${model}`;
    if (!this.budgets.has(key)) {
      const total = this.overrides.get(key) ?? DEFAULT_BUDGETS[model];
      this.budgets.set(key, {
        agentId,
        model,
        totalTokens: total,
        allocated: {
          taskSpecific: Math.floor(total * ALLOCATION_RATIOS.taskSpecific),
          crossAgent: Math.floor(total * ALLOCATION_RATIOS.crossAgent),
          historical: Math.floor(total * ALLOCATION_RATIOS.historical),
          orgPreferences: Math.floor(total * ALLOCATION_RATIOS.orgPreferences),
        },
        used: 0,
        remaining: total,
      });
    }
    return this.budgets.get(key)!;
  }

  /**
   * Record token usage.
   */
  recordUsage(agentId: string, model: 'sonnet' | 'haiku' | 'opus', tokens: number): boolean {
    const budget = this.getBudget(agentId, model);
    if (budget.used + tokens > budget.totalTokens) return false;
    budget.used += tokens;
    budget.remaining = budget.totalTokens - budget.used;
    return true;
  }

  /**
   * Set a custom budget override for an agent.
   */
  setOverride(agentId: string, model: 'sonnet' | 'haiku' | 'opus', tokens: number): void {
    this.overrides.set(`${agentId}:${model}`, tokens);
    this.budgets.delete(`${agentId}:${model}`);
  }

  /**
   * Reset usage counters (e.g., per-request).
   */
  resetUsage(agentId: string, model: 'sonnet' | 'haiku' | 'opus'): void {
    const budget = this.budgets.get(`${agentId}:${model}`);
    if (budget) {
      budget.used = 0;
      budget.remaining = budget.totalTokens;
    }
  }
}
