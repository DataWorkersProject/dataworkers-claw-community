import { describe, it, expect, beforeAll } from 'vitest';
import { TrustScorer } from '../search/trust-scorer.js';
import { InMemoryGraphDB } from '@data-workers/infrastructure-stubs';

describe('TrustScorer', () => {
  const graphDB = new InMemoryGraphDB();
  const scorer = new TrustScorer();

  beforeAll(async () => {
    await graphDB.seed();
  });

  it('returns 0 for unknown asset', async () => {
    const score = await scorer.computeTrustScore('nonexistent', 'cust-1', graphDB);
    expect(score.overall).toBe(0);
    expect(score.quality).toBe(0);
    expect(score.freshness).toBe(0);
  });

  it('computes trust score for seeded asset', async () => {
    const nodes = await graphDB.getAllNodes();
    if (nodes.length === 0) return; // Skip if no seed data
    const node = nodes[0];
    const score = await scorer.computeTrustScore(node.id, node.customerId, graphDB);
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it('returns breakdown weights', async () => {
    const nodes = await graphDB.getAllNodes();
    if (nodes.length === 0) return;
    const score = await scorer.computeTrustScore(nodes[0].id, nodes[0].customerId, graphDB);
    expect(score.breakdown).toBeDefined();
    expect(score.breakdown.quality).toBe(0.30);
    expect(score.breakdown.freshness).toBe(0.25);
    expect(score.breakdown.docCoverage).toBe(0.15);
    expect(score.breakdown.usage).toBe(0.15);
    expect(score.breakdown.ownerResponsiveness).toBe(0.15);
  });

  it('quality component is between 0 and 100', async () => {
    const nodes = await graphDB.getAllNodes();
    if (nodes.length === 0) return;
    const score = await scorer.computeTrustScore(nodes[0].id, nodes[0].customerId, graphDB);
    expect(score.quality).toBeGreaterThanOrEqual(0);
    expect(score.quality).toBeLessThanOrEqual(100);
  });

  it('freshness component is between 0 and 100', async () => {
    const nodes = await graphDB.getAllNodes();
    if (nodes.length === 0) return;
    const score = await scorer.computeTrustScore(nodes[0].id, nodes[0].customerId, graphDB);
    expect(score.freshness).toBeGreaterThanOrEqual(0);
    expect(score.freshness).toBeLessThanOrEqual(100);
  });

  it('docCoverage reflects metadata completeness', async () => {
    // Add a well-documented node
    await graphDB.addNode({
      id: 'well-doc-asset',
      type: 'table',
      name: 'well_documented',
      platform: 'snowflake',
      properties: {
        description: 'A well documented table',
        owner: 'data-team',
        tags: ['finance', 'critical'],
        columns: [{ name: 'id', type: 'INT' }],
        schema: 'analytics',
      },
      customerId: 'cust-1',
    });

    const score = await scorer.computeTrustScore('well-doc-asset', 'cust-1', graphDB);
    expect(score.docCoverage).toBeGreaterThan(50);
  });

  it('usage reflects downstream consumers', async () => {
    await graphDB.addNode({ id: 'used-asset', type: 'table', name: 'heavily_used', platform: 'snowflake', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'consumer-1', type: 'model', name: 'model_a', platform: 'dbt', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'consumer-2', type: 'model', name: 'model_b', platform: 'dbt', properties: {}, customerId: 'cust-1' });
    await graphDB.addNode({ id: 'consumer-3', type: 'dashboard', name: 'dash_a', platform: 'looker', properties: {}, customerId: 'cust-1' });
    await graphDB.addEdge({ source: 'used-asset', target: 'consumer-1', relationship: 'consumed_by', properties: {} });
    await graphDB.addEdge({ source: 'used-asset', target: 'consumer-2', relationship: 'consumed_by', properties: {} });
    await graphDB.addEdge({ source: 'used-asset', target: 'consumer-3', relationship: 'consumed_by', properties: {} });

    const score = await scorer.computeTrustScore('used-asset', 'cust-1', graphDB);
    expect(score.usage).toBeGreaterThan(0);
  });

  it('ownerResponsiveness is lower when no owner', async () => {
    await graphDB.addNode({ id: 'no-owner', type: 'table', name: 'orphan_table', platform: 'snowflake', properties: {}, customerId: 'cust-1' });
    const score = await scorer.computeTrustScore('no-owner', 'cust-1', graphDB);
    expect(score.ownerResponsiveness).toBeLessThanOrEqual(30);
  });

  it('overall is capped at 100', async () => {
    const score = await scorer.computeTrustScore('well-doc-asset', 'cust-1', graphDB);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it('looks up by name when ID not found', async () => {
    const score = await scorer.computeTrustScore('well_documented', 'cust-1', graphDB);
    expect(score.overall).toBeGreaterThan(0);
  });

  it('consistent across repeated calls', async () => {
    const score1 = await scorer.computeTrustScore('well-doc-asset', 'cust-1', graphDB);
    const score2 = await scorer.computeTrustScore('well-doc-asset', 'cust-1', graphDB);
    expect(score1.overall).toBe(score2.overall);
  });
});
