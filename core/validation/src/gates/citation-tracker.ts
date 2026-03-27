import type { ValidationGate, ValidationInput, ValidationResult, Citation } from '../types.js';

/**
 * Citation Tracker (REQ-HALL-004).
 *
 * Enforces that agent explanations cite specific data sources
 * with reference identifiers. Target: >95% citation rate.
 *
 * Format: SOURCE: <source_type>.<identifier>
 * Example: SOURCE: quality_monitoring.metric_history, row_id: 4521
 */
export class CitationTracker implements ValidationGate {
  name = 'citation-tracker';

  private minCitationRate: number;

  constructor(minCitationRate = 0.95) {
    this.minCitationRate = minCitationRate;
  }

  async validate(input: ValidationInput): Promise<ValidationResult> {
    const citations = this.extractCitations(input.content);
    const claims = this.countClaims(input.content);

    const citationRate = claims > 0 ? citations.length / claims : 1.0;
    const passed = citationRate >= this.minCitationRate;

    return {
      passed,
      gateName: this.name,
      confidence: citationRate,
      errors: passed ? [] : [{
        code: 'INSUFFICIENT_CITATIONS',
        message: `Citation rate ${(citationRate * 100).toFixed(1)}% is below threshold ${(this.minCitationRate * 100).toFixed(1)}%`,
        severity: 'error',
      }],
      warnings: [],
      metadata: {
        citationCount: citations.length,
        claimCount: claims,
        citationRate,
        citations,
      },
    };
  }

  /**
   * Extract SOURCE citations from content.
   */
  extractCitations(content: string): Citation[] {
    const citations: Citation[] = [];
    const pattern = /SOURCE:\s*([a-zA-Z_]+)\.([a-zA-Z0-9_.]+)(?:,\s*([a-zA-Z_]+):\s*([a-zA-Z0-9_]+))?/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      citations.push({
        sourceType: match[1] as Citation['sourceType'],
        sourceId: match[2],
        sourceLabel: `${match[1]}.${match[2]}${match[3] ? `, ${match[3]}: ${match[4]}` : ''}`,
        confidence: 1.0,
      });
    }

    return citations;
  }

  /**
   * Count factual claims in content (heuristic: sentences with data references).
   */
  private countClaims(content: string): number {
    const sentences = content.split(/[.!?]\s/).filter((s) => s.trim().length > 10);
    // Count sentences that appear to make factual assertions
    return sentences.filter((s) =>
      /\b(is|was|are|were|has|had|shows|indicates|equals|contains)\b/i.test(s),
    ).length;
  }
}
