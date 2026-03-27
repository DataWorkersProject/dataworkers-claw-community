/**
 * OpenLineage event producer for emitting lineage events.
 */

import type { OpenLineageRunEvent } from './types.js';

export class OpenLineageEventProducer {
  private url: string;
  private apiKey?: string;

  constructor(url: string, apiKey?: string) {
    if (!url) {
      throw new Error('OpenLineage URL is required');
    }
    this.url = url;
    this.apiKey = apiKey;
  }

  /** Emit a run event to the OpenLineage endpoint. */
  async emitRunEvent(event: OpenLineageRunEvent): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    const response = await fetch(`${this.url}/api/v1/lineage`, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      throw new Error(`OpenLineage event emission failed: ${response.status} ${response.statusText}`);
    }
  }

  /** Emit a dataset event (convenience wrapper). */
  async emitDatasetEvent(event: OpenLineageRunEvent): Promise<void> {
    return this.emitRunEvent(event);
  }
}
