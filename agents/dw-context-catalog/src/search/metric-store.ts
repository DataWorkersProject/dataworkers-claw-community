/**
 * MetricStore — manages metrics and semantic definitions with customer scoping,
 * alias matching, fuzzy matching, and domain filtering.
 */

import type { MetricDefinition, SemanticDefinition } from '../types.js';

/**
 * Simple Levenshtein distance implementation for fuzzy matching.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

export interface ResolveResult {
  query: string;
  exactMatch: boolean;
  ambiguous: boolean;
  notFound: boolean;
  matches: MetricDefinition[];
  clarificationNeeded?: string;
  matchType?: 'exact' | 'alias' | 'fuzzy';
}

export class MetricStore {
  private metrics: Map<string, MetricDefinition[]> = new Map(); // key = customerId
  private semanticDefs: Map<string, SemanticDefinition[]> = new Map();

  constructor() {
    this.seed();
  }

  seed(): void {
    // Seed metrics for cust-001
    const cust001Metrics: MetricDefinition[] = [
      // Finance
      { id: 'met-f01', name: 'Revenue', canonicalName: 'total_revenue', description: 'Total revenue from all orders', formula: 'SUM(orders.total_amount)', source: 'dbt_semantic_layer', domain: 'finance', aliases: ['revenue', 'total revenue', 'gross revenue'], owner: 'finance-team' },
      { id: 'met-f02', name: 'Monthly Recurring Revenue', canonicalName: 'mrr', description: 'Monthly recurring revenue from subscriptions', formula: 'SUM(subscriptions.monthly_amount) WHERE status = active', source: 'dbt_semantic_layer', domain: 'finance', aliases: ['mrr', 'monthly recurring revenue'], owner: 'finance-team' },
      { id: 'met-f03', name: 'Annual Recurring Revenue', canonicalName: 'arr', description: 'Annual recurring revenue (MRR x 12)', formula: 'SUM(subscriptions.monthly_amount) * 12 WHERE status = active', source: 'dbt_semantic_layer', domain: 'finance', aliases: ['arr', 'annual recurring revenue'], owner: 'finance-team' },
      { id: 'met-f04', name: 'Net Revenue', canonicalName: 'net_revenue', description: 'Revenue minus refunds and discounts', formula: 'SUM(orders.total_amount) - SUM(refunds.amount) - SUM(discounts.amount)', source: 'dbt_semantic_layer', domain: 'finance', aliases: ['net revenue', 'net sales'], owner: 'finance-team' },
      { id: 'met-f05', name: 'Gross Margin', canonicalName: 'gross_margin', description: 'Revenue minus cost of goods sold as percentage', formula: '(SUM(revenue) - SUM(cogs)) / SUM(revenue) * 100', source: 'dbt_semantic_layer', domain: 'finance', aliases: ['gross margin', 'margin'], owner: 'finance-team' },
      { id: 'met-f06', name: 'Customer Acquisition Cost', canonicalName: 'cac', description: 'Average cost to acquire a customer', formula: 'SUM(marketing_spend) / COUNT(new_customers)', source: 'dbt_semantic_layer', domain: 'finance', aliases: ['cac', 'customer acquisition cost', 'acquisition cost'], owner: 'finance-team' },
      { id: 'met-f07', name: 'Customer Lifetime Value', canonicalName: 'ltv', description: 'Predicted total revenue from a customer', formula: 'AVG(monthly_revenue) * AVG(customer_lifespan_months)', source: 'dbt_semantic_layer', domain: 'finance', aliases: ['ltv', 'clv', 'lifetime value', 'customer lifetime value'], owner: 'finance-team' },
      { id: 'met-f08', name: 'Average Revenue Per User', canonicalName: 'arpu', description: 'Average revenue per active user', formula: 'SUM(revenue) / COUNT(DISTINCT active_users)', source: 'dbt_semantic_layer', domain: 'finance', aliases: ['arpu', 'average revenue per user'], owner: 'finance-team' },
      { id: 'met-f09', name: 'Burn Rate', canonicalName: 'burn_rate', description: 'Monthly cash burn rate', formula: 'SUM(monthly_expenses) - SUM(monthly_revenue)', source: 'dbt_semantic_layer', domain: 'finance', aliases: ['burn rate', 'burn', 'cash burn'], owner: 'finance-team' },
      // Product
      { id: 'met-p01', name: 'Daily Active Users', canonicalName: 'dau', description: 'Count of unique users active per day', formula: 'COUNT(DISTINCT user_id) WHERE event_date = CURRENT_DATE', source: 'dbt_semantic_layer', domain: 'product', aliases: ['dau', 'daily active users', 'active users'], owner: 'product-team' },
      { id: 'met-p02', name: 'Monthly Active Users', canonicalName: 'mau', description: 'Count of unique users active in the last 30 days', formula: 'COUNT(DISTINCT user_id) WHERE event_date >= CURRENT_DATE - 30', source: 'dbt_semantic_layer', domain: 'product', aliases: ['mau', 'monthly active users'], owner: 'product-team' },
      { id: 'met-p03', name: 'Weekly Active Users', canonicalName: 'wau', description: 'Count of unique users active in the last 7 days', formula: 'COUNT(DISTINCT user_id) WHERE event_date >= CURRENT_DATE - 7', source: 'dbt_semantic_layer', domain: 'product', aliases: ['wau', 'weekly active users'], owner: 'product-team' },
      { id: 'met-p04', name: 'Churn Rate', canonicalName: 'churn_rate', description: 'Monthly customer churn rate', formula: 'COUNT(churned_customers) / COUNT(total_customers_start)', source: 'dbt_semantic_layer', domain: 'product', aliases: ['churn', 'churn rate', 'customer churn'], owner: 'product-team' },
      { id: 'met-p05', name: 'Retention Rate', canonicalName: 'retention_rate', description: 'Percentage of customers retained month over month', formula: '1 - churn_rate', source: 'dbt_semantic_layer', domain: 'product', aliases: ['retention', 'retention rate', 'customer retention'], owner: 'product-team' },
      { id: 'met-p06', name: 'Net Promoter Score', canonicalName: 'nps', description: 'Net Promoter Score from customer surveys', formula: 'PCT(promoters) - PCT(detractors)', source: 'custom', domain: 'product', aliases: ['nps', 'net promoter score'], owner: 'product-team' },
      { id: 'met-p07', name: 'Conversion Rate', canonicalName: 'conversion_rate', description: 'Percentage of visitors who convert to customers', formula: 'COUNT(conversions) / COUNT(visitors) * 100', source: 'dbt_semantic_layer', domain: 'product', aliases: ['conversion rate', 'conversion', 'cvr'], owner: 'product-team' },
      // Marketing
      { id: 'met-m01', name: 'Cost Per Lead', canonicalName: 'cpl', description: 'Average cost per marketing lead', formula: 'SUM(marketing_spend) / COUNT(leads)', source: 'dbt_semantic_layer', domain: 'marketing', aliases: ['cpl', 'cost per lead'], owner: 'marketing-team' },
      { id: 'met-m02', name: 'Cost Per Click', canonicalName: 'cpc', description: 'Average cost per ad click', formula: 'SUM(ad_spend) / COUNT(clicks)', source: 'dbt_semantic_layer', domain: 'marketing', aliases: ['cpc', 'cost per click'], owner: 'marketing-team' },
      { id: 'met-m03', name: 'Return on Ad Spend', canonicalName: 'roas', description: 'Revenue generated per dollar of ad spend', formula: 'SUM(attributed_revenue) / SUM(ad_spend)', source: 'dbt_semantic_layer', domain: 'marketing', aliases: ['roas', 'return on ad spend'], owner: 'marketing-team' },
      { id: 'met-m04', name: 'Click-Through Rate', canonicalName: 'click_through_rate', description: 'Percentage of impressions that result in clicks', formula: 'COUNT(clicks) / COUNT(impressions) * 100', source: 'dbt_semantic_layer', domain: 'marketing', aliases: ['ctr', 'click through rate', 'click-through rate'], owner: 'marketing-team' },
      { id: 'met-m05', name: 'Bounce Rate', canonicalName: 'bounce_rate', description: 'Percentage of single-page sessions', formula: 'COUNT(bounced_sessions) / COUNT(total_sessions) * 100', source: 'dbt_semantic_layer', domain: 'marketing', aliases: ['bounce rate', 'bounce'], owner: 'marketing-team' },
      // Engineering
      { id: 'met-e01', name: 'Deploy Frequency', canonicalName: 'deploy_frequency', description: 'Number of production deployments per day', formula: 'COUNT(deployments) / COUNT(DISTINCT deploy_date)', source: 'custom', domain: 'engineering', aliases: ['deploy frequency', 'deployment frequency', 'deploys per day'], owner: 'platform-team' },
      { id: 'met-e02', name: 'Mean Time To Recovery', canonicalName: 'mttr', description: 'Average time to recover from incidents', formula: 'AVG(resolved_at - detected_at)', source: 'custom', domain: 'engineering', aliases: ['mttr', 'mean time to recovery', 'time to recovery'], owner: 'platform-team' },
      { id: 'met-e03', name: 'Change Failure Rate', canonicalName: 'change_failure_rate', description: 'Percentage of deployments causing failures', formula: 'COUNT(failed_deployments) / COUNT(total_deployments) * 100', source: 'custom', domain: 'engineering', aliases: ['change failure rate', 'cfr', 'failure rate'], owner: 'platform-team' },
      { id: 'met-e04', name: 'Lead Time for Changes', canonicalName: 'lead_time', description: 'Time from commit to production deployment', formula: 'AVG(deploy_time - commit_time)', source: 'custom', domain: 'engineering', aliases: ['lead time', 'lead time for changes', 'cycle time'], owner: 'platform-team' },
    ];

    // Seed metrics for cust-002 (subset + different owner)
    const cust002Metrics: MetricDefinition[] = [
      { id: 'met-2f01', name: 'Revenue', canonicalName: 'total_revenue', description: 'Total revenue from all transactions', formula: 'SUM(transactions.amount)', source: 'looker', domain: 'finance', aliases: ['revenue', 'total revenue'], owner: 'data-team' },
      { id: 'met-2f02', name: 'Monthly Recurring Revenue', canonicalName: 'mrr', description: 'Monthly recurring revenue', formula: 'SUM(subscriptions.mrr)', source: 'looker', domain: 'finance', aliases: ['mrr', 'monthly recurring revenue'], owner: 'data-team' },
      { id: 'met-2p01', name: 'Daily Active Users', canonicalName: 'dau', description: 'Unique daily active users', formula: 'COUNT(DISTINCT user_id)', source: 'looker', domain: 'product', aliases: ['dau', 'daily active users'], owner: 'data-team' },
      { id: 'met-2p02', name: 'Churn Rate', canonicalName: 'churn_rate', description: 'Customer churn percentage', formula: 'churned / total_start', source: 'looker', domain: 'product', aliases: ['churn', 'churn rate'], owner: 'data-team' },
    ];

    // Also add metrics for cust-1 (matches graphDB seed customerId)
    this.metrics.set('cust-1', cust001Metrics);
    this.metrics.set('cust-001', cust001Metrics);
    this.metrics.set('cust-002', cust002Metrics);

    // Seed semantic definitions
    const cust001Defs: SemanticDefinition[] = [
      { id: 'sem-f01', name: 'total_revenue', type: 'metric', definition: 'SUM(orders.total_amount)', source: 'dbt', domain: 'finance', metadata: { owner: 'finance-team' } },
      { id: 'sem-f02', name: 'mrr', type: 'metric', definition: 'SUM(subscriptions.monthly_amount) WHERE active', source: 'dbt', domain: 'finance', metadata: { owner: 'finance-team' } },
      { id: 'sem-f03', name: 'arr', type: 'metric', definition: 'mrr * 12', source: 'dbt', domain: 'finance', metadata: { owner: 'finance-team' } },
      { id: 'sem-f04', name: 'net_revenue', type: 'metric', definition: 'total_revenue - refunds - discounts', source: 'dbt', domain: 'finance', metadata: { owner: 'finance-team' } },
      { id: 'sem-f05', name: 'gross_margin', type: 'metric', definition: '(revenue - cogs) / revenue', source: 'dbt', domain: 'finance', metadata: { owner: 'finance-team' } },
      { id: 'sem-f06', name: 'cac', type: 'metric', definition: 'marketing_spend / new_customers', source: 'dbt', domain: 'finance', metadata: { owner: 'finance-team' } },
      { id: 'sem-p01', name: 'dau', type: 'metric', definition: 'COUNT(DISTINCT user_id)', source: 'dbt', domain: 'product', metadata: { owner: 'product-team' } },
      { id: 'sem-p02', name: 'mau', type: 'metric', definition: 'COUNT(DISTINCT user_id) over 30 days', source: 'dbt', domain: 'product', metadata: { owner: 'product-team' } },
      { id: 'sem-p03', name: 'churn_rate', type: 'metric', definition: 'churned / total_start', source: 'dbt', domain: 'product', metadata: { owner: 'product-team' } },
      { id: 'sem-p04', name: 'retention_rate', type: 'metric', definition: '1 - churn_rate', source: 'dbt', domain: 'product', metadata: { owner: 'product-team' } },
      { id: 'sem-p05', name: 'conversion_rate', type: 'metric', definition: 'conversions / visitors', source: 'dbt', domain: 'product', metadata: { owner: 'product-team' } },
      { id: 'sem-p06', name: 'nps', type: 'metric', definition: 'promoters_pct - detractors_pct', source: 'custom', domain: 'product', metadata: { owner: 'product-team' } },
      { id: 'sem-m01', name: 'cpl', type: 'metric', definition: 'marketing_spend / leads', source: 'dbt', domain: 'marketing', metadata: { owner: 'marketing-team' } },
      { id: 'sem-m02', name: 'roas', type: 'metric', definition: 'attributed_revenue / ad_spend', source: 'dbt', domain: 'marketing', metadata: { owner: 'marketing-team' } },
      { id: 'sem-m03', name: 'click_through_rate', type: 'metric', definition: 'clicks / impressions', source: 'dbt', domain: 'marketing', metadata: { owner: 'marketing-team' } },
      // Dimensions
      { id: 'sem-d01', name: 'order_date', type: 'dimension', definition: 'orders.created_at::DATE', source: 'dbt', domain: 'finance', metadata: {} },
      { id: 'sem-d02', name: 'product_category', type: 'dimension', definition: 'products.category', source: 'dbt', domain: 'product', metadata: {} },
      { id: 'sem-d03', name: 'customer_segment', type: 'dimension', definition: 'customers.segment', source: 'dbt', domain: 'finance', metadata: {} },
      { id: 'sem-d04', name: 'region', type: 'dimension', definition: 'customers.region', source: 'dbt', domain: 'finance', metadata: {} },
      { id: 'sem-d05', name: 'channel', type: 'dimension', definition: 'marketing.channel', source: 'dbt', domain: 'marketing', metadata: {} },
      // Entities
      { id: 'sem-e01', name: 'customer', type: 'entity', definition: 'customers table', source: 'dbt', domain: 'core', metadata: {} },
      { id: 'sem-e02', name: 'order', type: 'entity', definition: 'orders table', source: 'dbt', domain: 'core', metadata: {} },
      { id: 'sem-e03', name: 'product', type: 'entity', definition: 'products table', source: 'dbt', domain: 'core', metadata: {} },
      { id: 'sem-e04', name: 'subscription', type: 'entity', definition: 'subscriptions table', source: 'dbt', domain: 'core', metadata: {} },
      // Engineering metrics
      { id: 'sem-eng01', name: 'deploy_frequency', type: 'metric', definition: 'deployments / deploy_days', source: 'custom', domain: 'engineering', metadata: { owner: 'platform-team' } },
      { id: 'sem-eng02', name: 'mttr', type: 'metric', definition: 'AVG(resolved_at - detected_at)', source: 'custom', domain: 'engineering', metadata: { owner: 'platform-team' } },
    ];

    const cust002Defs: SemanticDefinition[] = [
      { id: 'sem-2f01', name: 'total_revenue', type: 'metric', definition: 'SUM(transactions.amount)', source: 'looker', domain: 'finance', metadata: { owner: 'data-team' } },
      { id: 'sem-2f02', name: 'mrr', type: 'metric', definition: 'SUM(subscriptions.mrr)', source: 'looker', domain: 'finance', metadata: { owner: 'data-team' } },
      { id: 'sem-2p01', name: 'dau', type: 'metric', definition: 'COUNT(DISTINCT user_id)', source: 'looker', domain: 'product', metadata: { owner: 'data-team' } },
      { id: 'sem-2d01', name: 'order_date', type: 'dimension', definition: 'orders.date', source: 'looker', domain: 'finance', metadata: {} },
      { id: 'sem-2e01', name: 'customer', type: 'entity', definition: 'customers', source: 'looker', domain: 'core', metadata: {} },
    ];

    this.semanticDefs.set('cust-1', cust001Defs);
    this.semanticDefs.set('cust-001', cust001Defs);
    this.semanticDefs.set('cust-002', cust002Defs);
  }

  /**
   * Resolve an ambiguous metric name to its canonical definition(s).
   * Uses exact match, alias match, and fuzzy matching in that order.
   */
  resolveMetric(query: string, customerId: string, domain?: string): ResolveResult {
    const normalizedQuery = query.toLowerCase().trim();
    const customerMetrics = this.metrics.get(customerId) || [];

    if (customerMetrics.length === 0) {
      return {
        query: normalizedQuery,
        exactMatch: false,
        ambiguous: false,
        notFound: true,
        matches: [],
        matchType: undefined,
      };
    }

    // 1. Exact match on canonicalName
    let matches = customerMetrics.filter(m => m.canonicalName === normalizedQuery);
    if (matches.length > 0) {
      if (domain) matches = matches.filter(m => m.domain === domain);
      return this.buildResult(normalizedQuery, matches, 'exact');
    }

    // 2. Alias match (exact + partial: query contained in alias or alias contained in query)
    //    Sorted so exact matches come first, then partial matches.
    matches = customerMetrics.filter(m =>
      m.aliases.some(a => a.toLowerCase().includes(normalizedQuery) || normalizedQuery.includes(a.toLowerCase())),
    );
    if (matches.length > 0) {
      // Sort: exact alias matches first
      matches.sort((a, b) => {
        const aExact = a.aliases.some(al => al.toLowerCase() === normalizedQuery) ? 0 : 1;
        const bExact = b.aliases.some(al => al.toLowerCase() === normalizedQuery) ? 0 : 1;
        return aExact - bExact;
      });
      if (domain) matches = matches.filter(m => m.domain === domain);
      return this.buildResult(normalizedQuery, matches, 'alias');
    }

    // 4. Fuzzy match (Levenshtein distance < 3) on canonicalName and aliases
    const fuzzyMatches: Array<{ metric: MetricDefinition; distance: number }> = [];
    for (const metric of customerMetrics) {
      const distances: number[] = [levenshtein(normalizedQuery, metric.canonicalName)];
      for (const alias of metric.aliases) {
        distances.push(levenshtein(normalizedQuery, alias.toLowerCase()));
      }
      const minDistance = Math.min(...distances);
      if (minDistance < 3) {
        fuzzyMatches.push({ metric, distance: minDistance });
      }
    }

    if (fuzzyMatches.length > 0) {
      fuzzyMatches.sort((a, b) => a.distance - b.distance);
      matches = fuzzyMatches.map(f => f.metric);
      if (domain) matches = matches.filter(m => m.domain === domain);
      return this.buildResult(normalizedQuery, matches, 'fuzzy');
    }

    // No match found
    return {
      query: normalizedQuery,
      exactMatch: false,
      ambiguous: false,
      notFound: true,
      matches: [],
    };
  }

  /**
   * List semantic definitions with optional filters.
   */
  listDefinitions(
    customerId: string,
    filters?: { domain?: string; type?: string; source?: string; limit?: number; offset?: number },
  ): { total: number; limit: number; offset: number; definitions: SemanticDefinition[] } {
    let defs = this.semanticDefs.get(customerId) || [];

    if (filters?.domain) {
      defs = defs.filter(d => d.domain === filters.domain);
    }
    if (filters?.type) {
      defs = defs.filter(d => d.type === filters.type);
    }
    if (filters?.source) {
      defs = defs.filter(d => d.source === filters.source);
    }

    const total = defs.length;
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    return {
      total,
      limit,
      offset,
      definitions: defs.slice(offset, offset + limit),
    };
  }

  private buildResult(query: string, matches: MetricDefinition[], matchType: 'exact' | 'alias' | 'fuzzy'): ResolveResult {
    return {
      query,
      exactMatch: matches.length === 1,
      ambiguous: matches.length > 1,
      notFound: matches.length === 0,
      matches,
      matchType,
      clarificationNeeded: matches.length > 1
        ? `Multiple definitions found for '${query}'. Please specify: ${matches.map(m => m.canonicalName).join(', ')}`
        : undefined,
    };
  }
}
