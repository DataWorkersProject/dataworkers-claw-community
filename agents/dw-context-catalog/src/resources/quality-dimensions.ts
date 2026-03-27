/**
 * MCP Resource: Quality Dimensions
 *
 * Static JSON describing the 6 data quality dimensions used for scoring.
 * Read-only reference for clients interpreting quality scores.
 */

import type { ResourceDefinition, ResourceHandler } from '@data-workers/mcp-framework';

const dimensions = [
  {
    id: 'accuracy',
    name: 'Accuracy',
    description: 'Degree to which data correctly represents real-world values. Measured via constraint checks, cross-source validation, and known-good comparisons.',
    weight: 0.20,
    checks: ['null-rate', 'range-violations', 'referential-integrity', 'cross-source-match'],
    scoring: '1.0 = zero violations; 0.0 = all records fail',
  },
  {
    id: 'completeness',
    name: 'Completeness',
    description: 'Proportion of expected data that is present. Measures missing values, missing rows, and coverage gaps across required fields.',
    weight: 0.20,
    checks: ['null-percentage', 'row-count-vs-expected', 'required-field-coverage'],
    scoring: '1.0 = fully populated; 0.0 = all values missing',
  },
  {
    id: 'consistency',
    name: 'Consistency',
    description: 'Agreement of data across sources, systems, and time periods. Detects contradictions between replicas and format deviations.',
    weight: 0.15,
    checks: ['cross-table-agreement', 'format-conformance', 'business-rule-compliance'],
    scoring: '1.0 = fully consistent; 0.0 = all records conflict',
  },
  {
    id: 'timeliness',
    name: 'Timeliness',
    description: 'How current the data is relative to its SLA or expected refresh cadence. Stale data scores lower.',
    weight: 0.20,
    checks: ['last-updated-vs-sla', 'refresh-lag', 'partition-recency'],
    scoring: '1.0 = within SLA; 0.0 = critically stale',
  },
  {
    id: 'validity',
    name: 'Validity',
    description: 'Conformance to defined formats, types, and business rules. Checks schema compliance, regex patterns, and enumeration membership.',
    weight: 0.15,
    checks: ['type-conformance', 'regex-match', 'enum-membership', 'length-bounds'],
    scoring: '1.0 = all records valid; 0.0 = all records violate rules',
  },
  {
    id: 'uniqueness',
    name: 'Uniqueness',
    description: 'Absence of duplicate records on defined key columns. Measures duplicate rate and near-duplicate fuzzy matches.',
    weight: 0.10,
    checks: ['exact-duplicate-rate', 'primary-key-uniqueness', 'fuzzy-duplicate-detection'],
    scoring: '1.0 = zero duplicates; 0.0 = all records duplicated',
  },
];

const content = JSON.stringify({
  totalDimensions: dimensions.length,
  compositeFormula: 'qualityScore = sum(dimension.score * dimension.weight)',
  dimensions,
}, null, 2);

export const qualityDimensionsDefinition: ResourceDefinition = {
  uri: 'catalog://ref/quality-dimensions',
  name: 'Data Quality Dimensions',
  description: 'The 6 data quality scoring dimensions (accuracy, completeness, consistency, timeliness, validity, uniqueness) with weights, checks, and scoring rules.',
  mimeType: 'application/json',
};

export const qualityDimensionsHandler: ResourceHandler = async (_uri: string) => ({
  contents: [{
    uri: 'catalog://ref/quality-dimensions',
    mimeType: 'application/json',
    text: content,
  }],
});
