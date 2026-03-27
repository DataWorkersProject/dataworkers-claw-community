import { describe, it, expect } from 'vitest';
import { diffSchemas } from '../diff-engine.js';
import type { ColumnDef } from '@data-workers/infrastructure-stubs';

const ctx = {
  customerId: 'cust-1',
  source: 'snowflake',
  database: 'analytics',
  schema: 'public',
  table: 'orders',
};

function col(name: string, type: string, nullable = false): ColumnDef {
  return { name, type, nullable };
}

describe('diffSchemas', () => {
  it('detects column added', () => {
    const oldCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(255)')];
    const newCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(255)'), col('email', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('column_added');
    expect(changes[0].details.column).toBe('email');
    expect(changes[0].severity).toBe('non-breaking');
  });

  it('detects column removed', () => {
    const oldCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(255)'), col('legacy', 'VARCHAR(50)')];
    const newCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('column_removed');
    expect(changes[0].details.column).toBe('legacy');
    expect(changes[0].severity).toBe('breaking');
  });

  it('detects column type change — breaking (narrowing)', () => {
    const oldCols = [col('id', 'INTEGER'), col('amount', 'DECIMAL(10,2)')];
    const newCols = [col('id', 'INTEGER'), col('amount', 'INTEGER')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('column_type_changed');
    expect(changes[0].severity).toBe('breaking');
  });

  it('detects column type change — non-breaking (widening)', () => {
    const oldCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(50)')];
    const newCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(100)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('column_type_changed');
    expect(changes[0].severity).toBe('non-breaking');
  });

  it('detects column rename when names are similar and types match', () => {
    const oldCols = [col('id', 'INTEGER'), col('usr_name', 'VARCHAR(255)')];
    const newCols = [col('id', 'INTEGER'), col('username', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    // Should detect as rename since Levenshtein("usr_name","username") = 2 < 3 and types match
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('column_renamed');
    expect(changes[0].severity).toBe('warning');
    expect(changes[0].details.oldName).toBe('usr_name');
    expect(changes[0].details.newName).toBe('username');
  });

  it('includes confidence score for rename detection', () => {
    const oldCols = [col('id', 'INTEGER'), col('usr_name', 'VARCHAR(255)')];
    const newCols = [col('id', 'INTEGER'), col('username', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe('column_renamed');
    expect(changes[0].confidence).toBeDefined();
    expect(changes[0].confidence).toBeGreaterThan(0);
    expect(changes[0].confidence).toBeLessThanOrEqual(1);
  });

  it('does NOT classify as rename when types differ', () => {
    const oldCols = [col('id', 'INTEGER'), col('amt', 'DECIMAL(10,2)')];
    const newCols = [col('id', 'INTEGER'), col('amts', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    // Different types — should be remove + add, not rename
    const renamed = changes.filter(c => c.changeType === 'column_renamed');
    expect(renamed).toHaveLength(0);
    expect(changes.some(c => c.changeType === 'column_removed')).toBe(true);
    expect(changes.some(c => c.changeType === 'column_added')).toBe(true);
  });

  it('does NOT classify as rename when Levenshtein distance >= 3', () => {
    const oldCols = [col('id', 'INTEGER'), col('first_name', 'VARCHAR(255)')];
    const newCols = [col('id', 'INTEGER'), col('email_addr', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    // Levenshtein("first_name","email_addr") is large — should be remove + add
    const renamed = changes.filter(c => c.changeType === 'column_renamed');
    expect(renamed).toHaveLength(0);
    expect(changes).toHaveLength(2);
  });

  it('detects multiple simultaneous changes', () => {
    const oldCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(50)'), col('legacy', 'VARCHAR(100)')];
    const newCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(100)'), col('email', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    // legacy removed, email added, name type widened
    expect(changes).toHaveLength(3);
    const types = changes.map(c => c.changeType).sort();
    expect(types).toEqual(['column_added', 'column_removed', 'column_type_changed']);
  });

  it('returns empty array when schemas are identical', () => {
    const cols = [col('id', 'INTEGER'), col('name', 'VARCHAR(255)')];
    const changes = diffSchemas(cols, cols, ctx);
    expect(changes).toHaveLength(0);
  });

  it('matches columns case-insensitively', () => {
    const oldCols = [col('ID', 'INTEGER'), col('Name', 'VARCHAR(255)')];
    const newCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);
    expect(changes).toHaveLength(0);
  });

  it('uses detectedVia=information_schema for diff-engine changes', () => {
    const oldCols = [col('id', 'INTEGER')];
    const newCols = [col('id', 'INTEGER'), col('email', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    expect(changes).toHaveLength(1);
    expect(changes[0].detectedVia).toBe('information_schema');
  });

  it('handles empty old schema (all columns are new)', () => {
    const oldCols: ColumnDef[] = [];
    const newCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(255)')];
    const changes = diffSchemas(oldCols, newCols, ctx);

    expect(changes).toHaveLength(2);
    expect(changes.every(c => c.changeType === 'column_added')).toBe(true);
  });

  it('handles empty new schema (all columns removed)', () => {
    const oldCols = [col('id', 'INTEGER'), col('name', 'VARCHAR(255)')];
    const newCols: ColumnDef[] = [];
    const changes = diffSchemas(oldCols, newCols, ctx);

    expect(changes).toHaveLength(2);
    expect(changes.every(c => c.changeType === 'column_removed')).toBe(true);
    expect(changes.every(c => c.severity === 'breaking')).toBe(true);
  });
});
