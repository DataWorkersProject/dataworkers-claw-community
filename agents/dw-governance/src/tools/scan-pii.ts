/**
 * scan_pii — Scan a dataset for PII using a 3-pass detection engine.
 *
 * Pass 1: Column-name heuristic (confidence 0.7).
 * Pass 2: Regex on actual cell VALUES — catches PII in columns like
 *          'notes' whose names give no hint (confidence 0.85-0.95).
 * Pass 3: LLM classification stub for inconclusive columns (confidence 0.99).
 *
 * Critical improvement over the old stub: a column called 'notes' that
 * contains email addresses WILL be detected via Pass 2 value scanning.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { piiScanner, logActivity } from '../backends.js';

export const scanPiiDefinition: ToolDefinition = {
  name: 'scan_pii',
  description:
    'Scan a dataset for PII (Personally Identifiable Information). Uses three-pass detection: (1) column-name heuristic, (2) regex on cell values, (3) LLM stub. >95% precision target.',
  inputSchema: {
    type: 'object',
    properties: {
      datasetId: { type: 'string' },
      customerId: { type: 'string' },
      columns: { type: 'array', items: { type: 'string' }, description: 'Specific columns. Omit for all.' },
      sampleSize: { type: 'number', description: 'Rows to sample. Default: 100.' },
    },
    required: ['datasetId', 'customerId'],
  },
};

export const scanPiiHandler: ToolHandler = async (args) => {
  const datasetId = args.datasetId as string;
  const customerId = args.customerId as string;
  const columns = args.columns as string[] | undefined;
  const sampleSize = (args.sampleSize as number) ?? 100;

  try {
    const result = await piiScanner.scan(customerId, datasetId, columns, sampleSize);

    // If no rows were found, return a clean "no PII found" result (graceful degradation)
    if (result.scannedColumns === 0 && !columns) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              datasetId,
              customerId,
              scannedColumns: 0,
              piiColumnsFound: 0,
              findings: [],
              message: `Dataset '${datasetId}' not found or contains no data — no PII detected`,
            }, null, 2),
          },
        ],
      };
    }

    // Log PII scan to activity log
    await logActivity({
      customerId,
      action: 'pii_scan',
      actor: 'dw-governance',
      resource: datasetId,
      result: `${result.piiColumnsFound} PII columns found in ${result.scannedColumns} scanned`,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
