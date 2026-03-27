/**
 * Natural Language Pipeline Description Parser — STRIPPED (OSS).
 *
 * Pipeline generation requires Data Workers Pro.
 * Visit https://dataworkers.io/pricing
 */

import type { QualityCheck } from '../types.js';

export interface CatalogReference {
  catalog: string;
  namespace: string;
  table: string;
  connectorType: 'iceberg' | 'polaris';
}

export interface ParsedPipelineIntent {
  pipelineName: string;
  pattern: 'etl' | 'elt' | 'cdc' | 'reverse-etl' | 'sync' | 'quality';
  sources: SourceIntent[];
  targets: TargetIntent[];
  transformations: TransformIntent[];
  schedule?: ScheduleIntent;
  qualityChecks: (string | QualityCheck)[];
  confidence: number;
  rawDescription: string;
  connectorType?: 'iceberg' | 'polaris';
  catalogReferences?: CatalogReference[];
}

export interface SourceIntent {
  platform: string;
  database?: string;
  schema?: string;
  table?: string;
  connectionId?: string;
  deduplicateKey?: string;
  orderByColumn?: string;
}

export interface TargetIntent {
  platform: string;
  database?: string;
  schema?: string;
  table?: string;
  writeMode: 'append' | 'overwrite' | 'upsert' | 'merge';
  connectionId?: string;
}

export interface TransformIntent {
  type: 'filter' | 'join' | 'aggregate' | 'deduplicate' | 'rename' | 'cast' | 'pivot' | 'union' | 'custom';
  description: string;
  columns?: string[];
  condition?: string;
  joinKey?: string;
  joinRef?: string;
}

export interface ScheduleIntent {
  frequency: 'realtime' | 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  cron?: string;
  timezone?: string;
}

const PRO_MESSAGE = 'Pipeline generation requires Data Workers Pro. Visit https://dataworkers.io/pricing';

export class NLParser {
  parse(_description: string): ParsedPipelineIntent {
    return {
      pipelineName: '',
      pattern: 'etl',
      sources: [],
      targets: [],
      transformations: [],
      qualityChecks: [],
      confidence: 0,
      rawDescription: PRO_MESSAGE,
    };
  }

  detectConnectorType(_text: string): 'iceberg' | 'polaris' | null {
    return null;
  }
}
