import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  dts: true,
  banner: { js: '#!/usr/bin/env node' },
  external: [
    '@modelcontextprotocol/sdk',
    // Optional connector SDKs — loaded dynamically at runtime, not needed for bundling
    'hive-driver',
    '@google-cloud/dataplex',
    '@aws-sdk/client-lakeformation',
    '@aws-sdk/client-glue',
    '@aws-sdk/client-redshift-data',
    '@aws-sdk/client-athena',
    'snowflake-sdk',
    '@google-cloud/bigquery',
    '@databricks/sql',
    'pg',
    'mysql2',
    'mssql',
    'oracledb',
    'mongodb',
  ],
  noExternal: [/@data-workers\/.*/],
});
