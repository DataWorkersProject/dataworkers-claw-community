/**
 * Shared backend instances for the dw-connectors agent.
 *
 * Instantiates all data platform connectors using fromEnv() where available,
 * falling back to stub clients for offline development and testing.
 */

import { SnowflakeConnector } from '../../../connectors/snowflake/src/index.js';
import { BigQueryConnector } from '../../../connectors/bigquery/src/index.js';
import { DbtConnector } from '../../../connectors/dbt/src/index.js';
import { DatabricksConnector } from '../../../connectors/databricks/src/index.js';
import { CatalogRegistry } from '../../../connectors/shared/catalog-registry.js';
import { IcebergConnector } from '../../../connectors/iceberg/src/index.js';
import { PolarisConnector } from '../../../connectors/polaris/src/index.js';
import { GlueConnector } from '../../../connectors/glue/src/index.js';
import { HiveMetastoreConnector } from '../../../connectors/hive-metastore/src/index.js';
import { OpenMetadataConnector } from '../../../connectors/openmetadata/src/index.js';
import { OpenLineageConnector } from '../../../connectors/openlineage/src/index.js';
import { DataHubConnector } from '../../../connectors/datahub/src/index.js';
import { PurviewConnector } from '../../../connectors/purview/src/index.js';
import { DataplexConnector } from '../../../connectors/dataplex/src/index.js';
import { NessieConnector } from '../../../connectors/nessie/src/index.js';


export const snowflake = SnowflakeConnector.fromEnv();
export const bigquery = BigQueryConnector.fromEnv();
export const dbt = new DbtConnector();
export const databricks = new DatabricksConnector();
export const glue = new GlueConnector();
export const hiveMetastore = new HiveMetastoreConnector();
export const openmetadata = new OpenMetadataConnector();
export const openlineage = new OpenLineageConnector();
export const datahub = new DataHubConnector();
export const purview = new PurviewConnector();
export const dataplex = new DataplexConnector();
export const nessie = new NessieConnector();

// Auto-connect all connectors
snowflake.connect();
bigquery.connect('stub-project');
dbt.connect('stub-token');
databricks.connect('https://stub.cloud.databricks.com', 'stub-token');
glue.connect();
hiveMetastore.connect();
openmetadata.connect();
openlineage.connect();
datahub.connect();
purview.connect();
dataplex.connect();
nessie.connect();


// --- Unified Catalog Registry ---
export const catalogRegistry = new CatalogRegistry();

// Register all connectors as catalog providers
catalogRegistry.register('snowflake', () => snowflake);
catalogRegistry.register('bigquery', () => bigquery);
catalogRegistry.register('dbt', () => dbt);
catalogRegistry.register('databricks', () => databricks);
catalogRegistry.register('iceberg', () => {
  const connector = new IcebergConnector();
  connector.connect('http://localhost:8181');
  return connector;
});
catalogRegistry.register('polaris', () => {
  const connector = new PolarisConnector();
  return connector;
});
catalogRegistry.register('glue', () => glue);
catalogRegistry.register('hive-metastore', () => hiveMetastore);
catalogRegistry.register('openmetadata', () => openmetadata);
catalogRegistry.register('openlineage', () => openlineage);
catalogRegistry.register('datahub', () => datahub);
catalogRegistry.register('purview', () => purview);
catalogRegistry.register('dataplex', () => dataplex);
catalogRegistry.register('nessie', () => nessie);

// Eagerly instantiate the already-connected providers
catalogRegistry.create('snowflake');
catalogRegistry.create('bigquery');
catalogRegistry.create('dbt');
catalogRegistry.create('databricks');
catalogRegistry.create('glue');
catalogRegistry.create('hive-metastore');
catalogRegistry.create('openmetadata');
catalogRegistry.create('openlineage');
catalogRegistry.create('datahub');
catalogRegistry.create('purview');
catalogRegistry.create('dataplex');
catalogRegistry.create('nessie');
