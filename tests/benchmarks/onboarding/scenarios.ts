/**
 * Onboarding Benchmark — User Persona Scenarios
 *
 * Defines four representative user personas that exercise different
 * onboarding paths through the Data Workers project.
 *
 * Step IDs:
 *   T2 — git clone / npm pack
 *   T3 — npm install
 *   T4 — MCP client registration
 *   T5 — First tool call (in-memory)
 *   T6 — Credential setup (data-source personas only)
 *   T7 — First real query (data-source personas only)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingScenario {
  name: string;
  persona: string;
  dataSource: 'none' | 'snowflake' | 'bigquery' | 'databricks';
  mcpClient: 'claude-code' | 'cursor' | 'opencode';
  installMethod: 'npx' | 'clone';
  /** stepId → maximum allowed milliseconds */
  thresholds: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export const SCENARIOS: OnboardingScenario[] = [
  {
    name: 'npx-quickstart',
    persona: 'Quick-Start Developer via npx (no data source)',
    dataSource: 'none',
    mcpClient: 'claude-code',
    installMethod: 'npx',
    thresholds: { T_install: 10_000, T_first_tool: 2_000, T_total: 15_000 },
  },
  {
    name: 'curious-dev',
    persona: 'Curious Developer (no data source)',
    dataSource: 'none',
    mcpClient: 'claude-code',
    installMethod: 'clone',
    thresholds: { T2: 30_000, T3: 300_000, T4: 60_000, T5: 5_000 },
  },
  {
    name: 'snowflake-de',
    persona: 'Data Engineer with Snowflake',
    dataSource: 'snowflake',
    mcpClient: 'claude-code',
    installMethod: 'clone',
    thresholds: {
      T2: 30_000,
      T3: 300_000,
      T4: 60_000,
      T5: 5_000,
      T6: 300_000,
      T7: 10_000,
    },
  },
  {
    name: 'bigquery-analyst',
    persona: 'Analytics Engineer with BigQuery',
    dataSource: 'bigquery',
    mcpClient: 'cursor',
    installMethod: 'clone',
    thresholds: {
      T2: 30_000,
      T3: 300_000,
      T4: 60_000,
      T5: 5_000,
      T6: 300_000,
      T7: 10_000,
    },
  },
  {
    name: 'databricks-platform',
    persona: 'Platform Engineer with Databricks',
    dataSource: 'databricks',
    mcpClient: 'claude-code',
    installMethod: 'clone',
    thresholds: {
      T2: 30_000,
      T3: 300_000,
      T4: 60_000,
      T5: 5_000,
      T6: 300_000,
      T7: 10_000,
    },
  },
];
