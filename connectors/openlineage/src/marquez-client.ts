/**
 * Real Marquez REST client for consuming lineage data.
 */

import type {
  MarquezConnectionConfig,
  MarquezNamespace,
  MarquezDataset,
  MarquezJob,
  MarquezLineageGraph,
} from './types.js';

export class MarquezRestClient {
  private config: MarquezConnectionConfig;

  constructor(config: MarquezConnectionConfig) {
    if (!config.marquezUrl) {
      throw new Error('Marquez URL is required');
    }
    this.config = config;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.config.marquezUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Marquez API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async listNamespaces(): Promise<MarquezNamespace[]> {
    const result = await this.request<{ namespaces: any[] }>('/api/v1/namespaces');
    return (result.namespaces ?? []).map((ns: any) => ({
      name: ns.name ?? '',
      createdAt: ns.createdAt ? new Date(ns.createdAt).getTime() : 0,
      ownerName: ns.ownerName ?? '',
    }));
  }

  async listDatasets(namespace: string): Promise<MarquezDataset[]> {
    const result = await this.request<{ datasets: any[] }>(`/api/v1/namespaces/${encodeURIComponent(namespace)}/datasets`);
    return (result.datasets ?? []).map((ds: any) => ({
      name: ds.name ?? '',
      namespace: ds.namespace ?? namespace,
      sourceName: ds.sourceName ?? '',
      fields: (ds.fields ?? []).map((f: any) => ({
        name: f.name ?? '',
        type: f.type ?? '',
        description: f.description ?? '',
      })),
      createdAt: ds.createdAt ? new Date(ds.createdAt).getTime() : 0,
    }));
  }

  async listJobs(namespace: string): Promise<MarquezJob[]> {
    const result = await this.request<{ jobs: any[] }>(`/api/v1/namespaces/${encodeURIComponent(namespace)}/jobs`);
    return (result.jobs ?? []).map((j: any) => ({
      name: j.name ?? '',
      namespace: j.namespace ?? namespace,
      type: j.type ?? 'BATCH',
      inputs: (j.inputs ?? []).map((i: any) => `${i.namespace}.${i.name}`),
      outputs: (j.outputs ?? []).map((o: any) => `${o.namespace}.${o.name}`),
      createdAt: j.createdAt ? new Date(j.createdAt).getTime() : 0,
    }));
  }

  async getLineage(nodeId: string, depth = 5): Promise<MarquezLineageGraph> {
    const result = await this.request<{ graph: any[] }>(`/api/v1/lineage?nodeId=${encodeURIComponent(nodeId)}&depth=${depth}`);
    return {
      graph: (result.graph ?? []).map((node: any) => ({
        id: node.id ?? '',
        type: node.type ?? 'DATASET',
        data: node.data ?? {},
        inEdges: (node.inEdges ?? []).map((e: any) => ({ origin: e.origin ?? '' })),
        outEdges: (node.outEdges ?? []).map((e: any) => ({ destination: e.destination ?? '' })),
      })),
    };
  }
}
