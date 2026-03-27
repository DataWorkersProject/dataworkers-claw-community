/**
 * generate_documentation — Upgraded documentation tool with cross-platform
 * connector integration and provenance tracking.
 *
 * Pulls from real platform sources via connectors, adds provenance
 * tracking, and supports multiple output formats.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { DocumentationGenerator } from '../search/documentation-generator.js';
import type { CatalogRegistry } from '@data-workers/connector-shared';
import type { DocumentationWithProvenance } from '../types.js';

const docGenerator = new DocumentationGenerator();

/** Singleton reference to the catalog registry, set via configure(). */
let catalogRegistry: CatalogRegistry | undefined;

/**
 * Configure the generate_documentation tool with a CatalogRegistry.
 * Called during agent bootstrap when connectors are available.
 */
export function configureGenerateDocumentation(registry: CatalogRegistry): void {
  catalogRegistry = registry;
}

export const generateDocumentationDefinition: ToolDefinition = {
  name: 'generate_documentation',
  description:
    'Generate comprehensive documentation for a data asset with provenance tracking. ' +
    'Pulls metadata from catalog connectors (Snowflake, dbt, etc.) when available, ' +
    'merges with graph-based pattern matching, and tracks the source of each documentation section.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Asset ID or name.' },
      customerId: { type: 'string', description: 'Customer/tenant ID.' },
      format: {
        type: 'string',
        enum: ['markdown', 'json', 'html'],
        description: 'Output format. Defaults to markdown.',
      },
      includeConnectorSources: {
        type: 'boolean',
        description:
          'When true, query registered catalog connectors for additional metadata (table descriptions, column comments). Defaults to false.',
      },
    },
    required: ['assetId', 'customerId'],
  },
};

export const generateDocumentationHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('generate_documentation')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing', tool: 'generate_documentation' }) }],
      isError: true,
    };
  }

  // Accept standard assetId plus common aliases
  const assetId = (args.assetId ?? args.assetIdentifier ?? args.tableIdentifier ?? args.datasetId) as string;
  const customerId = args.customerId as string;
  const format = (args.format as 'markdown' | 'json' | 'html') ?? 'markdown';
  const includeConnectorSources = (args.includeConnectorSources as boolean) ?? false;

  // Resolve connectors if requested and registry is available
  const connectors =
    includeConnectorSources && catalogRegistry
      ? catalogRegistry.getAllProviders()
      : undefined;

  const doc = await docGenerator.generateWithProvenance(assetId, customerId, connectors);

  const rendered = renderOutput(doc, format);

  return { content: [{ type: 'text', text: rendered }] };
};

/**
 * Render DocumentationWithProvenance into the requested format.
 */
function renderOutput(
  doc: DocumentationWithProvenance,
  format: 'markdown' | 'json' | 'html',
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(doc, null, 2);

    case 'html':
      return renderHtml(doc);

    case 'markdown':
    default:
      return renderMarkdown(doc);
  }
}

function renderMarkdown(doc: DocumentationWithProvenance): string {
  const lines: string[] = [];

  lines.push(`# ${doc.assetName}`);
  lines.push('');
  lines.push(doc.description);
  if (doc.provenance?.description) {
    lines.push(`> Source: ${doc.provenance.description.source} (confidence: ${doc.provenance.description.confidence})`);
  }
  lines.push('');

  if (doc.columns && doc.columns.length > 0) {
    lines.push('## Columns');
    lines.push('');
    lines.push('| Name | Type | Description | Source |');
    lines.push('|------|------|-------------|--------|');
    for (const col of doc.columns) {
      const provenanceCol = doc.provenance?.columns?.find((c) => c.name === col.name);
      const source = provenanceCol?.source ?? 'pattern_match';
      lines.push(`| ${col.name} | ${col.type} | ${col.description} | ${source} |`);
    }
    lines.push('');
  }

  lines.push('## Lineage');
  lines.push('');
  lines.push(doc.lineageSummary);
  lines.push('');

  lines.push('## Usage');
  lines.push('');
  lines.push(`- Queries (30d): ${doc.usageStats.queryCount30d}`);
  lines.push(`- Unique users (30d): ${doc.usageStats.uniqueUsers30d}`);
  lines.push('');

  lines.push('## Quality & Freshness');
  lines.push('');
  lines.push(`- Quality score: ${doc.qualityScore}/100`);
  lines.push(`- Freshness score: ${doc.freshnessInfo.freshnessScore}`);
  lines.push(`- SLA compliant: ${doc.freshnessInfo.slaCompliant ? 'Yes' : 'No'}`);
  lines.push(`- Confidence: ${doc.confidence}`);
  lines.push('');

  if (doc.connectorSources && doc.connectorSources.length > 0) {
    lines.push('## Connector Sources');
    lines.push('');
    for (const src of doc.connectorSources) {
      lines.push(`- ${src}`);
    }
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`Generated at: ${new Date(doc.generatedAt).toISOString()}`);

  return lines.join('\n');
}

function renderHtml(doc: DocumentationWithProvenance): string {
  const lines: string[] = [];

  lines.push('<!DOCTYPE html>');
  lines.push('<html><head><meta charset="utf-8"><title>' + escapeHtml(doc.assetName) + '</title></head><body>');
  lines.push(`<h1>${escapeHtml(doc.assetName)}</h1>`);
  lines.push(`<p>${escapeHtml(doc.description)}</p>`);

  if (doc.provenance?.description) {
    lines.push(`<p><em>Source: ${escapeHtml(doc.provenance.description.source)} (confidence: ${doc.provenance.description.confidence})</em></p>`);
  }

  if (doc.columns && doc.columns.length > 0) {
    lines.push('<h2>Columns</h2>');
    lines.push('<table><thead><tr><th>Name</th><th>Type</th><th>Description</th><th>Source</th></tr></thead><tbody>');
    for (const col of doc.columns) {
      const provenanceCol = doc.provenance?.columns?.find((c) => c.name === col.name);
      const source = provenanceCol?.source ?? 'pattern_match';
      lines.push(`<tr><td>${escapeHtml(col.name)}</td><td>${escapeHtml(col.type)}</td><td>${escapeHtml(col.description)}</td><td>${escapeHtml(source)}</td></tr>`);
    }
    lines.push('</tbody></table>');
  }

  lines.push(`<h2>Lineage</h2><p>${escapeHtml(doc.lineageSummary)}</p>`);
  lines.push(`<h2>Usage</h2><ul><li>Queries (30d): ${doc.usageStats.queryCount30d}</li><li>Unique users (30d): ${doc.usageStats.uniqueUsers30d}</li></ul>`);
  lines.push(`<h2>Quality &amp; Freshness</h2><ul><li>Quality: ${doc.qualityScore}/100</li><li>Freshness: ${doc.freshnessInfo.freshnessScore}</li><li>SLA compliant: ${doc.freshnessInfo.slaCompliant ? 'Yes' : 'No'}</li><li>Confidence: ${doc.confidence}</li></ul>`);

  if (doc.connectorSources && doc.connectorSources.length > 0) {
    lines.push('<h2>Connector Sources</h2><ul>');
    for (const src of doc.connectorSources) {
      lines.push(`<li>${escapeHtml(src)}</li>`);
    }
    lines.push('</ul>');
  }

  lines.push(`<hr><p>Generated at: ${new Date(doc.generatedAt).toISOString()}</p>`);
  lines.push('</body></html>');

  return lines.join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
