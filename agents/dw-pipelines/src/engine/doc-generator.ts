/**
 * Auto-Documentation Generator — STRIPPED (OSS).
 *
 * Documentation generation requires Data Workers Pro.
 * Visit https://dataworkers.io/pricing
 */

import type { ParsedPipelineIntent } from './nl-parser.js';
import type { PipelineSpec } from '../types.js';

const PRO_MESSAGE = 'Documentation generation requires Data Workers Pro. Visit https://dataworkers.io/pricing';

export class DocumentationGenerator {
  generatePipelineDoc(_spec: PipelineSpec, _intent: ParsedPipelineIntent): string {
    return PRO_MESSAGE;
  }

  generateDBTSchema(_modelName: string, _columns: Array<{ name: string; description: string; tests?: string[] }>): string {
    return PRO_MESSAGE;
  }
}
