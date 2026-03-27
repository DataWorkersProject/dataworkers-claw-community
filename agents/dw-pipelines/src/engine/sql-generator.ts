/**
 * SQL/dbt Code Generator — STRIPPED (OSS).
 *
 * Pipeline code generation requires Data Workers Pro.
 * Visit https://dataworkers.dev/pricing
 */

import type { ParsedPipelineIntent } from './nl-parser.js';

const PRO_MESSAGE = '-- Pipeline code generation requires Data Workers Pro. Visit https://dataworkers.dev/pricing';

export class SQLGenerator {
  generateStagingModel(_source: string, _table?: string, _columns?: string[]): string {
    return PRO_MESSAGE;
  }

  generateIntermediateModel(_name: string, _upstreamRefs: string[], _transforms: unknown[], _deduplicateKey?: string, _orderByColumn?: string): string {
    return PRO_MESSAGE;
  }

  generateMartModel(_name: string, _upstreamRef: string, _incremental?: boolean): string {
    return PRO_MESSAGE;
  }

  generateRawSQL(_intent: ParsedPipelineIntent): string {
    return PRO_MESSAGE;
  }

  generateDBTModels(_intent: ParsedPipelineIntent): Map<string, string> {
    return new Map();
  }
}
