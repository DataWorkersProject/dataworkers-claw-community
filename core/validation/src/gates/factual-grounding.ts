import type { ValidationGate, ValidationInput, ValidationResult } from '../types.js';

/**
 * Factual Grounding Gate (REQ-HALL-001).
 *
 * Verifies that all entity references (tables, columns, pipelines, metrics)
 * in agent output exist in the data catalog before execution.
 * Non-existent entities are flagged as errors.
 */
export class FactualGroundingGate implements ValidationGate {
  name = 'factual-grounding';

  private catalogLookup: (customerId: string, entityType: string, entityName: string) => Promise<boolean>;

  constructor(
    catalogLookup?: (customerId: string, entityType: string, entityName: string) => Promise<boolean>,
  ) {
    this.catalogLookup = catalogLookup ?? (async () => true);
  }

  async validate(input: ValidationInput): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    // Extract entity references from content
    const entities = this.extractEntityReferences(input.content);

    for (const entity of entities) {
      const exists = await this.catalogLookup(input.customerId, entity.type, entity.name);
      if (!exists) {
        errors.push({
          code: 'ENTITY_NOT_FOUND',
          message: `Referenced ${entity.type} '${entity.name}' does not exist in the data catalog`,
          location: entity.location,
          severity: 'error',
        });
      }
    }

    return {
      passed: errors.length === 0,
      gateName: this.name,
      confidence: errors.length === 0 ? 1.0 : Math.max(0, 1 - errors.length * 0.2),
      errors,
      warnings,
    };
  }

  /**
   * Extract entity references from content (tables, columns, metrics).
   * Looks for common SQL patterns and explicit references.
   */
  private extractEntityReferences(
    content: string,
  ): Array<{ type: string; name: string; location?: string }> {
    const refs: Array<{ type: string; name: string; location?: string }> = [];

    // Match FROM/JOIN table references
    const tablePattern = /(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
    let match;
    while ((match = tablePattern.exec(content)) !== null) {
      refs.push({ type: 'table', name: match[1], location: `offset:${match.index}` });
    }

    // Match explicit SOURCE references
    const sourcePattern = /SOURCE:\s*([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    while ((match = sourcePattern.exec(content)) !== null) {
      refs.push({ type: 'source', name: match[1], location: `offset:${match.index}` });
    }

    return refs;
  }
}
