/**
 * Connector Auto-Discovery & Graceful Degradation
 *
 * Discovers available ICatalogProvider connectors from environment
 * variables, dynamically imports them, and registers with CatalogRegistry.
 * All registrations are optional — the app works with 0–15 connectors.
 */

import type { CatalogRegistry } from '@data-workers/connector-shared';
import type { ICatalogProvider } from '@data-workers/connector-shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectorStatus = 'healthy' | 'degraded' | 'unavailable';

export interface ConnectorHealthInfo {
  status: ConnectorStatus;
  lastCheck: Date;
  errorMessage?: string;
}

interface ConnectorSpec {
  /** Unique connector type key (matches providerType / connectorType). */
  type: string;
  /** Environment variable(s) — at least one must be set to attempt registration. */
  envVars: string[];
  /** Factory: dynamically import the connector and return an instance. */
  factory: () => Promise<ICatalogProvider>;
}

// ---------------------------------------------------------------------------
// Health tracking
// ---------------------------------------------------------------------------

const healthMap = new Map<string, ConnectorHealthInfo>();

function setHealth(type: string, status: ConnectorStatus, errorMessage?: string): void {
  healthMap.set(type, { status, lastCheck: new Date(), errorMessage });
}

/** Returns a snapshot of health for every connector that was attempted. */
export function getConnectorHealth(): Record<string, ConnectorHealthInfo> {
  const result: Record<string, ConnectorHealthInfo> = {};
  for (const [k, v] of healthMap) {
    result[k] = { ...v };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Graceful degradation wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps an async call with try/catch + timeout.
 * Returns `fallback` on error or timeout instead of throwing.
 */
export async function withGracefulDegradation<T>(
  fn: () => Promise<T>,
  fallback: T,
  timeoutMs: number,
  connectorName?: string,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return result;
  } catch (err: unknown) {
    const duration = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const label = connectorName ?? 'unknown';
    console.warn(
      `[connector-discovery] Degradation event for "${label}": ${message} (${duration}ms)`,
    );
    if (connectorName) {
      setHealth(connectorName, 'degraded', message);
    }
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Connector specifications
// ---------------------------------------------------------------------------

function hasEnv(...names: string[]): boolean {
  return names.some((n) => !!process.env[n]);
}

const CONNECTOR_SPECS: ConnectorSpec[] = [
  {
    type: 'snowflake',
    envVars: ['SNOWFLAKE_ACCOUNT'],
    factory: async () => {
      const { SnowflakeConnector } = await import('@data-workers/snowflake-connector');
      return SnowflakeConnector.fromEnv();
    },
  },
  {
    type: 'bigquery',
    envVars: ['GOOGLE_CLOUD_PROJECT', 'GCP_PROJECT_ID'],
    factory: async () => {
      const { BigQueryConnector } = await import('@data-workers/bigquery-connector');
      return BigQueryConnector.fromEnv();
    },
  },
  {
    type: 'databricks',
    envVars: ['DATABRICKS_HOST'],
    factory: async () => {
      const { DatabricksConnector } = await import('@data-workers/databricks-connector');
      return DatabricksConnector.fromEnv();
    },
  },
  {
    type: 'dbt',
    envVars: ['DBT_API_TOKEN', 'DBT_CLOUD_TOKEN'],
    factory: async () => {
      const { DbtConnector } = await import('@data-workers/dbt-connector');
      return DbtConnector.fromEnv();
    },
  },
  {
    type: 'iceberg',
    envVars: ['ICEBERG_REST_ENDPOINT'],
    factory: async () => {
      const { IcebergConnector } = await import('@data-workers/iceberg-connector');
      const connector = new IcebergConnector();
      connector.connect(process.env.ICEBERG_REST_ENDPOINT!);
      return connector as unknown as ICatalogProvider;
    },
  },
  {
    type: 'polaris',
    envVars: ['POLARIS_ENDPOINT'],
    factory: async () => {
      const { PolarisConnector } = await import('@data-workers/polaris-connector');
      const connector = new PolarisConnector();
      const endpoint = process.env.POLARIS_ENDPOINT!;
      const clientId = process.env.POLARIS_CLIENT_ID ?? '';
      const clientSecret = process.env.POLARIS_CLIENT_SECRET ?? '';
      await connector.connect(endpoint, clientId, clientSecret);
      return connector as unknown as ICatalogProvider;
    },
  },
  {
    type: 'glue',
    envVars: ['AWS_REGION', 'AWS_GLUE_CATALOG_ID', 'GLUE_REGION'],
    factory: async () => {
      const { GlueConnector } = await import('@data-workers/glue-connector');
      return GlueConnector.fromEnv();
    },
  },
  {
    type: 'hive-metastore',
    envVars: ['HIVE_METASTORE_URI'],
    factory: async () => {
      const { HiveMetastoreConnector } = await import('@data-workers/hive-metastore-connector');
      return HiveMetastoreConnector.fromEnv();
    },
  },
  {
    type: 'datahub',
    envVars: ['DATAHUB_URL'],
    factory: async () => {
      const { DataHubConnector } = await import('@data-workers/datahub-connector');
      return DataHubConnector.fromEnv();
    },
  },
  {
    type: 'openmetadata',
    envVars: ['OPENMETADATA_URL'],
    factory: async () => {
      const { OpenMetadataConnector } = await import('@data-workers/openmetadata-connector');
      return OpenMetadataConnector.fromEnv();
    },
  },
  {
    type: 'nessie',
    envVars: ['NESSIE_URL'],
    factory: async () => {
      const { NessieConnector } = await import('@data-workers/nessie-connector');
      return NessieConnector.fromEnv();
    },
  },
  {
    type: 'purview',
    envVars: ['AZURE_PURVIEW_ENDPOINT'],
    factory: async () => {
      const { PurviewConnector } = await import('@data-workers/purview-connector');
      return PurviewConnector.fromEnv();
    },
  },
  {
    type: 'dataplex',
    envVars: ['DATAPLEX_LOCATION'],
    factory: async () => {
      const { DataplexConnector } = await import('@data-workers/dataplex-connector');
      return DataplexConnector.fromEnv();
    },
  },
  {
    type: 'openlineage',
    envVars: ['OPENLINEAGE_URL'],
    factory: async () => {
      const { OpenLineageConnector } = await import('@data-workers/openlineage-connector');
      return OpenLineageConnector.fromEnv();
    },
  },
  // Future connectors (not yet implemented):
  // { type: 'gravitino', envVars: ['GRAVITINO_URL'], factory: ... },
  // { type: 'tabular', envVars: ['TABULAR_TOKEN'], factory: ... },
  // { type: 'lakefs', envVars: ['LAKEFS_ENDPOINT'], factory: ... },
];

// ---------------------------------------------------------------------------
// Auto-discovery entry point
// ---------------------------------------------------------------------------

/**
 * Discovers connectors from environment variables and registers them
 * with the provided CatalogRegistry. Each import is dynamic (lazy) so
 * missing npm packages do not break the application.
 *
 * @returns List of connector types that were successfully registered.
 */
export async function discoverAndRegisterConnectors(
  registry: CatalogRegistry,
): Promise<string[]> {
  const registered: string[] = [];
  const skipped: string[] = [];

  for (const spec of CONNECTOR_SPECS) {
    if (!hasEnv(...spec.envVars)) {
      skipped.push(spec.type);
      setHealth(spec.type, 'unavailable', 'Required env vars not set');
      continue;
    }

    // Register a lazy factory that will dynamically import on first use
    registry.register(spec.type, () => {
      // Placeholder: real instantiation happens in the async path below.
      // This synchronous factory is only used if `registry.create()` is
      // called before the async registration completes.
      throw new Error(
        `Connector "${spec.type}" is being loaded asynchronously. Use discoverAndRegisterConnectors() result.`,
      );
    });

    // Attempt async instantiation with graceful degradation
    const connector = await withGracefulDegradation(
      spec.factory,
      null as ICatalogProvider | null,
      10_000,
      spec.type,
    );

    if (connector) {
      // Re-register with a factory that returns the already-created instance
      registry.register(spec.type, () => connector);
      registered.push(spec.type);
      setHealth(spec.type, 'healthy');
      console.log(`[connector-discovery] Registered connector: ${spec.type}`);
    } else {
      setHealth(spec.type, 'degraded', 'Factory returned null / timed out');
      console.warn(`[connector-discovery] Failed to load connector: ${spec.type}`);
    }
  }

  if (registered.length === 0) {
    console.log(
      '[connector-discovery] No connectors discovered — using InMemory fallback.',
    );
  } else {
    console.log(
      `[connector-discovery] ${registered.length} connector(s) registered: ${registered.join(', ')}`,
    );
  }

  if (skipped.length > 0) {
    console.log(
      `[connector-discovery] ${skipped.length} connector(s) skipped (env vars not set): ${skipped.join(', ')}`,
    );
  }

  return registered;
}
