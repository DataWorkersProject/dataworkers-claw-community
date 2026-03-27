/**
 * Iceberg-specific pipeline task generators — STRIPPED (OSS).
 *
 * Iceberg pipeline generation requires Data Workers Pro.
 * Visit https://dataworkers.dev/pricing
 */

import type { PipelineTask } from '../types.js';

const PRO_MESSAGE = 'Iceberg pipeline generation requires Data Workers Pro. Visit https://dataworkers.dev/pricing';

export function generateMergeIntoSQL(
  _targetTable: string,
  _sourceTable: string,
  _matchColumns: string[],
  _updateColumns: string[],
): string {
  return `-- ${PRO_MESSAGE}`;
}

export function generateCompactTask(_table: string): PipelineTask {
  return {
    id: 'stub',
    name: 'compact_stub',
    type: 'transform',
    description: PRO_MESSAGE,
    code: `-- ${PRO_MESSAGE}`,
    codeLanguage: 'sql',
    dependencies: [],
    config: {},
  };
}

export function generateExpireSnapshotsTask(_table: string, _olderThanDays?: number): PipelineTask {
  return {
    id: 'stub',
    name: 'expire_snapshots_stub',
    type: 'transform',
    description: PRO_MESSAGE,
    code: `-- ${PRO_MESSAGE}`,
    codeLanguage: 'sql',
    dependencies: [],
    config: {},
  };
}

export function generateRewriteManifestsTask(_table: string): PipelineTask {
  return {
    id: 'stub',
    name: 'rewrite_manifests_stub',
    type: 'transform',
    description: PRO_MESSAGE,
    code: `-- ${PRO_MESSAGE}`,
    codeLanguage: 'sql',
    dependencies: [],
    config: {},
  };
}
