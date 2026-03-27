/**
 * Streaming Integration — STRIPPED (OSS).
 *
 * CDC streaming integration requires Data Workers Pro.
 * Visit https://dataworkers.io/pricing
 */

import type { IMessageBus } from '@data-workers/infrastructure-stubs';

export interface StreamHealthResult {
  healthy: boolean;
  streamId?: string;
  lag?: number;
  throughput?: number;
  consumerGroup?: string;
  error?: string;
  stub?: boolean;
}

export interface CDCTemplateConfig {
  sourceDatabase: string;
  tables: string[];
  kafkaBrokers?: string;
  targetTable: string;
  streamingAgentId?: string;
}

export interface CDCPipelineTask {
  id: string;
  name: string;
  type: 'extract' | 'transform' | 'load';
  description: string;
  code: string;
  codeLanguage: 'python';
  dependencies: string[];
  config: Record<string, unknown>;
}

const PRO_MESSAGE = 'CDC streaming integration requires Data Workers Pro. Visit https://dataworkers.io/pricing';

export class StreamingIntegration {
  setMessageBus(_bus: IMessageBus): void {}

  async checkStreamHealth(_streamId: string, _customerId: string): Promise<StreamHealthResult> {
    return { healthy: false, error: PRO_MESSAGE };
  }

  generateCDCTasks(_config: CDCTemplateConfig, _startIndex?: number): CDCPipelineTask[] {
    return [];
  }
}
