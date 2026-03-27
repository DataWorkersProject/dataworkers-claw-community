/**
 * Load/performance testing baseline
 *
 * Measures baseline performance of MCP tool calls, concurrency handling,
 * memory usage, and infrastructure adapter throughput using vitest.
 *
 * Run: npx vitest run tests/perf/baseline.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  InMemoryKeyValueStore,
  InMemoryRelationalStore,
} from '../../core/infrastructure-stubs/src/index.js';

// --- Agent tool handlers ---
import { getContextHandler } from '../../agents/dw-context-catalog/src/tools/get-context.js';
import { listTemplatesHandler } from '../../agents/dw-pipelines/src/tools/list-templates.js';
import { getQualityScoreHandler } from '../../agents/dw-quality/src/tools/get-quality-score.js';
import { listAllCatalogsHandler } from '../../agents/dw-connectors/src/tools/catalog-tools.js';

// ─── Helpers ────────────────────────────────────────────────────────

/** Measure execution time in ms for an async function. */
async function measure(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

/** Compute percentiles from a sorted array of numbers. */
function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/** Format a number table row for console output. */
function row(label: string, ...values: (string | number)[]): string {
  const padded = label.padEnd(35);
  const vals = values.map((v) => String(typeof v === 'number' ? v.toFixed(2) : v).padStart(12));
  return `  ${padded}${vals.join('')}`;
}

// ─── 1. Tool Call Throughput ────────────────────────────────────────

describe('Tool call throughput', { timeout: 30_000 }, () => {
  const ITERATIONS = 100;

  const tools: Array<{ name: string; handler: (args: Record<string, unknown>) => Promise<unknown>; args: Record<string, unknown> }> = [
    {
      name: 'get_context (catalog)',
      handler: getContextHandler,
      args: { assetId: 'orders', customerId: 'cust-1' },
    },
    {
      name: 'list_pipeline_templates',
      handler: listTemplatesHandler,
      args: {},
    },
    {
      name: 'get_quality_score',
      handler: getQualityScoreHandler,
      args: { datasetId: 'orders', customerId: 'cust-1' },
    },
    {
      name: 'list_all_catalogs',
      handler: listAllCatalogsHandler,
      args: { customerId: 'cust-1' },
    },
  ];

  it(`each tool completes ${ITERATIONS} calls and reports calls/sec`, async () => {
    const results: Array<{ name: string; totalMs: number; callsPerSec: number }> = [];

    for (const tool of tools) {
      const totalMs = await measure(async () => {
        for (let i = 0; i < ITERATIONS; i++) {
          await tool.handler(tool.args);
        }
      });
      results.push({
        name: tool.name,
        totalMs,
        callsPerSec: (ITERATIONS / totalMs) * 1000,
      });
    }

    // Print results table
    console.log('\n  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │  TOOL CALL THROUGHPUT                                       │');
    console.log('  ├─────────────────────────────────────────────────────────────┤');
    console.log(row('Tool', 'Total (ms)', 'Calls/sec'));
    console.log('  ' + '─'.repeat(59));
    for (const r of results) {
      console.log(row(r.name, r.totalMs, r.callsPerSec));
    }
    console.log('  └─────────────────────────────────────────────────────────────┘\n');

    // Every tool should complete 100 calls under 30s total
    for (const r of results) {
      expect(r.totalMs).toBeLessThan(30_000);
      expect(r.callsPerSec).toBeGreaterThan(0);
    }
  });
});

// ─── 2. Concurrent Tool Calls ──────────────────────────────────────

describe('Concurrent tool calls', { timeout: 30_000 }, () => {
  const CONCURRENCY = 50;

  it(`handles ${CONCURRENCY} concurrent get_context calls`, async () => {
    const latencies: number[] = [];
    let errors = 0;

    const promises = Array.from({ length: CONCURRENCY }, async () => {
      const start = performance.now();
      try {
        await getContextHandler({ assetId: 'orders', customerId: 'cust-1' });
      } catch {
        errors++;
      }
      latencies.push(performance.now() - start);
    });

    const wallStart = performance.now();
    await Promise.all(promises);
    const wallMs = performance.now() - wallStart;

    latencies.sort((a, b) => a - b);
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);

    console.log('\n  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │  CONCURRENT TOOL CALLS (get_context)                        │');
    console.log('  ├─────────────────────────────────────────────────────────────┤');
    console.log(row('Concurrency', CONCURRENCY));
    console.log(row('Wall time (ms)', wallMs));
    console.log(row('Errors', errors));
    console.log(row('p50 latency (ms)', p50));
    console.log(row('p95 latency (ms)', p95));
    console.log(row('p99 latency (ms)', p99));
    console.log('  └─────────────────────────────────────────────────────────────┘\n');

    expect(errors).toBe(0);
    expect(p99).toBeLessThan(5_000); // p99 under 5s
  });

  it(`handles ${CONCURRENCY} concurrent list_pipeline_templates calls`, async () => {
    const latencies: number[] = [];
    let errors = 0;

    const promises = Array.from({ length: CONCURRENCY }, async () => {
      const start = performance.now();
      try {
        await listTemplatesHandler({});
      } catch {
        errors++;
      }
      latencies.push(performance.now() - start);
    });

    const wallStart = performance.now();
    await Promise.all(promises);
    const wallMs = performance.now() - wallStart;

    latencies.sort((a, b) => a - b);
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);

    console.log('\n  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │  CONCURRENT TOOL CALLS (list_pipeline_templates)            │');
    console.log('  ├─────────────────────────────────────────────────────────────┤');
    console.log(row('Concurrency', CONCURRENCY));
    console.log(row('Wall time (ms)', wallMs));
    console.log(row('Errors', errors));
    console.log(row('p50 latency (ms)', p50));
    console.log(row('p95 latency (ms)', p95));
    console.log(row('p99 latency (ms)', p99));
    console.log('  └─────────────────────────────────────────────────────────────┘\n');

    expect(errors).toBe(0);
    expect(p99).toBeLessThan(5_000);
  });
});

// ─── 3. Memory Baseline ────────────────────────────────────────────

describe('Memory baseline', { timeout: 30_000 }, () => {
  const ITERATIONS = 1000;

  it(`heap growth < 50MB after ${ITERATIONS} tool calls`, async () => {
    // Force GC if available, then snapshot baseline
    if (global.gc) global.gc();
    const before = process.memoryUsage();

    for (let i = 0; i < ITERATIONS; i++) {
      await listTemplatesHandler({});
    }

    if (global.gc) global.gc();
    const after = process.memoryUsage();

    const heapGrowthMB = (after.heapUsed - before.heapUsed) / (1024 * 1024);
    const rssGrowthMB = (after.rss - before.rss) / (1024 * 1024);

    console.log('\n  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │  MEMORY BASELINE                                            │');
    console.log('  ├─────────────────────────────────────────────────────────────┤');
    console.log(row('Iterations', ITERATIONS));
    console.log(row('Heap before (MB)', before.heapUsed / (1024 * 1024)));
    console.log(row('Heap after  (MB)', after.heapUsed / (1024 * 1024)));
    console.log(row('Heap growth (MB)', heapGrowthMB));
    console.log(row('RSS growth  (MB)', rssGrowthMB));
    console.log('  └─────────────────────────────────────────────────────────────┘\n');

    // Heap growth should be under 50MB for 1000 lightweight tool calls
    expect(heapGrowthMB).toBeLessThan(50);
  });
});

// ─── 4. Infrastructure Adapter Performance ─────────────────────────

describe('Infrastructure adapter performance', { timeout: 30_000 }, () => {
  it('InMemoryKeyValueStore: 10K set/get throughput', async () => {
    const kv = new InMemoryKeyValueStore();
    const OPS = 10_000;

    // SET throughput
    const setMs = await measure(async () => {
      for (let i = 0; i < OPS; i++) {
        await kv.set(`key:${i}`, `value-${i}`);
      }
    });

    // GET throughput
    const getMs = await measure(async () => {
      for (let i = 0; i < OPS; i++) {
        await kv.get(`key:${i}`);
      }
    });

    // Verify correctness on a sample
    const sample = await kv.get('key:42');
    expect(sample).toBe('value-42');

    const setOpsPerSec = (OPS / setMs) * 1000;
    const getOpsPerSec = (OPS / getMs) * 1000;

    console.log('\n  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │  InMemoryKeyValueStore (10K ops)                            │');
    console.log('  ├─────────────────────────────────────────────────────────────┤');
    console.log(row('SET total (ms)', setMs));
    console.log(row('SET ops/sec', setOpsPerSec));
    console.log(row('GET total (ms)', getMs));
    console.log(row('GET ops/sec', getOpsPerSec));
    console.log('  └─────────────────────────────────────────────────────────────┘\n');

    // In-memory store should easily handle 10K ops/sec
    expect(setOpsPerSec).toBeGreaterThan(10_000);
    expect(getOpsPerSec).toBeGreaterThan(10_000);
  });

  it('InMemoryRelationalStore: 1K insert/query cycles', async () => {
    const db = new InMemoryRelationalStore();
    const OPS = 1_000;
    await db.createTable('perf_test');

    // INSERT throughput
    const insertMs = await measure(async () => {
      for (let i = 0; i < OPS; i++) {
        await db.insert('perf_test', {
          id: i,
          name: `row-${i}`,
          value: Math.random() * 100,
          timestamp: Date.now(),
        });
      }
    });

    // QUERY throughput (filter + order + limit)
    const queryMs = await measure(async () => {
      for (let i = 0; i < OPS; i++) {
        await db.query(
          'perf_test',
          (r) => (r.value as number) > 50,
          { column: 'timestamp', direction: 'desc' },
          10,
        );
      }
    });

    // COUNT throughput
    const countMs = await measure(async () => {
      for (let i = 0; i < OPS; i++) {
        await db.count('perf_test', (r) => (r.id as number) < 500);
      }
    });

    const insertOpsPerSec = (OPS / insertMs) * 1000;
    const queryOpsPerSec = (OPS / queryMs) * 1000;
    const countOpsPerSec = (OPS / countMs) * 1000;

    // Verify correctness
    const totalRows = await db.count('perf_test');
    expect(totalRows).toBe(OPS);

    console.log('\n  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │  InMemoryRelationalStore (1K cycles)                        │');
    console.log('  ├─────────────────────────────────────────────────────────────┤');
    console.log(row('INSERT total (ms)', insertMs));
    console.log(row('INSERT ops/sec', insertOpsPerSec));
    console.log(row('QUERY total (ms)', queryMs));
    console.log(row('QUERY ops/sec', queryOpsPerSec));
    console.log(row('COUNT total (ms)', countMs));
    console.log(row('COUNT ops/sec', countOpsPerSec));
    console.log('  └─────────────────────────────────────────────────────────────┘\n');

    expect(insertOpsPerSec).toBeGreaterThan(1_000);
    expect(queryOpsPerSec).toBeGreaterThan(100); // queries scan all rows, so lower threshold
    expect(countOpsPerSec).toBeGreaterThan(100);
  });
});
