/**
 * Onboarding Benchmark — Main Runner
 *
 * Simulates the end-to-end onboarding journey for each persona scenario.
 * Measures real wall-clock time for clone, install, registration, and
 * first tool call steps.
 *
 * Usage:
 *   npx vitest run tests/benchmarks/onboarding/benchmark-onboarding.ts
 *
 * Or directly:
 *   npx tsx tests/benchmarks/onboarding/benchmark-onboarding.ts
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { StepTimer } from './timers.js';
import type { TimingResult } from './timers.js';
import { SCENARIOS } from './scenarios.js';
import type { OnboardingScenario } from './scenarios.js';
import { report } from './report.js';
import type { ScenarioResults } from './report.js';
import { scorePainPoints, painPointMarkdown } from './pain-points.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const REPO_URL =
  'https://github.com/DataWorkersProject/dataworkers-claw-community.git';

// ---------------------------------------------------------------------------
// Step implementations
// ---------------------------------------------------------------------------

function runT2_Clone(
  scenario: OnboardingScenario,
  timer: StepTimer,
): { result: TimingResult; cloneDir: string } {
  const cloneDir = mkdtempSync(join(tmpdir(), `dw-bench-${scenario.name}-`));
  try {
    if (scenario.installMethod === 'clone') {
      timer.begin();
      execSync(`git clone --depth 1 ${REPO_URL} "${cloneDir}/data-workers"`, {
        stdio: 'pipe',
        timeout: scenario.thresholds.T2 * 2,
      });
      const result = timer.end('T2', 'git clone (shallow)', scenario.thresholds.T2);
      return { result, cloneDir: join(cloneDir, 'data-workers') };
    } else {
      // npx path: pack the local project
      timer.begin();
      execSync(`npm pack --pack-destination "${cloneDir}"`, {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
        timeout: scenario.thresholds.T2 * 2,
      });
      const result = timer.end('T2', 'npm pack', scenario.thresholds.T2);
      return { result, cloneDir };
    }
  } catch (err) {
    return {
      result: StepTimer.error('T2', 'git clone / npm pack', err),
      cloneDir,
    };
  }
}

function runT3_Install(
  cloneDir: string,
  threshold: number,
  timer: StepTimer,
): TimingResult {
  try {
    timer.begin();
    execSync('npm install --ignore-scripts', {
      cwd: cloneDir,
      stdio: 'pipe',
      timeout: threshold * 2,
    });
    return timer.end('T3', 'npm install', threshold);
  } catch (err) {
    return StepTimer.error('T3', 'npm install', err);
  }
}

function runT4_McpRegistration(
  scenario: OnboardingScenario,
  cloneDir: string,
  threshold: number,
  timer: StepTimer,
): TimingResult {
  try {
    timer.begin();

    // Simulate generating the MCP client configuration file
    const mcpConfig: Record<string, unknown> = {
      mcpServers: {
        'data-workers-catalog': {
          command: 'node',
          args: [join(cloneDir, 'agents', 'dw-context-catalog', 'dist', 'index.js')],
          env: { DW_STDIO: '1' },
        },
        'data-workers-connectors': {
          command: 'node',
          args: [join(cloneDir, 'agents', 'dw-connectors', 'dist', 'index.js')],
          env: { DW_STDIO: '1' },
        },
      },
    };

    const configFileName =
      scenario.mcpClient === 'cursor' ? '.cursor/mcp.json' : '.mcp.json';
    const configPath = join(cloneDir, configFileName);

    // Ensure directory exists for cursor config
    if (scenario.mcpClient === 'cursor') {
      execSync(`mkdir -p "${join(cloneDir, '.cursor')}"`, { stdio: 'pipe' });
    }

    writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2) + '\n');
    return timer.end('T4', `MCP registration (${scenario.mcpClient})`, threshold);
  } catch (err) {
    return StepTimer.error('T4', 'MCP registration', err);
  }
}

async function runT5_FirstToolCall(
  threshold: number,
  timer: StepTimer,
): Promise<TimingResult> {
  try {
    timer.begin();

    // Import the catalog agent server and make a simple tool call
    // Uses the in-memory stubs — no external services needed.
    const { server } = await import(
      join(PROJECT_ROOT, 'agents', 'dw-context-catalog', 'src', 'index.js')
    );

    const result = await server.callTool('list_catalogs', {});
    if (!result) throw new Error('list_catalogs returned no result');

    return timer.end('T5', 'First tool call (list_catalogs)', threshold);
  } catch (err) {
    return StepTimer.error('T5', 'First tool call', err);
  }
}

function runT6_CredentialSetup(
  scenario: OnboardingScenario,
  cloneDir: string,
  threshold: number,
  timer: StepTimer,
): TimingResult {
  if (scenario.dataSource === 'none') {
    return StepTimer.skip('T6', 'Credential setup (skipped — no data source)');
  }

  try {
    timer.begin();

    // Simulate writing a .env file with data-source-specific credentials
    const envVars: Record<string, string> = {};

    switch (scenario.dataSource) {
      case 'snowflake':
        envVars.SNOWFLAKE_ACCOUNT = 'test-account.us-east-1';
        envVars.SNOWFLAKE_USERNAME = 'benchmark_user';
        envVars.SNOWFLAKE_PASSWORD = 'benchmark_pass';
        envVars.SNOWFLAKE_WAREHOUSE = 'COMPUTE_WH';
        envVars.SNOWFLAKE_DATABASE = 'BENCHMARK_DB';
        break;
      case 'bigquery':
        envVars.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/service-account.json';
        envVars.GOOGLE_CLOUD_PROJECT = 'benchmark-project';
        envVars.BIGQUERY_DATASET = 'benchmark_dataset';
        break;
      case 'databricks':
        envVars.DATABRICKS_HOST = 'https://test.cloud.databricks.com';
        envVars.DATABRICKS_TOKEN = 'dapi_benchmark_token';
        envVars.DATABRICKS_CATALOG = 'benchmark_catalog';
        break;
    }

    const envContent = Object.entries(envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    writeFileSync(join(cloneDir, '.env'), envContent + '\n');

    return timer.end(
      'T6',
      `Credential setup (${scenario.dataSource})`,
      threshold,
    );
  } catch (err) {
    return StepTimer.error('T6', 'Credential setup', err);
  }
}

async function runT7_FirstRealQuery(
  scenario: OnboardingScenario,
  threshold: number,
  timer: StepTimer,
): Promise<TimingResult> {
  if (scenario.dataSource === 'none') {
    return StepTimer.skip('T7', 'First real query (skipped — no data source)');
  }

  try {
    timer.begin();

    // Import the connectors agent and attempt a tool call.
    // In benchmark mode this uses InMemory stubs (no real credentials),
    // so we're measuring import + initialization + tool dispatch overhead.
    const { server } = await import(
      join(PROJECT_ROOT, 'agents', 'dw-connectors', 'src', 'index.js')
    );

    const toolName = `${scenario.dataSource}_list_tables`;
    const result = await server.callTool(toolName, {
      database: 'benchmark_db',
      schema: 'public',
    });
    if (!result) throw new Error(`${toolName} returned no result`);

    return timer.end(
      'T7',
      `First real query (${scenario.dataSource}_list_tables)`,
      threshold,
    );
  } catch (err) {
    return StepTimer.error('T7', 'First real query', err);
  }
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}

// ---------------------------------------------------------------------------
// npx scenario runner
// ---------------------------------------------------------------------------

/**
 * Runs the npx-quickstart scenario which measures:
 *   T_install   — cold `npx dw-claw` install time
 *   T_first_tool — time from process start to first tool response
 *   T_total     — end-to-end wall clock from npx invocation to tool result
 *
 * In CI / benchmark mode we simulate this by packing the local project
 * and installing it into a temp directory, then importing the agent and
 * making a single tool call.
 */
async function runNpxScenario(
  scenario: OnboardingScenario,
): Promise<{ steps: TimingResult[]; cloneDir: string }> {
  const timer = new StepTimer();
  const steps: TimingResult[] = [];

  const tmpBase = mkdtempSync(join(tmpdir(), `dw-bench-${scenario.name}-`));
  const installDir = join(tmpBase, 'npx-test');
  execSync(`mkdir -p "${installDir}"`, { stdio: 'pipe' });

  // T_install: pack + install the package into a fresh directory
  try {
    timer.begin();

    // Pack the local project to a tarball
    const packOutput = execSync('npm pack --pack-destination /tmp 2>/dev/null', {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      timeout: (scenario.thresholds.T_install ?? 60_000) * 3,
    })
      .toString()
      .trim();
    const tarball = join('/tmp', packOutput.split('\n').pop()!.trim());

    // Initialize a minimal package.json and install the tarball
    writeFileSync(
      join(installDir, 'package.json'),
      JSON.stringify({ name: 'npx-bench', version: '0.0.0', private: true }),
    );
    execSync(`npm install "${tarball}" --ignore-scripts`, {
      cwd: installDir,
      stdio: 'pipe',
      timeout: (scenario.thresholds.T_install ?? 60_000) * 3,
    });

    const installResult = timer.end(
      'T_install',
      'npx cold install',
      scenario.thresholds.T_install ?? 10_000,
    );
    steps.push(installResult);
    console.log(`  T_install ${installResult.status}: ${installResult.durationMs}ms`);
  } catch (err) {
    const errResult = StepTimer.error('T_install', 'npx cold install', err);
    steps.push(errResult);
    console.log(`  T_install ${errResult.status}: ${(err as Error).message}`);
  }

  // T_first_tool: import the agent and make a tool call
  try {
    timer.begin();

    // Use the local project source directly (same as T5) to measure
    // agent import + init + first tool call latency
    const { server } = await import(
      join(PROJECT_ROOT, 'agents', 'dw-context-catalog', 'src', 'index.js')
    );
    const result = await server.callTool('list_catalogs', {});
    if (!result) throw new Error('list_catalogs returned no result');

    const toolResult = timer.end(
      'T_first_tool',
      'First tool call (list_catalogs)',
      scenario.thresholds.T_first_tool ?? 2_000,
    );
    steps.push(toolResult);
    console.log(`  T_first_tool ${toolResult.status}: ${toolResult.durationMs}ms`);
  } catch (err) {
    const errResult = StepTimer.error('T_first_tool', 'First tool call', err);
    steps.push(errResult);
    console.log(`  T_first_tool ${errResult.status}: ${(err as Error).message}`);
  }

  // T_total: sum of install + first tool, compared against total threshold
  const totalMs = steps.reduce((sum, s) => sum + s.durationMs, 0);
  const totalThreshold = scenario.thresholds.T_total ?? 15_000;
  const totalResult: TimingResult = {
    stepId: 'T_total',
    stepName: 'Total npx onboarding time',
    durationMs: totalMs,
    status: totalMs <= totalThreshold ? 'pass' : 'fail',
  };
  steps.push(totalResult);
  console.log(`  T_total ${totalResult.status}: ${totalResult.durationMs}ms`);

  return { steps, cloneDir: tmpBase };
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

export async function runOnboardingBenchmark(
  scenarioFilter?: string[],
): Promise<{ results: ScenarioResults[]; exitCode: number }> {
  const selected = scenarioFilter
    ? SCENARIOS.filter((s) => scenarioFilter.includes(s.name))
    : SCENARIOS;

  const allResults: ScenarioResults[] = [];
  let anyFail = false;

  for (const scenario of selected) {
    console.log(`\n--- Scenario: ${scenario.persona} (${scenario.name}) ---\n`);

    // npx scenarios use a dedicated runner with different step IDs
    if (scenario.installMethod === 'npx') {
      const { steps, cloneDir } = await runNpxScenario(scenario);

      if (steps.some((s) => s.status === 'fail')) {
        anyFail = true;
      }

      allResults.push({
        scenarioName: scenario.name,
        persona: scenario.persona,
        steps,
      });

      if (cloneDir) cleanupDir(cloneDir);
      continue;
    }

    // Clone-based scenarios (original flow)
    const timer = new StepTimer();
    const steps: TimingResult[] = [];
    let cloneDir = '';

    // T2: Clone / Pack
    const t2 = runT2_Clone(scenario, timer);
    steps.push(t2.result);
    cloneDir = t2.cloneDir;
    console.log(`  T2 ${t2.result.status}: ${t2.result.durationMs}ms`);

    // T3: npm install (only if clone succeeded)
    if (t2.result.status !== 'fail' && scenario.thresholds.T3) {
      const t3 = runT3_Install(cloneDir, scenario.thresholds.T3, timer);
      steps.push(t3);
      console.log(`  T3 ${t3.status}: ${t3.durationMs}ms`);
    }

    // T4: MCP registration
    if (scenario.thresholds.T4) {
      const t4 = runT4_McpRegistration(scenario, cloneDir, scenario.thresholds.T4, timer);
      steps.push(t4);
      console.log(`  T4 ${t4.status}: ${t4.durationMs}ms`);
    }

    // T5: First tool call
    if (scenario.thresholds.T5) {
      const t5 = await runT5_FirstToolCall(scenario.thresholds.T5, timer);
      steps.push(t5);
      console.log(`  T5 ${t5.status}: ${t5.durationMs}ms`);
    }

    // T6: Credential setup
    if (scenario.thresholds.T6) {
      const t6 = runT6_CredentialSetup(
        scenario,
        cloneDir,
        scenario.thresholds.T6,
        timer,
      );
      steps.push(t6);
      console.log(`  T6 ${t6.status}: ${t6.durationMs}ms`);
    }

    // T7: First real query
    if (scenario.thresholds.T7) {
      const t7 = await runT7_FirstRealQuery(
        scenario,
        scenario.thresholds.T7,
        timer,
      );
      steps.push(t7);
      console.log(`  T7 ${t7.status}: ${t7.durationMs}ms`);
    }

    // Check for failures
    if (steps.some((s) => s.status === 'fail')) {
      anyFail = true;
    }

    allResults.push({
      scenarioName: scenario.name,
      persona: scenario.persona,
      steps,
    });

    // Cleanup temp directory
    if (cloneDir) cleanupDir(cloneDir);
  }

  // Generate reports
  console.log('\n');
  const md = report(allResults);

  // Pain point analysis
  console.log('\n## Pain Point Analysis\n');
  for (const r of allResults) {
    const scores = scorePainPoints(r.steps);
    if (scores.length > 0) {
      console.log(`### ${r.persona}\n`);
      console.log(painPointMarkdown(scores));
      console.log('');
    }
  }

  return { results: allResults, exitCode: anyFail ? 1 : 0 };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isCLI =
  process.argv[1] &&
  (process.argv[1].includes('benchmark-onboarding') ||
    process.argv[1].includes('tsx'));

if (isCLI) {
  const filter = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  runOnboardingBenchmark(filter.length > 0 ? filter : undefined).then(
    ({ exitCode }) => {
      process.exit(exitCode);
    },
  );
}
