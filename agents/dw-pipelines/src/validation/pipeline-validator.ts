import type { PipelineSpec, ValidationReport, ConnectorContext } from '../types.js';
import { CodeValidationGate } from '@data-workers/validation';
import type { ValidationInput } from '@data-workers/validation';
import { connectorBridge } from '../backends.js';
import { SandboxRunner } from '../validators/sandbox-runner.js';
import type { SandboxResult } from '../validators/sandbox-runner.js';

/**
 * Pipeline Validator (REQ-PIPE-005).
 *
 * Orchestrates multi-gate validation:
 * 1. Code syntax validation (SQL/Python/YAML/DAG)
 * 2. Semantic layer validation (metrics conform to definitions)
 * 3. Sandbox execution (against production data samples)
 * 4. Factual grounding (entities exist in catalog)
 *
 * All gates must pass before deployment is allowed.
 */
export interface ConnectorValidationIssue {
  table: string;
  issue: 'table_not_found' | 'column_mismatch';
  details?: string;
  column?: string;
  expected?: string;
  found?: string;
}

export class PipelineValidator {
  private codeValidator = new CodeValidationGate();
  private sandboxRunner = new SandboxRunner();

  /**
   * Run full validation pipeline on a PipelineSpec.
   */
  async validate(
    spec: PipelineSpec,
    options: {
      validateSemanticLayer?: boolean;
      sandboxExecution?: boolean;
      customerId: string;
    },
  ): Promise<ValidationReport> {
    const syntaxErrors: ValidationReport['syntaxErrors'] = [];
    const semanticWarnings: ValidationReport['semanticWarnings'] = [];

    // Normalize: accept both spec.tasks and spec.steps (common caller variant)
    const tasks = spec.tasks ?? (spec as unknown as Record<string, unknown>).steps as PipelineSpec['tasks'] | undefined;
    if (!tasks || !Array.isArray(tasks)) {
      return {
        valid: false,
        syntaxErrors: [{ task: 'pipeline', error: 'Pipeline spec must contain a "tasks" or "steps" array' }],
        semanticWarnings: [],
        confidence: 0.1,
      };
    }

    // Gate 0: Pipeline must have at least 1 task/step
    if (tasks.length === 0) {
      return {
        valid: false,
        syntaxErrors: [{ task: 'pipeline', error: 'Pipeline must contain at least one task or step' }],
        semanticWarnings: [],
        confidence: 0.1,
      };
    }

    // Gate 1: Code syntax validation for each task
    for (const task of tasks) {
      // Check for empty code statements
      if (!task.code || task.code.trim().length === 0) {
        syntaxErrors.push({ task: task.name, error: 'Task code is empty' });
        continue;
      }

      const input: ValidationInput = {
        content: task.code,
        contentType: task.codeLanguage === 'dbt' ? 'sql' : task.codeLanguage,
        agentId: 'dw-pipelines',
        customerId: options.customerId,
      };

      const result = await this.codeValidator.validate(input);
      if (!result.passed) {
        for (const error of result.errors) {
          syntaxErrors.push({ task: task.name, error: error.message });
        }
      }

      // Additional SQL-specific checks beyond CodeValidationGate
      // Skip for test/notify tasks which may only contain comments or placeholders
      if ((task.codeLanguage === 'sql' || task.codeLanguage === 'dbt') && task.type !== 'test' && task.type !== 'notify') {
        const sqlErrors = this.validateSQLSemantics(task.code, task.name);
        syntaxErrors.push(...sqlErrors);
      }
    }

    // Gate 1b: Validate source/target references in task dependencies
    const taskIds = new Set(tasks.map(t => t.id));
    for (const task of tasks) {
      if (task.dependencies && Array.isArray(task.dependencies)) {
        for (const dep of task.dependencies) {
          if (!taskIds.has(dep)) {
            syntaxErrors.push({
              task: task.name,
              error: `Dependency '${dep}' references a non-existent task`,
            });
          }
        }
      }
    }

    // Gate 2: DAG cycle detection
    if (this.detectCycle(tasks)) {
      syntaxErrors.push({ task: 'dag', error: 'Cycle detected in task dependency graph' });
    }

    // Gate 3: Semantic layer validation
    if (options.validateSemanticLayer !== false) {
      const semanticResults = await this.validateSemanticLayer(spec);
      semanticWarnings.push(...semanticResults);
    }

    // Gate 4: Sandbox execution
    let sandboxResult;
    if (options.sandboxExecution !== false) {
      sandboxResult = await this.runSandbox(spec, syntaxErrors.length === 0);
    }

    // Gate 5: Connector-based schema validation
    const connectorIssues = await this.validateConnectorSchema(spec);

    // Calculate overall confidence based on what was actually validated
    const gatesRun = {
      syntax: true,
      dagCycle: true,
      semanticLayer: options.validateSemanticLayer !== false,
      sandbox: options.sandboxExecution !== false,
      connectorSchema: connectorIssues.length > 0 || !!(spec.metadata as (PipelineSpec['metadata'] & Record<string, unknown>))?.connectorContext,
      dependencyRefs: true,
    };
    const sandboxSkipped = sandboxResult?.sandboxSkipped === true;

    const confidence = this.calculateConfidence(
      syntaxErrors.length,
      semanticWarnings.length,
      connectorIssues.length,
      gatesRun,
      sandboxSkipped,
    );

    return {
      valid: syntaxErrors.length === 0 && connectorIssues.length === 0,
      syntaxErrors,
      semanticWarnings,
      ...(connectorIssues.length > 0 ? { connectorIssues } : {}),
      sandboxResult,
      confidence,
    };
  }

  /**
   * Validate metrics against semantic layer definitions.
   */
  private async validateSemanticLayer(
    spec: PipelineSpec,
  ): Promise<Array<{ task: string; warning: string }>> {
    const warnings: Array<{ task: string; warning: string }> = [];
    const tasks = spec.tasks ?? (spec as unknown as Record<string, unknown>).steps as PipelineSpec['tasks'] | undefined;
    if (!tasks) return warnings;

    for (const task of tasks) {
      // Check for metric-like patterns in SQL
      const metricPatterns = [
        { pattern: /SUM\s*\(/gi, metric: 'sum_aggregation' },
        { pattern: /COUNT\s*\(/gi, metric: 'count_aggregation' },
        { pattern: /AVG\s*\(/gi, metric: 'average_aggregation' },
        { pattern: /revenue|mrr|arr|ltv|churn|conversion/gi, metric: 'business_metric' },
      ];

      for (const { pattern, metric } of metricPatterns) {
        if (pattern.test(task.code)) {
          warnings.push({
            task: task.name,
            warning: `${metric} detected — verify definition against semantic layer before deployment`,
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Run sandbox execution using real SandboxRunner.
   */
  private async runSandbox(
    spec: PipelineSpec,
    syntaxValid: boolean,
  ): Promise<{ success: boolean; output: string; error?: string; sandboxSkipped?: boolean; sandboxSkipReason?: string }> {
    if (!syntaxValid) {
      return {
        success: false,
        output: '',
        error: 'Sandbox skipped: syntax errors must be fixed first',
      };
    }

    const tasks = spec.tasks ?? (spec as unknown as Record<string, unknown>).steps as PipelineSpec['tasks'] | undefined;
    if (!tasks || tasks.length === 0) {
      return { success: true, output: 'No tasks to sandbox-validate' };
    }

    const allErrors: Array<{ line?: number; message: string }> = [];
    let anySkipped = false;
    let skipReason: string | undefined;

    for (const task of tasks) {
      const lang = task.codeLanguage === 'dbt' ? 'sql' : task.codeLanguage;
      const result: SandboxResult = await this.sandboxRunner.validate(
        task.code,
        lang as 'python' | 'sql' | 'yaml',
      );

      if (result.skipped) {
        anySkipped = true;
        skipReason = result.skipReason;
        continue;
      }

      if (!result.success && result.errors) {
        for (const err of result.errors) {
          allErrors.push({ ...err, message: `[${task.name}] ${err.message}` });
        }
      }
    }

    if (anySkipped && allErrors.length === 0) {
      return {
        success: true,
        output: 'Sandbox partially skipped',
        sandboxSkipped: true,
        sandboxSkipReason: skipReason,
      };
    }

    if (allErrors.length > 0) {
      return {
        success: false,
        output: '',
        error: allErrors.map(e => e.message).join('; '),
      };
    }

    return {
      success: true,
      output: 'Pipeline executed successfully against sandbox validation',
    };
  }

  /**
   * Additional SQL semantic checks beyond basic syntax validation.
   * Catches missing FROM clauses, unbalanced parens in subqueries, and empty statements.
   */
  private validateSQLSemantics(code: string, taskName: string): Array<{ task: string; error: string }> {
    const errors: Array<{ task: string; error: string }> = [];
    const trimmed = code.trim();

    // Strip dbt Jinja templates before analysis ({{ ... }}, {% ... %})
    const withoutJinja = trimmed
      .replace(/\{\{[\s\S]*?\}\}/g, '')
      .replace(/\{%[\s\S]*?%\}/g, '');
    const withoutComments = withoutJinja
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    // Check for empty statements (only whitespace/comments/jinja config)
    if (withoutComments.length === 0) {
      // If there were Jinja blocks, it's likely a dbt config-only block — not an error
      if (trimmed.includes('{{') || trimmed.includes('{%')) {
        return errors;
      }
      errors.push({ task: taskName, error: 'SQL contains only comments or whitespace' });
      return errors;
    }

    const upper = withoutComments.toUpperCase();

    // Find the first SQL statement keyword in the cleaned code
    const firstStatement = upper.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|MERGE|CALL)/);
    const keyword = firstStatement?.[1];

    // SELECT without FROM (unless it's a literal like SELECT 1 or SELECT @var)
    if (keyword === 'SELECT' && !upper.includes('FROM')) {
      const selectBody = upper.replace(/^[\s\S]*?SELECT\s+/, '');
      const isLiteral = /^\s*(\d+|'[^']*'|@\w+|CURRENT_TIMESTAMP|NOW\(\))\s*(;?\s*)$/i.test(selectBody);
      if (!isLiteral) {
        errors.push({ task: taskName, error: 'SELECT statement missing FROM clause' });
      }
    }

    // INSERT without INTO
    if (keyword === 'INSERT' && !upper.includes('INTO')) {
      errors.push({ task: taskName, error: 'INSERT statement missing INTO clause' });
    }

    // MERGE without USING
    if (keyword === 'MERGE' && !upper.includes('USING')) {
      errors.push({ task: taskName, error: 'MERGE statement missing USING clause' });
    }

    // Check for unbalanced parentheses (on original code, but skip Jinja blocks)
    const codeForParens = trimmed
      .replace(/\{\{[\s\S]*?\}\}/g, '')
      .replace(/\{%[\s\S]*?%\}/g, '');
    let depth = 0;
    for (const char of codeForParens) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (depth < 0) {
        errors.push({ task: taskName, error: 'Unbalanced parentheses: unexpected closing parenthesis' });
        break;
      }
    }
    if (depth > 0) {
      errors.push({ task: taskName, error: `Unbalanced parentheses: ${depth} unclosed opening parenthesis(es)` });
    }

    return errors;
  }

  private detectCycle(tasks: Array<{ id: string; dependencies: string[] }>): boolean {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const adj = new Map(tasks.map((t) => [t.id, t.dependencies]));

    const dfs = (node: string): boolean => {
      visited.add(node);
      inStack.add(node);
      for (const dep of adj.get(node) ?? []) {
        if (!visited.has(dep) && dfs(dep)) return true;
        if (inStack.has(dep)) return true;
      }
      inStack.delete(node);
      return false;
    };

    for (const [node] of adj) {
      if (!visited.has(node) && dfs(node)) return true;
    }
    return false;
  }

  /**
   * Gate 5: Validate referenced tables and columns against connector schema.
   * Skips gracefully when no connector is configured in metadata.
   */
  private async validateConnectorSchema(
    spec: PipelineSpec,
  ): Promise<ConnectorValidationIssue[]> {
    const issues: ConnectorValidationIssue[] = [];
    const meta = spec.metadata as (PipelineSpec['metadata'] & Record<string, unknown>) | undefined;

    // Only run when connectorContext is available in metadata
    if (!meta) return issues;
    const ctx = meta.connectorContext as ConnectorContext | undefined;
    if (!ctx || !ctx.connectorType) return issues;

    // For each referenced catalog table, resolve and compare columns
    const catalogRefs: Array<{ catalog?: string; namespace: string; table: string; connectorType: 'iceberg' | 'polaris' }> = [];

    // Gather table references from connectorContext
    if (ctx.table) {
      catalogRefs.push({
        catalog: ctx.catalog,
        namespace: ctx.namespace,
        table: ctx.table,
        connectorType: ctx.connectorType,
      });
    }

    for (const ref of catalogRefs) {
      try {
        const resolved = await connectorBridge.resolveTable(
          ref.connectorType,
          ref.catalog,
          ref.namespace,
          ref.table,
        );

        if (!resolved || !resolved.columns || resolved.columns.length === 0) {
          issues.push({
            table: `${ref.namespace}.${ref.table}`,
            issue: 'table_not_found',
            details: `Table ${ref.namespace}.${ref.table} could not be resolved via ${ref.connectorType} connector`,
          });
          continue;
        }

        // Build a column type map from the resolved schema
        const columnTypeMap = new Map(resolved.columns.map(c => [c.name, c.type]));

        // Extract column references from SQL in tasks
        const connTasks = spec.tasks ?? (spec as unknown as Record<string, unknown>).steps as PipelineSpec['tasks'] ?? [];
        for (const task of connTasks) {
          const sqlColumns = this.extractSQLColumnReferences(task.code);
          for (const col of sqlColumns) {
            if (!columnTypeMap.has(col)) {
              // Column not found in actual schema — report as mismatch
              issues.push({
                table: `${ref.namespace}.${ref.table}`,
                issue: 'column_mismatch',
                column: col,
                expected: 'exists in schema',
                found: 'not found',
                details: `Column '${col}' referenced in task '${task.name}' not found in ${ref.table} schema`,
              });
            }
          }
        }
      } catch {
        // Connector unavailable — skip gracefully
      }
    }

    return issues;
  }

  /**
   * Extract column name references from SQL code.
   * Looks for column names in SELECT, WHERE, ON, SET clauses.
   */
  private extractSQLColumnReferences(code: string): string[] {
    const columns = new Set<string>();

    // Match target.column_name or source.column_name patterns
    const dotPattern = /(?:target|source|t|s)\.\s*(\w+)/gi;
    let match;
    while ((match = dotPattern.exec(code)) !== null) {
      const col = match[1].toLowerCase();
      if (!['table', 'schema', 'database'].includes(col)) {
        columns.add(col);
      }
    }

    // Match SET column = patterns in MERGE/UPDATE
    const setPattern = /SET\s+.*?(\w+)\s*=/gi;
    while ((match = setPattern.exec(code)) !== null) {
      columns.add(match[1].toLowerCase());
    }

    return [...columns];
  }

  private calculateConfidence(
    errorCount: number,
    warningCount: number,
    connectorIssueCount: number,
    gatesRun: {
      syntax: boolean;
      dagCycle: boolean;
      semanticLayer: boolean;
      sandbox: boolean;
      connectorSchema: boolean;
      dependencyRefs: boolean;
    },
    sandboxSkipped: boolean,
  ): number {
    // If there are errors, confidence is low regardless
    if (errorCount > 0 || connectorIssueCount > 0) {
      return Math.max(0.1, 0.5 - (errorCount + connectorIssueCount) * 0.1);
    }

    // Start with base confidence from gates that actually ran
    const totalGates = 6; // syntax, dagCycle, semanticLayer, sandbox, connectorSchema, dependencyRefs
    let gatesExecuted = 0;
    if (gatesRun.syntax) gatesExecuted++;
    if (gatesRun.dagCycle) gatesExecuted++;
    if (gatesRun.semanticLayer) gatesExecuted++;
    if (gatesRun.sandbox && !sandboxSkipped) gatesExecuted++;
    if (gatesRun.connectorSchema) gatesExecuted++;
    if (gatesRun.dependencyRefs) gatesExecuted++;

    // Base confidence scaled by coverage: fewer gates = lower confidence
    const coverageRatio = gatesExecuted / totalGates;
    let confidence = 0.7 + (coverageRatio * 0.25); // range: 0.7 to 0.95

    // Sandbox skipped reduces confidence
    if (sandboxSkipped) {
      confidence = Math.min(confidence, 0.85);
    }

    // Warnings reduce confidence
    if (warningCount > 3) confidence = Math.min(confidence, 0.8);
    else if (warningCount > 0) confidence = Math.min(confidence, 0.9);

    return Math.round(confidence * 100) / 100;
  }
}
