/**
 * InMemoryBusinessRuleStore — 
 * In-memory implementation of IBusinessRuleStore for development and testing.
 */

import type { IBusinessRuleStore, BusinessRuleRecord } from './interfaces/index.js';

export class InMemoryBusinessRuleStore implements IBusinessRuleStore {
  private rules = new Map<string, BusinessRuleRecord>();

  async addRule(rule: BusinessRuleRecord): Promise<void> {
    this.rules.set(rule.id, { ...rule });
  }

  async getRulesForAsset(assetId: string, customerId?: string): Promise<BusinessRuleRecord[]> {
    const results: BusinessRuleRecord[] = [];
    for (const rule of this.rules.values()) {
      if (rule.assetId === assetId && !rule.deprecated) {
        if (!customerId || rule.customerId === customerId) {
          results.push({ ...rule });
        }
      }
    }
    return results;
  }

  async searchRules(query: string, customerId?: string): Promise<BusinessRuleRecord[]> {
    const lowerQuery = query.toLowerCase();
    const results: BusinessRuleRecord[] = [];
    for (const rule of this.rules.values()) {
      if (rule.deprecated) continue;
      if (customerId && rule.customerId !== customerId) continue;
      if (
        rule.content.toLowerCase().includes(lowerQuery) ||
        rule.ruleType.toLowerCase().includes(lowerQuery) ||
        rule.assetId.toLowerCase().includes(lowerQuery)
      ) {
        results.push({ ...rule });
      }
    }
    return results;
  }

  async updateRule(id: string, updates: Partial<BusinessRuleRecord>): Promise<BusinessRuleRecord | null> {
    const existing = this.rules.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id: existing.id };
    this.rules.set(id, updated);
    return { ...updated };
  }

  async deprecateRule(id: string): Promise<boolean> {
    const existing = this.rules.get(id);
    if (!existing) return false;
    existing.deprecated = true;
    return true;
  }

  seed(): void {
    // Seed rules are added via backends.ts
  }
}
