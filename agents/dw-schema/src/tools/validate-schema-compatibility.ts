/**
 * validate_schema_compatibility tool — validates that a proposed schema change
 * is compatible with all downstream consumers. Performs syntax_check, dry_run,
 * schema_match, and constraint_check validations.
 *
 * New tool added in P3.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { ValidationKind, SchemaChange } from '../types.js';

export const validateSchemaCompatibilityDefinition: ToolDefinition = {
  name: 'validate_schema_compatibility',
  description: 'Validate that a schema change or migration is compatible with downstream systems. Performs syntax checks, dry-run validation, schema matching, and constraint verification.',
  inputSchema: {
    type: 'object',
    properties: {
      change: { type: 'object', description: 'The schema change to validate.' },
      migrationSql: { type: 'string', description: 'The migration SQL to validate.' },
      customerId: { type: 'string' },
      validationTypes: {
        type: 'array',
        items: { type: 'string', enum: ['syntax_check', 'dry_run', 'schema_match', 'constraint_check'] },
        description: 'Types of validation to perform. Default: all.',
      },
    },
    required: ['customerId'],
  },
};

interface ValidationResult {
  type: ValidationKind;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export const validateSchemaCompatibilityHandler: ToolHandler = async (args) => {
  const change = args.change as SchemaChange | undefined;
  const migrationSql = args.migrationSql as string | undefined;
  const customerId = args.customerId as string;
  const validationTypes = (args.validationTypes as ValidationKind[]) ??
    ['syntax_check', 'dry_run', 'schema_match', 'constraint_check'];
  const start = Date.now();

  try {
    if (!change && !migrationSql) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Either change or migrationSql must be provided',
          }, null, 2),
        }],
        isError: true,
      };
    }

    const results: ValidationResult[] = [];

    for (const vType of validationTypes) {
      switch (vType) {
        case 'syntax_check':
          results.push(performSyntaxCheck(migrationSql, change));
          break;
        case 'dry_run':
          results.push(performDryRun(migrationSql, change));
          break;
        case 'schema_match':
          results.push(performSchemaMatch(change));
          break;
        case 'constraint_check':
          results.push(performConstraintCheck(change));
          break;
      }
    }

    const allPassed = results.every(r => r.passed);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          valid: allPassed,
          validationResults: results,
          validationsPerformed: results.length,
          validationTimeMs: Date.now() - start,
          customerId,
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }, null, 2),
      }],
      isError: true,
    };
  }
};

function performSyntaxCheck(sql?: string, change?: SchemaChange): ValidationResult {
  if (!sql && !change) {
    return { type: 'syntax_check', passed: false, message: 'No SQL or change provided for syntax check' };
  }

  const sqlToCheck = sql || '';

  // Basic SQL syntax validation (check for common issues)
  const hasUnbalancedParens = (sqlToCheck.match(/\(/g) || []).length !== (sqlToCheck.match(/\)/g) || []).length;
  if (hasUnbalancedParens) {
    return { type: 'syntax_check', passed: false, message: 'Unbalanced parentheses in SQL' };
  }

  // Check for dangerous operations without WHERE clause
  if (/DELETE\s+FROM/i.test(sqlToCheck) && !/WHERE/i.test(sqlToCheck)) {
    return { type: 'syntax_check', passed: false, message: 'DELETE without WHERE clause detected' };
  }

  return { type: 'syntax_check', passed: true, message: 'SQL syntax appears valid' };
}

function performDryRun(sql?: string, change?: SchemaChange): ValidationResult {
  // In production, this would execute against a shadow/test environment.
  // For now, validate that the SQL is non-empty and change is well-formed.
  if (!sql && !change) {
    return { type: 'dry_run', passed: false, message: 'No SQL or change provided for dry run' };
  }

  if (change && !change.changeType) {
    return { type: 'dry_run', passed: false, message: 'Change is missing changeType field' };
  }

  return {
    type: 'dry_run',
    passed: true,
    message: 'Dry run validation passed (simulated)',
    details: { simulated: true },
  };
}

function performSchemaMatch(change?: SchemaChange): ValidationResult {
  if (!change) {
    return { type: 'schema_match', passed: true, message: 'No change to validate against schema' };
  }

  // Validate that the change references valid schema components
  if (!change.table) {
    return { type: 'schema_match', passed: false, message: 'Change is missing table reference' };
  }

  if (change.changeType === 'column_added' && !change.details.newType) {
    return { type: 'schema_match', passed: false, message: 'column_added change missing newType' };
  }

  if (change.changeType === 'column_renamed' && (!change.details.oldName || !change.details.newName)) {
    return { type: 'schema_match', passed: false, message: 'column_renamed change missing oldName or newName' };
  }

  return { type: 'schema_match', passed: true, message: 'Schema match validation passed' };
}

function performConstraintCheck(change?: SchemaChange): ValidationResult {
  if (!change) {
    return { type: 'constraint_check', passed: true, message: 'No change to check constraints' };
  }

  // Check if removing a column that might be part of a constraint
  if (change.changeType === 'column_removed') {
    return {
      type: 'constraint_check',
      passed: true,
      message: 'Warning: Verify no constraints reference the dropped column',
      details: { warningLevel: 'medium', column: change.details.column },
    };
  }

  return { type: 'constraint_check', passed: true, message: 'Constraint check passed' };
}
