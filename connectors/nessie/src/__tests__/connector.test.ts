import { describe, it, expect, beforeEach } from 'vitest';
import { NessieConnector } from '../index.js';

describe('NessieConnector', () => {
  let connector: NessieConnector;

  beforeEach(() => {
    connector = new NessieConnector();
  });

  // --- connect / disconnect / healthCheck ---

  describe('connect / disconnect / healthCheck', () => {
    it('should connect successfully', () => {
      connector.connect();
      const health = connector.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should report unhealthy when disconnected', () => {
      connector.connect();
      connector.disconnect();
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should report unhealthy before connecting', () => {
      const health = connector.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should have correct connector type', () => {
      expect(connector.connectorType).toBe('nessie');
      expect(connector.providerType).toBe('nessie');
    });

    it('should have correct capabilities', () => {
      expect(connector.capabilities).toContain('discovery');
      expect(connector.capabilities).toContain('versioning');
    });
  });

  // --- listReferences ---

  describe('listReferences', () => {
    it('should return branches and tags', () => {
      connector.connect();
      const refs = connector.listReferences();
      expect(refs.length).toBeGreaterThan(0);
      const branches = refs.filter((r) => r.type === 'BRANCH');
      const tags = refs.filter((r) => r.type === 'TAG');
      expect(branches.length).toBe(3);
      expect(tags.length).toBe(5);
      expect(branches.some((b) => b.name === 'main')).toBe(true);
      expect(branches.some((b) => b.name === 'develop')).toBe(true);
      expect(branches.some((b) => b.name === 'feature/experiment')).toBe(true);
    });
  });

  // --- listContent ---

  describe('listContent', () => {
    it('should return entries on main branch', () => {
      connector.connect();
      const entries = connector.listContent('main');
      expect(entries.length).toBeGreaterThan(0);
      const tables = entries.filter((e) => e.type !== 'NAMESPACE');
      expect(tables.length).toBeGreaterThanOrEqual(6);
      expect(tables[0].key.elements.length).toBeGreaterThan(0);
    });

    it('should return more entries on develop branch', () => {
      connector.connect();
      const mainEntries = connector.listContent('main');
      const devEntries = connector.listContent('develop');
      expect(devEntries.length).toBeGreaterThan(mainEntries.length);
    });

    it('should throw for unknown reference', () => {
      connector.connect();
      expect(() => connector.listContent('nonexistent')).toThrow('Reference not found');
    });
  });

  // --- getContent ---

  describe('getContent', () => {
    it('should return table metadata', () => {
      connector.connect();
      const table = connector.getContent('main', { elements: ['warehouse', 'analytics', 'customers'] });
      expect(table.id).toBe('tbl-001');
      expect(table.metadataLocation).toContain('customers');
      expect(table.snapshotId).toBeGreaterThan(0);
    });

    it('should throw for unknown key', () => {
      connector.connect();
      expect(() => connector.getContent('main', { elements: ['nonexistent'] })).toThrow('Content not found');
    });
  });

  // --- createBranch ---

  describe('createBranch', () => {
    it('should create a new branch from main', () => {
      connector.connect();
      const branch = connector.createBranch('test-branch', 'main');
      expect(branch.name).toBe('test-branch');
      expect(branch.type).toBe('BRANCH');
      expect(branch.hash).toBeDefined();

      // New branch should have content from source
      const content = connector.listContent('test-branch');
      expect(content.length).toBeGreaterThan(0);
    });

    it('should throw if branch already exists', () => {
      connector.connect();
      expect(() => connector.createBranch('main', 'develop')).toThrow('Branch already exists');
    });

    it('should throw for unknown source', () => {
      connector.connect();
      expect(() => connector.createBranch('new-branch', 'nonexistent')).toThrow('Source reference not found');
    });
  });

  // --- diffRefs ---

  describe('diffRefs', () => {
    it('should show diff between main and develop', () => {
      connector.connect();
      const diffs = connector.diffRefs('main', 'develop');
      expect(diffs.length).toBeGreaterThan(0);
      // develop has extra tables not in main
      const added = diffs.filter((d) => d.from === null && d.to !== null);
      expect(added.length).toBeGreaterThan(0);
    });

    it('should show no diff for same ref', () => {
      connector.connect();
      const diffs = connector.diffRefs('main', 'main');
      expect(diffs).toHaveLength(0);
    });

    it('should throw for unknown reference', () => {
      connector.connect();
      expect(() => connector.diffRefs('nonexistent', 'main')).toThrow('Reference not found');
    });
  });

  // --- commitLog ---

  describe('commitLog', () => {
    it('should return commit history for main', () => {
      connector.connect();
      const log = connector.commitLog('main');
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].hash).toBeDefined();
      expect(log[0].message).toBeDefined();
      expect(log[0].author).toBeDefined();
      expect(log[0].commitTime).toBeDefined();
    });

    it('should return more commits for develop', () => {
      connector.connect();
      const mainLog = connector.commitLog('main');
      const devLog = connector.commitLog('develop');
      expect(devLog.length).toBeGreaterThan(mainLog.length);
    });
  });

  // --- ICatalogProvider methods ---

  describe('listNamespaces', () => {
    it('should return branches as namespaces', () => {
      connector.connect();
      const namespaces = connector.listNamespaces();
      expect(namespaces.length).toBe(3);
      expect(namespaces[0].properties).toHaveProperty('hash');
    });
  });

  describe('listTables', () => {
    it('should return tables on main branch', () => {
      connector.connect();
      const tables = connector.listTables('main');
      expect(tables.length).toBeGreaterThan(0);
      expect(tables[0]).toHaveProperty('name');
      expect(tables[0]).toHaveProperty('namespace');
      expect(tables[0].properties).toHaveProperty('type');
    });
  });

  describe('getTableMetadata', () => {
    it('should return metadata for a table', () => {
      connector.connect();
      const meta = connector.getTableMetadata('main', 'customers');
      expect(meta.name).toBe('customers');
      expect(meta.properties).toHaveProperty('metadataLocation');
      expect(meta.properties).toHaveProperty('snapshotId');
    });

    it('should throw for unknown table', () => {
      connector.connect();
      expect(() => connector.getTableMetadata('main', 'nonexistent')).toThrow('Table not found');
    });
  });

  describe('searchTables', () => {
    it('should search tables by name', () => {
      connector.connect();
      const results = connector.searchTables('orders');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('name');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('should throw on operations when not connected', () => {
      expect(() => connector.listReferences()).toThrow('Not connected');
      expect(() => connector.listContent('main')).toThrow('Not connected');
      expect(() => connector.getContent('main', { elements: ['test'] })).toThrow('Not connected');
      expect(() => connector.createBranch('test', 'main')).toThrow('Not connected');
      expect(() => connector.diffRefs('main', 'develop')).toThrow('Not connected');
      expect(() => connector.commitLog('main')).toThrow('Not connected');
      expect(() => connector.listNamespaces()).toThrow('Not connected');
      expect(() => connector.listTables('main')).toThrow('Not connected');
      expect(() => connector.searchTables('test')).toThrow('Not connected');
    });
  });
});
