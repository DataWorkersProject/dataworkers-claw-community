/**
 * Semantic Definition Injector (REQ-CTXE-005).
 *
 * When agents encounter business terms (revenue, churn, active user),
 * automatically injects canonical semantic definitions before LLM response.
 */

export interface SemanticTerm {
  term: string;
  canonicalDefinition: string;
  formula?: string;
  source: string;
  aliases: string[];
}

export class SemanticDefinitionInjector {
  private terms = new Map<string, SemanticTerm>();

  registerTerm(term: SemanticTerm): void {
    this.terms.set(term.term.toLowerCase(), term);
    for (const alias of term.aliases) {
      this.terms.set(alias.toLowerCase(), term);
    }
  }

  /**
   * Scan text for business terms and return definitions to inject.
   */
  findTerms(text: string): SemanticTerm[] {
    const lower = text.toLowerCase();
    const found = new Set<SemanticTerm>();
    for (const [key, term] of this.terms) {
      if (lower.includes(key)) found.add(term);
    }
    return Array.from(found);
  }

  /**
   * Generate context injection string for found terms.
   */
  generateInjection(text: string): string {
    const terms = this.findTerms(text);
    if (terms.length === 0) return '';

    const lines = ['## Canonical Semantic Definitions', ''];
    for (const term of terms) {
      lines.push(`**${term.term}**: ${term.canonicalDefinition}`);
      if (term.formula) lines.push(`  Formula: \`${term.formula}\``);
      lines.push(`  Source: ${term.source}`);
      lines.push('');
    }
    return lines.join('\n');
  }
}
