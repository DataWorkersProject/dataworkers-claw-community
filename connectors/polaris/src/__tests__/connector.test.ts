import { describe, it, expect, beforeEach } from 'vitest';
import { PolarisConnector } from '../index.js';

describe('PolarisConnector', () => {
  let connector: PolarisConnector;

  beforeEach(async () => {
    connector = new PolarisConnector();
    await connector.connect(
      'https://polaris.example.com',
      'test-client',
      'test-secret',
    );
  });

  // ── OAuth2 authentication ─────────────────────────────────────────

  describe('OAuth2 authentication', () => {
    it('should authenticate and return a token', async () => {
      const fresh = new PolarisConnector();
      const token = await fresh.connect(
        'https://polaris.example.com',
        'my-client',
        'my-secret',
      );

      expect(token).toBeDefined();
      expect(token.accessToken).toContain('polaris_my-client_');
      expect(token.tokenType).toBe('bearer');
      expect(token.expiresIn).toBe(3600);
      expect(token.issuedAt).toBeGreaterThan(0);
    });

    it('should reject empty credentials', async () => {
      const fresh = new PolarisConnector();
      await expect(
        fresh.connect('https://polaris.example.com', '', 'secret'),
      ).rejects.toThrow('clientId and clientSecret are required');
    });
  });

  // ── listCatalogs ──────────────────────────────────────────────────

  describe('listCatalogs', () => {
    it('should return seeded catalogs', async () => {
      const catalogs = await connector.listCatalogs();

      expect(catalogs).toHaveLength(2);

      const production = catalogs.find((c) => c.name === 'production');
      expect(production).toBeDefined();
      expect(production!.type).toBe('INTERNAL');
      expect(production!.storageConfigInfo?.storageType).toBe('S3');

      const staging = catalogs.find((c) => c.name === 'staging');
      expect(staging).toBeDefined();
      expect(staging!.type).toBe('EXTERNAL');
    });
  });

  // ── browseCatalog ─────────────────────────────────────────────────

  describe('browseCatalog', () => {
    it('should return namespaces and tables for production', async () => {
      const result = await connector.browseCatalog('production');

      expect(result.namespaces).toEqual([['analytics'], ['raw']]);
      expect(result.tables.length).toBe(4);

      const analyticsTableNames = result.tables
        .filter((t) => t.namespace[0] === 'analytics')
        .map((t) => t.name);
      expect(analyticsTableNames).toContain('page_views');
      expect(analyticsTableNames).toContain('user_sessions');
    });

    it('should return empty for unknown catalog', async () => {
      const result = await connector.browseCatalog('nonexistent');
      expect(result.namespaces).toEqual([]);
      expect(result.tables).toEqual([]);
    });
  });

  // ── getTableMetadata ──────────────────────────────────────────────

  describe('getTableMetadata', () => {
    it('should return full Iceberg-compatible metadata', async () => {
      const meta = await connector.getTableMetadata(
        'production',
        ['analytics'],
        'page_views',
      );

      expect(meta.tableId).toBe('production-analytics-page_views');
      expect(meta.schema.fields).toHaveLength(3);
      expect(meta.schema.fields[0].name).toBe('id');
      expect(meta.partitionSpec.fields).toHaveLength(1);
      expect(meta.snapshots).toHaveLength(1);
      expect(meta.properties['format-version']).toBe('2');
    });

    it('should throw for unknown table', async () => {
      await expect(
        connector.getTableMetadata('production', ['analytics'], 'missing'),
      ).rejects.toThrow('Table not found');
    });
  });

  // ── getPermissions ────────────────────────────────────────────────

  describe('getPermissions', () => {
    it('should return permission policies for production', async () => {
      const perms = await connector.getPermissions('production');

      expect(perms.length).toBeGreaterThanOrEqual(2);

      const dataTeam = perms.find((p) => p.principal === 'data-team');
      expect(dataTeam).toBeDefined();
      expect(dataTeam!.privileges[0].type).toBe('TABLE_READ');

      const service = perms.find((p) => p.principal === 'dw-service');
      expect(service).toBeDefined();
      expect(service!.privileges[0].type).toBe('TABLE_WRITE');
    });

    it('should return empty for catalog with no policies', async () => {
      const perms = await connector.getPermissions('nonexistent');
      expect(perms).toEqual([]);
    });
  });

  // ── checkAccess ───────────────────────────────────────────────────

  describe('checkAccess', () => {
    it('should allow data-team TABLE_READ on production', async () => {
      const result = await connector.checkAccess(
        'data-team',
        'production',
        undefined,
        undefined,
        'TABLE_READ',
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('data-team');
      expect(result.reason).toContain('TABLE_READ');
    });

    it('should deny data-team TABLE_WRITE on production', async () => {
      const result = await connector.checkAccess(
        'data-team',
        'production',
        undefined,
        undefined,
        'TABLE_WRITE',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('lacks');
    });

    it('should allow dw-service TABLE_WRITE on production', async () => {
      const result = await connector.checkAccess(
        'dw-service',
        'production',
        undefined,
        undefined,
        'TABLE_WRITE',
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny unknown principal', async () => {
      const result = await connector.checkAccess(
        'unknown-user',
        'production',
        undefined,
        undefined,
        'TABLE_READ',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('no privileges');
    });
  });

  // ── Error handling: unauthenticated ───────────────────────────────

  describe('unauthenticated requests', () => {
    it('should throw when listing catalogs without auth', async () => {
      const fresh = new PolarisConnector();
      // Don't connect — go straight to listing
      await expect(fresh.listCatalogs()).rejects.toThrow('not authenticated');
    });

    it('should throw after disconnect', async () => {
      connector.disconnect();
      await expect(connector.listCatalogs()).rejects.toThrow(
        'not authenticated',
      );
    });
  });

  // ── Token expiry & refresh ────────────────────────────────────────

  describe('token expiry and refresh', () => {
    it('should report healthy when authenticated', async () => {
      const status = await connector.healthCheck();
      expect(status.healthy).toBe(true);
      expect(status.authenticated).toBe(true);
      expect(status.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should report unhealthy when not authenticated', async () => {
      const fresh = new PolarisConnector();
      const status = await fresh.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.authenticated).toBe(false);
    });
  });
});
