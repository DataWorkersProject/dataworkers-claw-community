import { describe, it, expect } from 'vitest';
import { TokenBudgetManager } from '../token-budget.js';

describe('TokenBudgetManager', () => {
  it('exports TokenBudgetManager class', () => {
    expect(TokenBudgetManager).toBeDefined();
  });

  it('creates a budget for an agent', () => {
    const manager = new TokenBudgetManager();
    const budget = manager.getBudget('agent-1', 'sonnet');
    expect(budget.agentId).toBe('agent-1');
    expect(budget.model).toBe('sonnet');
    expect(budget.totalTokens).toBe(32_768);
    expect(budget.remaining).toBe(budget.totalTokens);
  });

  it('assigns correct budget for haiku', () => {
    const manager = new TokenBudgetManager();
    const budget = manager.getBudget('agent-1', 'haiku');
    expect(budget.totalTokens).toBe(8_192);
  });

  it('assigns correct budget for opus', () => {
    const manager = new TokenBudgetManager();
    const budget = manager.getBudget('agent-1', 'opus');
    expect(budget.totalTokens).toBe(65_536);
  });

  it('allocates tokens across priority categories', () => {
    const manager = new TokenBudgetManager();
    const budget = manager.getBudget('agent-1', 'sonnet');
    const total = budget.allocated.taskSpecific + budget.allocated.crossAgent +
      budget.allocated.historical + budget.allocated.orgPreferences;
    // Allow for rounding (sum should be close to total)
    expect(Math.abs(total - budget.totalTokens)).toBeLessThanOrEqual(4);
  });
});
