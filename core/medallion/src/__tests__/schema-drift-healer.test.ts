import { describe, it, expect } from 'vitest';
import { SchemaDriftHealer } from '../schema-drift-healer.js';

describe('SchemaDriftHealer', () => {
  it('exports SchemaDriftHealer class', () => {
    expect(SchemaDriftHealer).toBeDefined();
  });

  it('detects no drift when schemas match', () => {
    const healer = new SchemaDriftHealer();
    const source = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'name', type: 'string', nullable: true },
    ];
    const target = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'name', type: 'string', nullable: true },
    ];
    const drifts = healer.detectDrift(source, target);
    expect(drifts).toHaveLength(0);
  });

  it('detects column_added drift', () => {
    const healer = new SchemaDriftHealer();
    const source = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'email', type: 'string', nullable: true },
    ];
    const target = [{ name: 'id', type: 'int', nullable: false }];
    const drifts = healer.detectDrift(source, target);
    expect(drifts.some((d) => d.kind === 'column_added')).toBe(true);
  });

  it('detects column_removed drift', () => {
    const healer = new SchemaDriftHealer();
    const source = [{ name: 'id', type: 'int', nullable: false }];
    const target = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'old_col', type: 'string', nullable: true },
    ];
    const drifts = healer.detectDrift(source, target);
    expect(drifts.some((d) => d.kind === 'column_removed')).toBe(true);
  });

  it('marks additive drifts as auto-healable', () => {
    const healer = new SchemaDriftHealer();
    const source = [
      { name: 'id', type: 'int', nullable: false },
      { name: 'new_col', type: 'string', nullable: true },
    ];
    const target = [{ name: 'id', type: 'int', nullable: false }];
    const drifts = healer.detectDrift(source, target);
    const added = drifts.find((d) => d.kind === 'column_added');
    expect(added?.autoHealable).toBe(true);
  });
});
