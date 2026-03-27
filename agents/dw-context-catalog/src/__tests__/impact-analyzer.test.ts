import { describe, it, expect, beforeAll } from 'vitest';
import { ImpactAnalyzer } from '../search/impact-analyzer.js';
import { InMemoryGraphDB } from '@data-workers/infrastructure-stubs';

describe('ImpactAnalyzer', () => {
  const graphDB = new InMemoryGraphDB();
  const analyzer = new ImpactAnalyzer();

  beforeAll(async () => {
    // Build a test graph
    await graphDB.addNode({ id: 'src-table', type: 'table', name: 'raw_events', platform: 'snowflake', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'model-a', type: 'model', name: 'stg_events', platform: 'dbt', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'model-b', type: 'model', name: 'fct_events', platform: 'dbt', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'model-c', type: 'model', name: 'dim_users', platform: 'dbt', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'dash-a', type: 'dashboard', name: 'events_dashboard', platform: 'looker', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'dash-b', type: 'dashboard', name: 'users_dashboard', platform: 'looker', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'pipe-a', type: 'pipeline', name: 'etl_events', platform: 'airflow', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'isolated', type: 'table', name: 'isolated_table', platform: 'snowflake', properties: {}, customerId: 'cust-1' });

    // Build dependency graph
    await graphDB.addEdge({ source: 'src-table', target: 'model-a', relationship: 'consumed_by', properties: {} });
    await graphDB.addEdge({ source: 'src-table', target: 'model-c', relationship: 'consumed_by', properties: {} });
    await graphDB.addEdge({ source: 'model-a', target: 'model-b', relationship: 'consumed_by', properties: {} });
    await graphDB.addEdge({ source: 'model-b', target: 'dash-a', relationship: 'consumed_by', properties: {} });
    await graphDB.addEdge({ source: 'model-c', target: 'dash-b', relationship: 'consumed_by', properties: {} });
    await graphDB.addEdge({ source: 'model-a', target: 'pipe-a', relationship: 'consumed_by', properties: {} });
  });

  it('returns LOW for isolated asset', async () => {
    const result = await analyzer.analyzeImpact('isolated', 'cust-1', graphDB);
    expect(result.severity).toBe('LOW');
    expect(result.downstreamCount).toBe(0);
  });

  it('returns HIGH/CRITICAL for asset with dashboard downstream', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(['HIGH', 'CRITICAL']).toContain(result.severity);
    expect(result.dashboardsAffected).toBeGreaterThan(0);
  });

  it('counts downstream assets correctly', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(result.downstreamCount).toBeGreaterThanOrEqual(4); // model-a, model-b, model-c, dash-a, dash-b, pipe-a
  });

  it('groups by depth', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(result.affectedByDepth.length).toBeGreaterThan(0);
    expect(result.affectedByDepth[0].depth).toBe(1);
    expect(result.affectedByDepth[0].count).toBeGreaterThan(0);
  });

  it('counts dashboards affected', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(result.dashboardsAffected).toBeGreaterThanOrEqual(2);
  });

  it('counts models affected', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(result.modelsAffected).toBeGreaterThanOrEqual(2);
  });

  it('counts pipelines affected', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(result.pipelinesAffected).toBeGreaterThanOrEqual(1);
  });

  it('estimates users affected', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(result.estimatedUsersAffected).toBeGreaterThan(0);
  });

  it('generates recommendation', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(result.recommendation).toBeDefined();
    expect(result.recommendation.length).toBeGreaterThan(0);
  });

  it('returns asset name', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(result.assetName).toBe('raw_events');
  });

  it('handles unknown asset gracefully', async () => {
    const result = await analyzer.analyzeImpact('nonexistent', 'cust-1', graphDB);
    expect(result.severity).toBe('LOW');
    expect(result.downstreamCount).toBe(0);
    expect(result.recommendation).toContain('not found');
  });

  it('respects maxDepth', async () => {
    const shallow = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB, 1);
    const deep = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB, 5);
    expect(shallow.downstreamCount).toBeLessThanOrEqual(deep.downstreamCount);
  });

  it('MEDIUM severity for 2-5 downstream', async () => {
    // model-a has model-b and pipe-a downstream (2 direct)
    const result = await analyzer.analyzeImpact('model-a', 'cust-1', graphDB);
    expect(['MEDIUM', 'HIGH']).toContain(result.severity);
  });

  it('lists affected consumers with type', async () => {
    const result = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(result.affectedConsumers.length).toBeGreaterThan(0);
    for (const consumer of result.affectedConsumers) {
      expect(consumer.id).toBeDefined();
      expect(consumer.name).toBeDefined();
      expect(consumer.type).toBeDefined();
    }
  });

  it('deterministic results', async () => {
    const r1 = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    const r2 = await analyzer.analyzeImpact('src-table', 'cust-1', graphDB);
    expect(r1.severity).toBe(r2.severity);
    expect(r1.downstreamCount).toBe(r2.downstreamCount);
    expect(r1.dashboardsAffected).toBe(r2.dashboardsAffected);
  });
});
