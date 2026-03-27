/**
 * Orchestration DAG Generator — STRIPPED (OSS).
 *
 * DAG generation requires Data Workers Pro.
 * Visit https://dataworkers.io/pricing
 */

import type { ParsedPipelineIntent } from './nl-parser.js';

const PRO_MESSAGE = '# DAG generation requires Data Workers Pro. Visit https://dataworkers.io/pricing';

export class DAGGenerator {
  constructor(_llmCodeGenerator?: unknown) {}

  generateAirflowDAG(_intent: ParsedPipelineIntent): string {
    return PRO_MESSAGE;
  }

  generateDagsterJob(_intent: ParsedPipelineIntent): string {
    return PRO_MESSAGE;
  }

  generatePrefectFlow(_intent: ParsedPipelineIntent): string {
    return PRO_MESSAGE;
  }

  generate(_intent: ParsedPipelineIntent, _orchestrator: 'airflow' | 'dagster' | 'prefect'): string {
    return PRO_MESSAGE;
  }
}
