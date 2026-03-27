/**
 * QueryExpander — synonym-based query expansion for improved search recall.
 * Expands user queries with domain-specific synonyms and abbreviations.
 */

export class QueryExpander {
  private synonymGroups: string[][] = [
    // Finance
    ['revenue', 'sales', 'income', 'gmv', 'earnings'],
    ['mrr', 'monthly recurring revenue'],
    ['arr', 'annual recurring revenue'],
    ['ltv', 'lifetime value', 'customer lifetime value', 'clv'],
    ['cac', 'customer acquisition cost'],
    ['arpu', 'average revenue per user'],
    ['margin', 'gross margin', 'profit margin'],
    ['cost', 'expense', 'spend', 'expenditure'],
    ['refund', 'return', 'chargeback'],
    ['invoice', 'billing', 'payment'],
    // Product
    ['dau', 'daily active users', 'active users'],
    ['mau', 'monthly active users'],
    ['wau', 'weekly active users'],
    ['churn', 'attrition', 'customer churn', 'churn rate'],
    ['retention', 'retention rate', 'customer retention'],
    ['conversion', 'conversion rate', 'cvr'],
    ['signup', 'registration', 'onboarding'],
    ['session', 'visit', 'page view', 'pageview'],
    ['engagement', 'interaction', 'activity'],
    ['nps', 'net promoter score'],
    // Engineering / Data
    ['pipeline', 'workflow', 'dag', 'etl', 'elt'],
    ['table', 'dataset', 'relation', 'entity'],
    ['schema', 'structure', 'columns', 'fields'],
    ['freshness', 'staleness', 'age', 'recency'],
    ['lineage', 'provenance', 'dependency', 'data flow'],
    ['quality', 'data quality', 'dq', 'validation'],
    ['dashboard', 'report', 'visualization', 'chart'],
    ['model', 'dbt model', 'transformation'],
    ['source', 'raw data', 'ingestion', 'landing'],
    ['warehouse', 'data warehouse', 'dwh', 'lakehouse'],
    // Marketing
    ['cpl', 'cost per lead'],
    ['cpc', 'cost per click'],
    ['roas', 'return on ad spend'],
    ['ctr', 'click through rate', 'click rate'],
    ['impression', 'view', 'reach'],
    ['campaign', 'ad campaign', 'marketing campaign'],
  ];

  private synonymMap: Map<string, Set<string>> = new Map();

  constructor() {
    this.buildSynonymMap();
  }

  private buildSynonymMap(): void {
    for (const group of this.synonymGroups) {
      const normalizedGroup = group.map(t => t.toLowerCase());
      for (const term of normalizedGroup) {
        if (!this.synonymMap.has(term)) {
          this.synonymMap.set(term, new Set());
        }
        for (const synonym of normalizedGroup) {
          if (synonym !== term) {
            this.synonymMap.get(term)!.add(synonym);
          }
        }
      }
    }
  }

  /**
   * Expand a query by replacing known terms with their synonyms.
   * Returns the original query plus expanded variants.
   */
  expand(query: string): string[] {
    const results = new Set<string>();
    results.add(query);

    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);

    // Single-word synonym expansion
    for (const word of words) {
      const synonyms = this.synonymMap.get(word);
      if (synonyms) {
        for (const syn of synonyms) {
          results.add(lowerQuery.replace(word, syn));
        }
      }
    }

    // Multi-word phrase expansion (check 2-3 word phrases)
    for (const [term, synonyms] of this.synonymMap.entries()) {
      if (term.includes(' ') && lowerQuery.includes(term)) {
        for (const syn of synonyms) {
          results.add(lowerQuery.replace(term, syn));
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Get all synonyms for a given term.
   */
  getSynonyms(term: string): string[] {
    const synonyms = this.synonymMap.get(term.toLowerCase());
    return synonyms ? Array.from(synonyms) : [];
  }
}
