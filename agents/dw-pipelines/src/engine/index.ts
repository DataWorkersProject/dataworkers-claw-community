/**
 * Pipeline Generation Engine.
 *
 * Core engine that converts NL descriptions into production-ready code.
 * Implements REQ-PIPE-001 (NL parsing) and REQ-PIPE-002 (code generation).
 */

export { NLParser } from './nl-parser.js';
export type {
  ParsedPipelineIntent,
  SourceIntent,
  TargetIntent,
  TransformIntent,
  ScheduleIntent,
} from './nl-parser.js';

export { DAGGenerator } from './dag-generator.js';
export { SQLGenerator } from './sql-generator.js';
export { DocumentationGenerator } from './doc-generator.js';
