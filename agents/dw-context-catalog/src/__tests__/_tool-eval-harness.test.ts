/**
 * Tool evaluation harness — calls every dw-context-catalog MCP tool
 * via server.callTool() with correct parameter names and seeded customer ID.
 * Writes full results to docs/eval-results/_raw-results.json.
 */

import { describe, it, expect } from 'vitest';
import { server } from '../index.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

interface ToolTest {
  name: string;
  args: Record<string, unknown>;
}

// Seed data uses customerId = 'cust-1' and asset IDs like 'tbl-1' (orders), 'tbl-2' (customers), etc.
const tests: ToolTest[] = [
  // 1. search_across_platforms: query + customerId required
  { name: 'search_across_platforms', args: { query: 'customer orders table', customerId: 'cust-1' } },
  // 2. search_datasets (deprecated alias): query + customerId required
  { name: 'search_datasets', args: { query: 'revenue metrics', customerId: 'cust-1' } },
  // 3. explain_table: tableIdentifier required
  { name: 'explain_table', args: { tableIdentifier: 'orders', customerId: 'cust-1' } },
  // 4. get_context: assetId + customerId required
  { name: 'get_context', args: { assetId: 'tbl-1', customerId: 'cust-1' } },
  // 5. trace_cross_platform_lineage: assetId + customerId required
  { name: 'trace_cross_platform_lineage', args: { assetId: 'tbl-1', customerId: 'cust-1', direction: 'both' } },
  // 6. get_lineage (deprecated alias): assetId + customerId required
  { name: 'get_lineage', args: { assetId: 'tbl-1', customerId: 'cust-1', direction: 'upstream' } },
  // 7. blast_radius_analysis: customerId required, assetId + columnName optional
  { name: 'blast_radius_analysis', args: { assetId: 'tbl-1', customerId: 'cust-1', columnName: 'customer_id', changeType: 'column_drop' } },
  // 8. assess_impact (deprecated alias): assetId + customerId required
  { name: 'assess_impact', args: { assetId: 'tbl-1', customerId: 'cust-1' } },
  // 9. generate_documentation: assetId + customerId required
  { name: 'generate_documentation', args: { assetId: 'tbl-1', customerId: 'cust-1' } },
  // 10. get_documentation (deprecated alias): assetId + customerId required
  { name: 'get_documentation', args: { assetId: 'tbl-1', customerId: 'cust-1' } },
  // 11. check_freshness: assetId + customerId required
  { name: 'check_freshness', args: { assetId: 'tbl-1', customerId: 'cust-1' } },
  // 12. correlate_metadata: assetIdentifier required
  { name: 'correlate_metadata', args: { assetIdentifier: 'orders', customerId: 'cust-1' } },
  // 13. detect_dead_assets: no required params
  { name: 'detect_dead_assets', args: { customerId: 'cust-1' } },
  // 14. resolve_metric: metricName + customerId required
  { name: 'resolve_metric', args: { metricName: 'revenue', customerId: 'cust-1' } },
  // 15. list_semantic_definitions: customerId required
  { name: 'list_semantic_definitions', args: { customerId: 'cust-1' } },
  // 16. update_lineage: sourceDatasetId + targetDatasetId required
  { name: 'update_lineage', args: { sourceDatasetId: 'src-raw-orders', targetDatasetId: 'tbl-1', customerId: 'cust-1', relationship: 'transforms' } },
  // 17. auto_tag_dataset: datasetId required
  { name: 'auto_tag_dataset', args: { datasetId: 'tbl-1', customerId: 'cust-1', dryRun: true } },
  // 18. flag_documentation_gap: no required params
  { name: 'flag_documentation_gap', args: { customerId: 'cust-1', dryRun: true } },
];

interface EvalResult {
  tool: string;
  args: Record<string, unknown>;
  response: unknown;
  isError: boolean;
  elapsed: number;
}

const allResults: EvalResult[] = [];

describe('Tool Evaluation Harness', () => {
  for (const test of tests) {
    it(`calls ${test.name}`, async () => {
      const start = performance.now();
      const result = await server.callTool(test.name, test.args);
      const elapsed = Math.round(performance.now() - start);

      let parsedContent: unknown = result.content;
      if (Array.isArray(result.content) && result.content[0]?.type === 'text') {
        const textBlock = result.content[0] as { text: string };
        try {
          parsedContent = JSON.parse(textBlock.text);
        } catch {
          parsedContent = textBlock.text;
        }
      }

      allResults.push({
        tool: test.name,
        args: test.args,
        response: parsedContent,
        isError: !!result.isError,
        elapsed,
      });

      // Basic assertion: it should return content
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });
  }

  it('writes results to JSON', () => {
    const outDir = path.resolve(__dirname, '../../../../docs/eval-results');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      path.join(outDir, '_raw-results.json'),
      JSON.stringify(allResults, null, 2),
    );
    expect(allResults.length).toBe(tests.length);
  });
});
