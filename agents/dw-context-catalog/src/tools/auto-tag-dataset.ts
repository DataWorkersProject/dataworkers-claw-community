/**
 * auto_tag_dataset MCP tool — enterprise write tool with rollback.
 *
 * Auto-classifies datasets with PII/sensitivity/domain tags by correlating
 * schema patterns across platforms. Supports dry-run mode (default),
 * tag application, and rollback to previous tag versions.
 *
 * Requires catalog_write toolset (enterprise tier).
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { InvalidParameterError, ServerToolCallError } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import { graphDB } from '../backends.js';
import type { IGraphDB, GraphNode } from '@data-workers/infrastructure-stubs';

// ── Types ──

type TagCategory = 'pii' | 'sensitivity' | 'domain' | 'freshness' | 'quality_tier' | 'usage';
type TagSource = 'content_analysis' | 'schema_inference' | 'usage_pattern';

interface TagProposal {
  category: TagCategory;
  tag: string;
  confidence: number;
  source: TagSource;
  previousTag?: string;
}

interface TagHistoryEntry {
  taggingId: string;
  datasetId: string;
  timestamp: number;
  tags: TagProposal[];
  previousTags: string[];
}

interface AutoTagResult {
  taggingId: string;
  datasetId: string;
  tagsApplied: TagProposal[];
  dryRun: boolean;
  auditTrailId: string;
}

// ── PII Pattern Registry ──

const PII_COLUMN_PATTERNS: Array<{ pattern: RegExp; tag: string; category: TagCategory; confidence: number }> = [
  { pattern: /e[-_]?mail/i, tag: 'pii:email', category: 'pii', confidence: 0.95 },
  { pattern: /\bssn\b|social[-_]?security/i, tag: 'pii:ssn', category: 'pii', confidence: 0.98 },
  { pattern: /phone|mobile|cell[-_]?number|telephone/i, tag: 'pii:phone', category: 'pii', confidence: 0.90 },
  { pattern: /address|street|zip[-_]?code|postal/i, tag: 'pii:address', category: 'pii', confidence: 0.85 },
  { pattern: /credit[-_]?card|card[-_]?number|cc[-_]?num/i, tag: 'pii:credit_card', category: 'pii', confidence: 0.97 },
  { pattern: /passport[-_]?(num|number|id)?/i, tag: 'pii:passport', category: 'pii', confidence: 0.95 },
  { pattern: /\bdob\b|date[-_]?of[-_]?birth|birth[-_]?date/i, tag: 'pii:dob', category: 'pii', confidence: 0.92 },
  { pattern: /salary|compensation|wage|pay[-_]?rate/i, tag: 'pii:salary', category: 'pii', confidence: 0.88 },
  { pattern: /password|passwd|pwd|secret/i, tag: 'pii:password', category: 'pii', confidence: 0.99 },
  { pattern: /first[-_]?name|last[-_]?name|full[-_]?name/i, tag: 'pii:name', category: 'pii', confidence: 0.80 },
  { pattern: /ip[-_]?addr|ip[-_]?address/i, tag: 'pii:ip_address', category: 'pii', confidence: 0.85 },
  // Additional PII patterns for common identifier columns
  { pattern: /\bcustomer[-_]?id\b/i, tag: 'pii:customer_id', category: 'pii', confidence: 0.85 },
  { pattern: /\buser[-_]?id\b/i, tag: 'pii:user_id', category: 'pii', confidence: 0.85 },
  { pattern: /\baccount[-_]?(number|num|no)\b/i, tag: 'pii:account_number', category: 'pii', confidence: 0.90 },
];

// ── Domain Classification Patterns ──

const DOMAIN_PATTERNS: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /order|invoice|payment|transaction|checkout/i, tag: 'domain:commerce' },
  { pattern: /customer|user|account|member|subscriber/i, tag: 'domain:customer' },
  { pattern: /product|item|sku|catalog|inventory/i, tag: 'domain:product' },
  { pattern: /revenue|profit|cost|budget|expense|financial/i, tag: 'domain:finance' },
  { pattern: /event|click|page[-_]?view|session|impression/i, tag: 'domain:analytics' },
  { pattern: /employee|hr|department|hiring|salary/i, tag: 'domain:hr' },
  { pattern: /log|audit|trace|monitor/i, tag: 'domain:operations' },
  { pattern: /campaign|marketing|lead|conversion|funnel/i, tag: 'domain:marketing' },
];

// ── Sensitivity Classification ──

const SENSITIVITY_LEVELS = {
  HIGH: 'sensitivity:high',
  MEDIUM: 'sensitivity:medium',
  LOW: 'sensitivity:low',
  PUBLIC: 'sensitivity:public',
} as const;

// ── Tag History Store (module-level Map for rollback) ──

const tagHistory = new Map<string, TagHistoryEntry[]>();

// ── Helpers ──

let tagCounter = 0;

function generateTaggingId(): string {
  tagCounter++;
  return `tag-${Date.now()}-${tagCounter}`;
}

function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function analyzeColumnsForPII(columns: Array<{ name: string; type?: string }>): TagProposal[] {
  const proposals: TagProposal[] = [];
  const seen = new Set<string>();

  for (const col of columns) {
    for (const piiPattern of PII_COLUMN_PATTERNS) {
      if (piiPattern.pattern.test(col.name) && !seen.has(piiPattern.tag)) {
        seen.add(piiPattern.tag);
        proposals.push({
          category: piiPattern.category,
          tag: piiPattern.tag,
          confidence: piiPattern.confidence,
          source: 'schema_inference',
        });
      }
    }
  }

  return proposals;
}

function classifyDomain(name: string, columns: Array<{ name: string }>): TagProposal[] {
  const proposals: TagProposal[] = [];
  const seen = new Set<string>();
  const allText = [name, ...columns.map(c => c.name)].join(' ');

  for (const dp of DOMAIN_PATTERNS) {
    if (dp.pattern.test(allText) && !seen.has(dp.tag)) {
      seen.add(dp.tag);
      proposals.push({
        category: 'domain',
        tag: dp.tag,
        confidence: 0.75,
        source: 'content_analysis',
      });
    }
  }

  return proposals;
}

/** Patterns for financial/transactional table names that warrant elevated sensitivity. */
const FINANCIAL_TABLE_PATTERNS = /order|payment|invoice|transaction|billing|receipt|refund|charge|subscription/i;

function classifySensitivity(piiTags: TagProposal[], tableName?: string): TagProposal {
  const highSensitivityTags = ['pii:ssn', 'pii:credit_card', 'pii:passport', 'pii:password', 'pii:account_number'];
  const mediumSensitivityTags = ['pii:email', 'pii:phone', 'pii:dob', 'pii:salary', 'pii:address', 'pii:customer_id', 'pii:user_id'];

  const hasHigh = piiTags.some(t => highSensitivityTags.includes(t.tag));
  const hasMedium = piiTags.some(t => mediumSensitivityTags.includes(t.tag));

  // Escalate sensitivity for financial/transactional tables
  const isFinancialTable = tableName ? FINANCIAL_TABLE_PATTERNS.test(tableName) : false;

  if (hasHigh) {
    return { category: 'sensitivity', tag: SENSITIVITY_LEVELS.HIGH, confidence: 0.95, source: 'schema_inference' };
  }
  if (isFinancialTable) {
    // Financial tables get at least MEDIUM, or HIGH if they have PII
    if (hasMedium || piiTags.length > 0) {
      return { category: 'sensitivity', tag: SENSITIVITY_LEVELS.HIGH, confidence: 0.90, source: 'schema_inference' };
    }
    return { category: 'sensitivity', tag: SENSITIVITY_LEVELS.MEDIUM, confidence: 0.85, source: 'content_analysis' };
  }
  if (hasMedium) {
    return { category: 'sensitivity', tag: SENSITIVITY_LEVELS.MEDIUM, confidence: 0.85, source: 'schema_inference' };
  }
  if (piiTags.length > 0) {
    return { category: 'sensitivity', tag: SENSITIVITY_LEVELS.MEDIUM, confidence: 0.70, source: 'schema_inference' };
  }
  return { category: 'sensitivity', tag: SENSITIVITY_LEVELS.LOW, confidence: 0.60, source: 'content_analysis' };
}

function classifyFreshness(node: GraphNode): TagProposal {
  const lastUpdated = node.properties.lastUpdated as number | undefined;
  if (!lastUpdated) {
    // Always return a freshness tag even when no timestamp is available
    return { category: 'freshness', tag: 'freshness:unknown', confidence: 0.50, source: 'usage_pattern' };
  }

  const ageHours = (Date.now() - lastUpdated) / (1000 * 60 * 60);

  if (ageHours < 1) {
    return { category: 'freshness', tag: 'freshness:real_time', confidence: 0.90, source: 'usage_pattern' };
  }
  if (ageHours < 24) {
    return { category: 'freshness', tag: 'freshness:daily', confidence: 0.85, source: 'usage_pattern' };
  }
  if (ageHours < 168) {
    return { category: 'freshness', tag: 'freshness:weekly', confidence: 0.80, source: 'usage_pattern' };
  }
  return { category: 'freshness', tag: 'freshness:stale', confidence: 0.75, source: 'usage_pattern' };
}

function classifyQualityTier(node: GraphNode): TagProposal {
  const qualityScore = (node.properties.qualityScore as number) ?? 0;

  if (qualityScore >= 0.9) {
    return { category: 'quality_tier', tag: 'quality:gold', confidence: 0.90, source: 'usage_pattern' };
  }
  if (qualityScore >= 0.7) {
    return { category: 'quality_tier', tag: 'quality:silver', confidence: 0.85, source: 'usage_pattern' };
  }
  if (qualityScore >= 0.4) {
    return { category: 'quality_tier', tag: 'quality:bronze', confidence: 0.80, source: 'usage_pattern' };
  }
  return { category: 'quality_tier', tag: 'quality:unclassified', confidence: 0.60, source: 'usage_pattern' };
}

/** Classify usage tier based on query count / downstream consumers. */
function classifyUsage(node: GraphNode): TagProposal {
  const queryCount = (node.properties.queryCount as number) ?? 0;
  const downstreamCount = (node.properties.downstreamCount as number) ?? 0;
  const total = queryCount + downstreamCount;

  if (total >= 100) {
    return { category: 'usage', tag: 'usage:high', confidence: 0.85, source: 'usage_pattern' };
  }
  if (total >= 10) {
    return { category: 'usage', tag: 'usage:medium', confidence: 0.80, source: 'usage_pattern' };
  }
  if (total > 0) {
    return { category: 'usage', tag: 'usage:low', confidence: 0.75, source: 'usage_pattern' };
  }
  return { category: 'usage', tag: 'usage:unknown', confidence: 0.50, source: 'usage_pattern' };
}

function getHistoryForDataset(datasetId: string): TagHistoryEntry[] {
  return tagHistory.get(datasetId) ?? [];
}

function storeHistory(entry: TagHistoryEntry): void {
  const existing = tagHistory.get(entry.datasetId) ?? [];
  existing.push(entry);
  tagHistory.set(entry.datasetId, existing);
}

// ── Tool Definition ──

export const autoTagDatasetDefinition: ToolDefinition = {
  name: 'auto_tag_dataset',
  description:
    'Auto-classify a dataset with PII, sensitivity, domain, freshness, and quality tier tags ' +
    'by correlating schema patterns across platforms. Supports dry-run mode (default true) to ' +
    'preview proposed tags before applying, and rollback to a previous tagging version. ' +
    'Requires catalog_write toolset (enterprise tier).',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: {
        type: 'string',
        description: 'ID of the dataset/asset to auto-tag. Preferred parameter name.',
      },
      datasetId: {
        type: 'string',
        description: '[Deprecated alias for assetId] ID of the dataset/asset to auto-tag.',
      },
      customerId: {
        type: 'string',
        description: 'Customer/tenant ID. Defaults to cust-1.',
      },
      tagCategories: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['pii', 'sensitivity', 'domain', 'freshness', 'quality_tier', 'usage'],
        },
        description: 'Tag categories to evaluate. Defaults to all categories.',
      },
      overwriteExisting: {
        type: 'boolean',
        description: 'If true, overwrite existing tags of the same category. Default false.',
      },
      dryRun: {
        type: 'boolean',
        description: 'If true (default), return proposed tags without applying them.',
      },
      revertToVersion: {
        type: 'string',
        description: 'A taggingId to rollback to, restoring that version\'s tags.',
      },
    },
    required: ['datasetId'],
  },
};

// ── Handler ──

export const autoTagDatasetHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('auto_tag_dataset')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'auto_tag_dataset' }) }],
      isError: true,
    };
  }

  // Accept assetId (standard), datasetId, or tableIdentifier as aliases
  const datasetId = (args.assetId ?? args.datasetId ?? args.tableIdentifier) as string;
  const customerId = (args.customerId as string) || 'cust-1';
  const tagCategories = (args.tagCategories as TagCategory[] | undefined) ?? [
    'pii', 'sensitivity', 'domain', 'freshness', 'quality_tier', 'usage',
  ];
  const overwriteExisting = (args.overwriteExisting as boolean) ?? false;
  const dryRun = (args.dryRun as boolean) ?? true;
  const revertToVersion = args.revertToVersion as string | undefined;

  if (!datasetId || typeof datasetId !== 'string') {
    throw new InvalidParameterError('Parameter "datasetId" is required and must be a string.');
  }

  try {
    // ── Step 1: Find the asset in the graph ──
    const db = graphDB as IGraphDB;
    let node = await db.getNode(datasetId);

    if (!node) {
      const byName = await db.findByName(datasetId, customerId);
      node = byName[0];
    }

    if (!node || node.customerId !== customerId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Dataset '${datasetId}' not found for customer '${customerId}'.`,
            datasetId,
            tagsApplied: [],
            dryRun,
          }, null, 2),
        }],
        isError: true,
      };
    }

    // ── Step 2: Handle rollback ──
    if (revertToVersion) {
      const history = getHistoryForDataset(node.id);
      const targetEntry = history.find(h => h.taggingId === revertToVersion);

      if (!targetEntry) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Tagging version '${revertToVersion}' not found for dataset '${datasetId}'.`,
              availableVersions: history.map(h => h.taggingId),
            }, null, 2),
          }],
          isError: true,
        };
      }

      // Restore previous tags
      const restoredTags = targetEntry.previousTags;
      node.properties.autoTags = restoredTags;
      await db.addNode(node); // upsert

      const rollbackTaggingId = generateTaggingId();
      const rollbackAuditId = generateAuditId();

      storeHistory({
        taggingId: rollbackTaggingId,
        datasetId: node.id,
        timestamp: Date.now(),
        tags: [],
        previousTags: (node.properties.autoTags as string[]) ?? [],
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            taggingId: rollbackTaggingId,
            datasetId: node.id,
            tagsApplied: [],
            restoredTags,
            revertedFrom: revertToVersion,
            dryRun: false,
            auditTrailId: rollbackAuditId,
          }, null, 2),
        }],
      };
    }

    // ── Step 3: Analyze the dataset ──
    const columns = (node.properties.columns as Array<{ name: string; type?: string }>) ?? [];
    const existingAutoTags = (node.properties.autoTags as string[]) ?? [];
    const allProposals: TagProposal[] = [];

    // PII analysis
    if (tagCategories.includes('pii')) {
      const piiTags = analyzeColumnsForPII(columns);
      allProposals.push(...piiTags);
    }

    // Sensitivity classification (depends on PII results; pass table name for financial escalation)
    if (tagCategories.includes('sensitivity')) {
      const piiForSensitivity = tagCategories.includes('pii')
        ? allProposals.filter(t => t.category === 'pii')
        : analyzeColumnsForPII(columns);
      allProposals.push(classifySensitivity(piiForSensitivity, node.name));
    }

    // Domain classification
    if (tagCategories.includes('domain')) {
      allProposals.push(...classifyDomain(node.name, columns));
    }

    // Freshness classification (always generates a tag, even when lastUpdated is missing)
    if (tagCategories.includes('freshness')) {
      allProposals.push(classifyFreshness(node));
    }

    // Quality tier classification
    if (tagCategories.includes('quality_tier')) {
      allProposals.push(classifyQualityTier(node));
    }

    // Usage classification
    if (tagCategories.includes('usage')) {
      allProposals.push(classifyUsage(node));
    }

    // ── Step 4: Check for dbt tags from connectors ──
    const dbtTags = (node.properties.dbtTags as string[]) ?? [];
    for (const dbtTag of dbtTags) {
      if (dbtTag.startsWith('pii') && tagCategories.includes('pii')) {
        const existing = allProposals.find(p => p.tag === `pii:${dbtTag}`);
        if (!existing) {
          allProposals.push({
            category: 'pii',
            tag: `pii:${dbtTag}`,
            confidence: 0.99,
            source: 'content_analysis',
          });
        }
      }
    }

    // ── Step 5: Mark previous tags ──
    for (const proposal of allProposals) {
      const existingTag = existingAutoTags.find(t => t.startsWith(`${proposal.category}:`));
      if (existingTag) {
        proposal.previousTag = existingTag;
      }
    }

    // Filter out tags that already exist if overwriteExisting is false
    const finalProposals = overwriteExisting
      ? allProposals
      : allProposals.filter(p => !p.previousTag || p.tag !== p.previousTag);

    const taggingId = generateTaggingId();
    const auditTrailId = generateAuditId();

    // ── Step 6: Apply or return dry-run results ──
    if (dryRun) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            taggingId,
            datasetId: node.id,
            tagsApplied: finalProposals,
            dryRun: true,
            auditTrailId,
          } satisfies AutoTagResult, null, 2),
        }],
      };
    }

    // Apply tags to graph node
    const previousAutoTags = [...existingAutoTags];
    const newTagSet = new Set(overwriteExisting ? [] : existingAutoTags);

    // Remove tags of categories being overwritten
    if (overwriteExisting) {
      for (const cat of tagCategories) {
        for (const existing of existingAutoTags) {
          if (!existing.startsWith(`${cat}:`)) {
            newTagSet.add(existing);
          }
        }
      }
    }

    for (const proposal of finalProposals) {
      // Remove any existing tag of the same category if overwriting
      if (overwriteExisting) {
        for (const t of Array.from(newTagSet)) {
          if (t.startsWith(`${proposal.category}:`)) {
            newTagSet.delete(t);
          }
        }
      }
      newTagSet.add(proposal.tag);
    }

    node.properties.autoTags = Array.from(newTagSet);
    await db.addNode(node); // upsert

    // Store history for rollback
    storeHistory({
      taggingId,
      datasetId: node.id,
      timestamp: Date.now(),
      tags: finalProposals,
      previousTags: previousAutoTags,
    });

    // ── Step 7: Log to audit trail ──
    const result: AutoTagResult = {
      taggingId,
      datasetId: node.id,
      tagsApplied: finalProposals,
      dryRun: false,
      auditTrailId,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const wrapped = err instanceof ServerToolCallError
      ? err
      : new ServerToolCallError(
          err instanceof Error ? err.message : String(err),
          'AUTO_TAG_DATASET_ERROR',
        );
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: wrapped.message,
          code: wrapped.code,
          retryable: wrapped.retryable,
        }),
      }],
      isError: true,
    };
  }
};

// Exported for testing
export { tagHistory, getHistoryForDataset };
