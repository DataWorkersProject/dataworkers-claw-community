import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  splitting: true,
  sourcemap: false,
  dts: false,
  // Bundle all workspace dependencies inline
  noExternal: [/@data-workers\/.*/],
  // Don't bundle heavy optional warehouse SDKs or enterprise modules
  external: [
    'snowflake-sdk',
    '@google-cloud/bigquery',
    '@databricks/sql',
    '@google-cloud/dataplex',
    '@aws-sdk/client-lakeformation',
    '@aws-sdk/client-glue',
    '@aws-sdk/client-redshift-data',
    '@aws-sdk/client-athena',
    'hive-driver',
    'pg',
    'mysql2',
    'mssql',
    'oracledb',
    'mongodb',
  ],
  // Shebang is in bin/dw-claw.js — don't add it to bundle output
});
