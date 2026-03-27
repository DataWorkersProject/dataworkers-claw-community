import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

export interface SandboxResult {
  success: boolean;
  output?: string;
  errors?: Array<{ line?: number; message: string }>;
  skipped?: boolean;
  skipReason?: string;
}

export class SandboxRunner {
  private timeout: number;

  constructor(timeoutMs: number = 30000) {
    this.timeout = timeoutMs;
  }

  /**
   * Validate Python code by running AST parsing via python3.
   */
  async validatePythonAST(code: string): Promise<SandboxResult> {
    const tmpFile = join(tmpdir(), `sandbox_${randomBytes(8).toString('hex')}.py`);
    try {
      writeFileSync(tmpFile, code, 'utf-8');
      execSync(
        `python3 -c "import ast; ast.parse(open('${tmpFile}').read())"`,
        { timeout: this.timeout, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      return { success: true, output: 'Python AST validation passed' };
    } catch (err: unknown) {
      const error = err as { status?: number; stderr?: Buffer; code?: string };

      // Python not installed
      if (error.code === 'ENOENT') {
        return {
          success: false,
          skipped: true,
          skipReason: 'Python not installed',
        };
      }

      // Timeout
      if (error.code === 'ETIMEDOUT' || (error as { killed?: boolean }).killed) {
        return {
          success: false,
          errors: [{ message: `Sandbox timed out after ${this.timeout}ms` }],
        };
      }

      // Parse stderr for syntax errors
      const stderr = error.stderr?.toString() ?? '';
      const errors = this.parsePythonErrors(stderr);

      return {
        success: false,
        errors: errors.length > 0 ? errors : [{ message: stderr || 'Unknown Python syntax error' }],
      };
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Validate SQL syntax with basic structural checks.
   */
  async validateSQL(sql: string): Promise<SandboxResult> {
    const errors: Array<{ line?: number; message: string }> = [];
    const trimmed = sql.trim().toUpperCase();

    // Check balanced parentheses
    let depth = 0;
    for (let i = 0; i < sql.length; i++) {
      if (sql[i] === '(') depth++;
      if (sql[i] === ')') depth--;
      if (depth < 0) {
        const line = sql.substring(0, i).split('\n').length;
        errors.push({ line, message: 'Unexpected closing parenthesis' });
        break;
      }
    }
    if (depth > 0) {
      errors.push({ message: `Unbalanced parentheses: ${depth} unclosed '('` });
    }

    // Check for required keywords based on statement type
    if (trimmed.startsWith('SELECT')) {
      if (!trimmed.includes('FROM') && !trimmed.includes('SELECT 1') && !trimmed.match(/^SELECT\s+\d/)) {
        errors.push({ message: 'SELECT statement missing FROM clause' });
      }
    } else if (trimmed.startsWith('INSERT')) {
      if (!trimmed.includes('INTO')) {
        errors.push({ message: 'INSERT statement missing INTO clause' });
      }
    } else if (trimmed.startsWith('MERGE')) {
      if (!trimmed.includes('USING')) {
        errors.push({ message: 'MERGE statement missing USING clause' });
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, output: 'SQL validation passed' };
  }

  /**
   * Validate YAML syntax (basic structure check).
   */
  async validateYAML(yaml: string): Promise<SandboxResult> {
    const errors: Array<{ line?: number; message: string }> = [];

    // Check for tab characters (YAML doesn't allow tabs for indentation)
    const lines = yaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^\t/)) {
        errors.push({ line: i + 1, message: 'YAML does not allow tabs for indentation' });
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, output: 'YAML validation passed' };
  }

  /**
   * Route validation to the appropriate language handler.
   */
  async validate(code: string, language: 'python' | 'sql' | 'yaml'): Promise<SandboxResult> {
    switch (language) {
      case 'python':
        return this.validatePythonAST(code);
      case 'sql':
        return this.validateSQL(code);
      case 'yaml':
        return this.validateYAML(code);
      default:
        return { success: false, skipped: true, skipReason: `Unsupported language: ${language}` };
    }
  }

  /**
   * Parse Python stderr output for SyntaxError details.
   */
  private parsePythonErrors(stderr: string): Array<{ line?: number; message: string }> {
    const errors: Array<{ line?: number; message: string }> = [];

    // Match: SyntaxError: ... (file, line N)
    // Or: File "...", line N\n  ...\nSyntaxError: ...
    const linePattern = /line (\d+)/;
    const syntaxErrorPattern = /SyntaxError:\s*(.+)/;

    const lineMatch = linePattern.exec(stderr);
    const errorMatch = syntaxErrorPattern.exec(stderr);

    if (errorMatch) {
      errors.push({
        line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
        message: `SyntaxError: ${errorMatch[1].trim()}`,
      });
    }

    return errors;
  }
}
