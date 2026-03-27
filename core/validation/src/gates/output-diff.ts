import type { OutputDiff } from '../types.js';

/**
 * Output Diff Generator (REQ-HALL-007).
 *
 * Before any production-modifying action, generates a before/after
 * state diff that is human-readable and reviewable.
 *
 * Risk levels:
 * - low: metadata changes, documentation updates
 * - medium: schema additions, new pipelines
 * - high: schema modifications, pipeline redeployments
 * - critical: data deletion, schema drops, permission changes
 */
export class OutputDiffGenerator {
  /**
   * Generate a diff between before and after states.
   */
  generateDiff(
    resource: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): OutputDiff {
    const operation = before === null ? 'create' : after === null ? 'delete' : 'modify';

    const changedFields = this.findChangedFields(before, after);
    const riskLevel = this.assessRisk(operation, resource, changedFields);

    return {
      operation,
      resource,
      before: before ? JSON.stringify(before, null, 2) : null,
      after: after ? JSON.stringify(after, null, 2) : null,
      changedFields,
      riskLevel,
    };
  }

  /**
   * Format diff as human-readable string.
   */
  formatDiff(diff: OutputDiff): string {
    const lines: string[] = [
      `─── Output Diff: ${diff.resource} ───`,
      `Operation: ${diff.operation.toUpperCase()}`,
      `Risk Level: ${diff.riskLevel.toUpperCase()}`,
      `Changed Fields: ${diff.changedFields.join(', ') || 'N/A'}`,
      '',
    ];

    if (diff.before) {
      lines.push('--- Before:', diff.before, '');
    }
    if (diff.after) {
      lines.push('+++ After:', diff.after, '');
    }

    return lines.join('\n');
  }

  /**
   * Check if a diff requires human approval based on risk.
   */
  requiresApproval(diff: OutputDiff): boolean {
    return diff.riskLevel === 'high' || diff.riskLevel === 'critical';
  }

  private findChangedFields(
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): string[] {
    if (!before || !after) return [];

    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  private assessRisk(
    operation: string,
    resource: string,
    changedFields: string[],
  ): OutputDiff['riskLevel'] {
    // Critical: deletions, permission changes, schema drops
    if (operation === 'delete') return 'critical';
    if (resource.includes('permission') || resource.includes('access')) return 'critical';
    if (changedFields.some((f) => f.includes('drop') || f.includes('delete'))) return 'critical';

    // High: schema modifications, pipeline redeployments
    if (resource.includes('schema') && operation === 'modify') return 'high';
    if (resource.includes('pipeline') && operation === 'modify') return 'high';

    // Medium: new resources
    if (operation === 'create') return 'medium';

    // Low: metadata, docs
    if (resource.includes('documentation') || resource.includes('metadata')) return 'low';

    return 'medium';
  }
}
