import { describe, it, expect } from 'vitest';
import { server } from '../index.js';

describe('dw-context-catalog MCP Server', () => {
  it('registers all 33 tools (19 original + 14 context intelligence)', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(33);
    const names = tools.map((t) => t.name);
    // Unchanged tools
    expect(names).toContain('resolve_metric');
    expect(names).toContain('list_semantic_definitions');
    expect(names).toContain('check_freshness');
    expect(names).toContain('get_context');
    // Old names (deprecated aliases, still registered for backward compat)
    expect(names).toContain('search_datasets');
    expect(names).toContain('get_lineage');
    expect(names).toContain('get_documentation');
    expect(names).toContain('assess_impact');
    // New canonical names
    expect(names).toContain('search_across_platforms');
    expect(names).toContain('trace_cross_platform_lineage');
    expect(names).toContain('generate_documentation');
    expect(names).toContain('blast_radius_analysis');
    // Hero tool
    expect(names).toContain('explain_table');
    // Cross-platform metadata correlation
    expect(names).toContain('correlate_metadata');
    // Dead asset detection
    expect(names).toContain('detect_dead_assets');
    // Lineage write tool with soft-delete
    expect(names).toContain('update_lineage');
    // Documentation gap flagging
    expect(names).toContain('flag_documentation_gap');
    // Auto-tag dataset
    expect(names).toContain('auto_tag_dataset');
    // Schema for SQL generation
    expect(names).toContain('get_table_schema_for_sql');
    // Business rule tools
    expect(names).toContain('define_business_rule');
    expect(names).toContain('query_rules');
    expect(names).toContain('import_tribal_knowledge');
    expect(names).toContain('update_business_rule');
    // Authority designation tools
    expect(names).toContain('mark_authoritative');
    expect(names).toContain('get_authoritative_source');
    expect(names).toContain('revoke_authority');
    // Query history & golden path
    expect(names).toContain('analyze_query_history');
    expect(names).toContain('identify_golden_path');
    // Correction & staleness
    expect(names).toContain('correct_response');
    expect(names).toContain('check_staleness');
    expect(names).toContain('flag_stale_context');
    // Unstructured context
    expect(names).toContain('ingest_unstructured_context');
    // Enterprise data steward
    expect(names).toContain('run_data_steward');
  });

  describe('search_datasets', () => {
    it('finds datasets by keyword', async () => {
      const result = await server.callTool('search_datasets', { query: 'orders', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.totalResults).toBeGreaterThan(0);
      expect(data.results[0].relevanceScore).toBeGreaterThan(0);
    });

    it('finds revenue-related assets', async () => {
      const result = await server.callTool('search_datasets', { query: 'revenue', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.totalResults).toBeGreaterThan(0);
    });

    it('returns matched fields', async () => {
      const result = await server.callTool('search_datasets', { query: 'orders', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.results[0].matchedFields.length).toBeGreaterThan(0);
    });

    it('filters by platform', async () => {
      const result = await server.callTool('search_datasets', { query: 'data', customerId: 'cust-1', platform: 'snowflake' });
      const data = JSON.parse(result.content[0].text!);
      if (data.totalResults > 0) {
        for (const r of data.results) {
          expect(r.asset.platform.toLowerCase()).toBe('snowflake');
        }
      }
    });

    it('filters by tags', async () => {
      const result = await server.callTool('search_datasets', { query: 'orders', customerId: 'cust-1', tags: ['revenue'] });
      const data = JSON.parse(result.content[0].text!);
      if (data.totalResults > 0) {
        for (const r of data.results) {
          expect(r.asset.tags.some((t: string) => t.toLowerCase() === 'revenue')).toBe(true);
        }
      }
    });

    it('returns graceful error on failure', async () => {
      // Search with a very unusual query should still return valid response structure
      const result = await server.callTool('search_datasets', { query: 'zzz_nonexistent_xyz', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      // Should be cold-start or empty results, not a crash
      expect(data).toBeDefined();
    });
  });

  describe('get_lineage', () => {
    it('returns upstream and downstream lineage', async () => {
      const result = await server.callTool('get_lineage', { assetId: 'orders', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.upstream.length).toBeGreaterThan(0);
      expect(data.downstream.length).toBeGreaterThan(0);
    });

    it('includes column lineage by default', async () => {
      const result = await server.callTool('get_lineage', { assetId: 'orders', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.columnLineage).toBeDefined();
      expect(data.columnLineage.length).toBeGreaterThan(0);
    });

    it('returns lineage from graph traversal (not hardcoded)', async () => {
      // Verify that querying different assets gives different lineage
      const ordersResult = await server.callTool('get_lineage', { assetId: 'stg_orders', customerId: 'cust-1' });
      const ordersData = JSON.parse(ordersResult.content[0].text!);

      const eventsResult = await server.callTool('get_lineage', { assetId: 'stg_events', customerId: 'cust-1' });
      const eventsData = JSON.parse(eventsResult.content[0].text!);

      // Different assets should have different upstream sources
      const ordersUpstreamNames = ordersData.upstream.map((n: { name: string }) => n.name);
      const eventsUpstreamNames = eventsData.upstream.map((n: { name: string }) => n.name);

      expect(ordersUpstreamNames).not.toEqual(eventsUpstreamNames);
    });

    it('returns empty lineage for unknown asset instead of error', async () => {
      const result = await server.callTool('get_lineage', { assetId: 'nonexistent_asset_xyz', customerId: 'cust-1' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data.assetId).toBe('nonexistent_asset_xyz');
      expect(data.upstream).toEqual([]);
      expect(data.downstream).toEqual([]);
    });

    it('traverses upstream only when direction is upstream', async () => {
      const result = await server.callTool('get_lineage', { assetId: 'stg_orders', customerId: 'cust-1', direction: 'upstream' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.upstream.length).toBeGreaterThan(0);
      expect(data.downstream.length).toBe(0);
    });

    it('traverses downstream only when direction is downstream', async () => {
      const result = await server.callTool('get_lineage', { assetId: 'stg_orders', customerId: 'cust-1', direction: 'downstream' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.upstream.length).toBe(0);
      expect(data.downstream.length).toBeGreaterThan(0);
    });

    it('prevents cross-tenant lineage access', async () => {
      // Assets belong to cust-1; querying with cust-other should return empty (no leak)
      const result = await server.callTool('get_lineage', { assetId: 'orders', customerId: 'cust-other' });
      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text!);
      expect(data.assetId).toBe('orders');
      expect(data.upstream).toEqual([]);
      expect(data.downstream).toEqual([]);
    });

    it('column lineage comes from graph edges', async () => {
      const result = await server.callTool('get_lineage', { assetId: 'stg_orders', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      if (data.columnLineage && data.columnLineage.length > 0) {
        const col = data.columnLineage[0];
        expect(col.sourceColumn).toBeDefined();
        expect(col.targetColumn).toBeDefined();
        expect(col.sourceTable).toBeDefined();
        expect(col.targetTable).toBeDefined();
      }
    });
  });

  describe('resolve_metric', () => {
    it('resolves exact metric match', async () => {
      const result = await server.callTool('resolve_metric', { metricName: 'mrr', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.exactMatch).toBe(true);
      expect(data.matches[0].canonicalName).toBe('mrr');
    });

    it('detects ambiguous metric', async () => {
      const result = await server.callTool('resolve_metric', { metricName: 'revenue', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.ambiguous).toBe(true);
      expect(data.matches.length).toBeGreaterThan(1);
      expect(data.clarificationNeeded).toBeDefined();
    });

    it('filters by domain', async () => {
      const result = await server.callTool('resolve_metric', { metricName: 'churn', customerId: 'cust-1', domain: 'product' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.matches.every((m: { domain: string }) => m.domain === 'product')).toBe(true);
    });
  });

  describe('list_semantic_definitions', () => {
    it('lists all definitions', async () => {
      const result = await server.callTool('list_semantic_definitions', { customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.total).toBeGreaterThan(0);
    });

    it('filters by type', async () => {
      const result = await server.callTool('list_semantic_definitions', { customerId: 'cust-1', type: 'metric' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.definitions.every((d: { type: string }) => d.type === 'metric')).toBe(true);
    });
  });

  describe('get_documentation', () => {
    it('returns documentation for an asset', async () => {
      const result = await server.callTool('get_documentation', { assetId: 'orders', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.description).toBeTruthy();
      expect(data.columns.length).toBeGreaterThan(0);
      expect(data.qualityScore).toBeGreaterThan(0);
      expect(data.confidence).toBeGreaterThan(0);
    });
  });

  describe('check_freshness', () => {
    it('returns freshness info', async () => {
      const result = await server.callTool('check_freshness', { assetId: 'orders', customerId: 'cust-1' });
      const data = JSON.parse(result.content[0].text!);
      expect(data.freshnessScore).toBeGreaterThanOrEqual(0);
      expect(data.freshnessScore).toBeLessThanOrEqual(100);
      expect(data.lastUpdated).toBeGreaterThan(0);
      expect(typeof data.slaCompliant).toBe('boolean');
    });
  });

  describe('E2E Catalog Workflow', () => {
    it('search -> lineage -> documentation', async () => {
      const searchResult = await server.callTool('search_datasets', { query: 'orders', customerId: 'cust-1' });
      const searchData = JSON.parse(searchResult.content[0].text!);
      expect(searchData.totalResults).toBeGreaterThan(0);

      // Use a graph-seeded asset with known upstream lineage
      const assetId = 'stg-orders';

      const lineageResult = await server.callTool('get_lineage', { assetId, customerId: 'cust-1' });
      const lineageData = JSON.parse(lineageResult.content[0].text!);
      expect(lineageData.upstream.length).toBeGreaterThan(0);

      const docResult = await server.callTool('get_documentation', { assetId: searchData.results[0].asset.id, customerId: 'cust-1' });
      const docData = JSON.parse(docResult.content[0].text!);
      expect(docData.description).toBeTruthy();
    });
  });
});
