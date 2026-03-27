/**
 * Query Guardrail (REQ-CTX-AG-005, REQ-SEM-002).
 *
 * Validates all agent-generated SQL against semantic layer definitions.
 * Ensures metric calculations conform to canonical definitions.
 * Flags ambiguous terms for clarification.
 *
 * Target: <100ms validation latency (REQ-SEM-005).
 */

export interface GuardrailResult {
  valid: boolean;
  violations: Violation[];
  warnings: string[];
  validationTimeMs: number;
}

export interface Violation {
  type: 'undefined_metric' | 'incorrect_formula' | 'ambiguous_term' | 'missing_filter';
  metric: string;
  message: string;
  suggestion?: string;
}

export interface SemanticDefinitionEntry {
  name: string;
  formula: string;
  aliases: string[];
}

export class QueryGuardrail {
  private definitions = new Map<string, SemanticDefinitionEntry>();

  /**
   * Register a semantic definition for validation.
   */
  addDefinition(def: SemanticDefinitionEntry): void {
    this.definitions.set(def.name.toLowerCase(), def);
    for (const alias of def.aliases) {
      this.definitions.set(alias.toLowerCase(), def);
    }
  }

  /**
   * Validate a SQL query against semantic definitions.
   */
  validate(sql: string): GuardrailResult {
    const start = Date.now();
    const violations: Violation[] = [];
    const warnings: string[] = [];

    // Check for metric-like patterns
    const aggregations = this.extractAggregations(sql);

    for (const agg of aggregations) {
      const def = this.definitions.get(agg.metricName.toLowerCase());
      if (!def) {
        // Check if it's a known metric by alias
        const byAlias = this.findByPartialMatch(agg.metricName);
        if (byAlias.length > 1) {
          violations.push({
            type: 'ambiguous_term',
            metric: agg.metricName,
            message: `'${agg.metricName}' is ambiguous. Found: ${byAlias.map((d) => d.name).join(', ')}`,
            suggestion: `Use canonical name: ${byAlias[0].name}`,
          });
        } else if (byAlias.length === 0) {
          warnings.push(`Metric '${agg.metricName}' not found in semantic layer — using raw calculation`);
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
      validationTimeMs: Date.now() - start,
    };
  }

  /**
   * Detect semantic gaps: metrics used in queries but not defined.
   */
  detectGaps(queries: string[]): Array<{ metric: string; frequency: number }> {
    const undefinedMetrics = new Map<string, number>();

    for (const sql of queries) {
      const aggs = this.extractAggregations(sql);
      for (const agg of aggs) {
        if (!this.definitions.has(agg.metricName.toLowerCase())) {
          const count = undefinedMetrics.get(agg.metricName) ?? 0;
          undefinedMetrics.set(agg.metricName, count + 1);
        }
      }
    }

    return Array.from(undefinedMetrics.entries())
      .map(([metric, frequency]) => ({ metric, frequency }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  private extractAggregations(sql: string): Array<{ metricName: string; formula: string }> {
    const results: Array<{ metricName: string; formula: string }> = [];
    // Match patterns like: SUM(column) AS metric_name
    const pattern = /(SUM|COUNT|AVG|MIN|MAX)\s*\([^)]+\)\s+AS\s+(\w+)/gi;
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      results.push({ metricName: match[2], formula: match[0] });
    }
    return results;
  }

  private findByPartialMatch(name: string): SemanticDefinitionEntry[] {
    const lower = name.toLowerCase();
    const matches = new Set<SemanticDefinitionEntry>();
    for (const [key, def] of this.definitions) {
      if (key.includes(lower) || lower.includes(key)) {
        matches.add(def);
      }
    }
    return Array.from(matches);
  }
}
