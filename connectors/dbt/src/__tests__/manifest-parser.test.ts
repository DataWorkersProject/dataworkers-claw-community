import { describe, it, expect } from 'vitest';
import { DbtManifestParser } from '../manifest-parser.js';

describe('DbtManifestParser', () => {
  it('throws when no manifest loaded', () => {
    const parser = new DbtManifestParser();
    expect(() => parser.listModels()).toThrow('No manifest loaded');
  });

  it('parses a manifest and lists models', () => {
    const parser = new DbtManifestParser();
    parser.parse({
      metadata: { dbtVersion: '1.7.0', projectName: 'test', generatedAt: '2026-01-01' },
      nodes: {
        'model.test.stg_orders': {
          uniqueId: 'model.test.stg_orders', name: 'stg_orders', schema: 'staging',
          database: 'analytics', materialization: 'view', description: 'Staging orders',
          columns: [], dependsOn: [], tags: ['staging'],
        },
      },
      sources: {},
    });
    const models = parser.listModels();
    expect(models).toHaveLength(1);
    expect(models[0].name).toBe('stg_orders');
  });

  it('gets model by uniqueId', () => {
    const parser = new DbtManifestParser();
    parser.parse({
      metadata: { dbtVersion: '1.7.0', projectName: 'test', generatedAt: '2026-01-01' },
      nodes: {
        'model.test.mart': {
          uniqueId: 'model.test.mart', name: 'mart', schema: 'marts',
          database: 'analytics', materialization: 'table', description: '',
          columns: [], dependsOn: ['model.test.stg'], tags: [],
        },
      },
      sources: {},
    });
    const model = parser.getModel('model.test.mart');
    expect(model.name).toBe('mart');
  });

  it('throws for unknown model', () => {
    const parser = new DbtManifestParser();
    parser.parse({ metadata: { dbtVersion: '1', projectName: 'x', generatedAt: '' }, nodes: {}, sources: {} });
    expect(() => parser.getModel('nonexistent')).toThrow('Model not found');
  });
});
