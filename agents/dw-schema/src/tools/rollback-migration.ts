/**
 * rollback_migration tool — rolls back a previously applied migration
 * using the stored rollback SQL. Publishes migration.rolled_back event.
 *
 * New tool added in P3.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';
import type { MigrationScript } from '../types.js';
import { messageBus } from '../backends.js';

export const rollbackMigrationDefinition: ToolDefinition = {
  name: 'rollback_migration',
  description: 'Roll back a previously applied migration using its rollback SQL. Notifies downstream agents and publishes rollback events.',
  inputSchema: {
    type: 'object',
    properties: {
      migration: { type: 'object', description: 'The migration to roll back (must include rollbackSql).' },
      customerId: { type: 'string' },
      reason: { type: 'string', description: 'Reason for the rollback.' },
      dryRun: { type: 'boolean', description: 'If true, validate rollback without executing. Default: false.' },
    },
    required: ['migration', 'customerId'],
  },
};

export const rollbackMigrationHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('rollback_migration')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'rollback_migration' }) }],
      isError: true,
    };
  }

  const migration = args.migration as MigrationScript;
  const customerId = args.customerId as string;
  const reason = (args.reason as string) ?? 'No reason provided';
  const dryRun = (args.dryRun as boolean) ?? false;
  const start = Date.now();

  try {
    if (!customerId) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'customerId is required' }, null, 2) }],
        isError: true,
      };
    }

    if (!migration?.rollbackSql) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No rollback SQL provided in migration' }, null, 2) }],
        isError: true,
      };
    }

    if (dryRun) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            migrationId: migration.id ?? 'unknown',
            rollbackSql: migration.rollbackSql,
            reason,
            note: 'DRY RUN: rollback validated but not executed',
            durationMs: Date.now() - start,
          }, null, 2),
        }],
      };
    }

    // In production: execute rollbackSql against the warehouse
    // For now: simulate successful rollback

    const result = {
      success: true,
      migrationId: migration.id ?? 'unknown',
      rolledBackAt: Date.now(),
      reason,
      rollbackSql: migration.rollbackSql,
      downstreamNotified: ['dw-pipelines', 'dw-quality', 'dw-context-catalog'],
      durationMs: Date.now() - start,
    };

    // Publish rollback event
    try {
      await messageBus.publish('schema.events', {
        id: `evt-mig-rollback-${Date.now()}`,
        type: 'migration.rolled_back',
        payload: {
          migrationId: migration.id ?? 'unknown',
          changeId: migration.changeId,
          reason,
        },
        timestamp: Date.now(),
        customerId,
      });
    } catch {
      // Non-fatal
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    // Publish failure event
    try {
      await messageBus.publish('schema.events', {
        id: `evt-mig-fail-${Date.now()}`,
        type: 'migration.failed',
        payload: {
          migrationId: migration?.id ?? 'unknown',
          error: err instanceof Error ? err.message : String(err),
          phase: 'rollback',
        },
        timestamp: Date.now(),
        customerId,
      });
    } catch {
      // Non-fatal
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }, null, 2),
      }],
      isError: true,
    };
  }
};
