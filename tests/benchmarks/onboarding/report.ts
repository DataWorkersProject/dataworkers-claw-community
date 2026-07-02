/**
 * Onboarding Benchmark — Report Generator
 *
 * Produces markdown tables (stdout) and persists results as JSON.
 * When a baseline file exists, the report includes a delta column
 * so regressions are immediately visible.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TimingResult } from './timers.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = resolve(__dirname, 'baseline.json');
const RESULTS_PATH = resolve(__dirname, 'latest-results.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScenarioResults {
  scenarioName: string;
  persona: string;
  steps: TimingResult[];
}

interface BaselineEntry {
  durationMs: number;
  status: string;
}

interface BaselineFile {
  timestamp: string;
  label: string;
  scenarios: Record<string, Record<string, BaselineEntry>>;
}

interface ResultsFile {
  timestamp: string;
  label: string;
  scenarios: Record<string, Record<string, { durationMs: number; status: string }>>;
}

// ---------------------------------------------------------------------------
// Baseline I/O
// ---------------------------------------------------------------------------

function loadBaseline(): BaselineFile | null {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as BaselineFile;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 1_000).toFixed(0)}s`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

function deltaStr(current: number, baseline: number | undefined): string {
  if (baseline === undefined) return '—';
  const diff = current - baseline;
  const pct = baseline > 0 ? ((diff / baseline) * 100).toFixed(0) : '∞';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${formatMs(diff)} (${sign}${pct}%)`;
}

function statusIcon(status: string): string {
  if (status === 'pass') return 'PASS';
  if (status === 'skip') return 'SKIP';
  return 'FAIL';
}

export function generateMarkdown(results: ScenarioResults[]): string {
  const baseline = loadBaseline();
  const lines: string[] = [];

  lines.push('# Onboarding Benchmark Results');
  lines.push('');
  lines.push(`Run: ${new Date().toISOString()}`);
  lines.push('');

  for (const scenario of results) {
    lines.push(`## ${scenario.persona} (\`${scenario.scenarioName}\`)`);
    lines.push('');

    const hasBaseline = baseline?.scenarios[scenario.scenarioName] != null;
    if (hasBaseline) {
      lines.push(
        '| Step | Name | Duration | Status | Baseline | Delta |',
      );
      lines.push(
        '|------|------|----------|--------|----------|-------|',
      );
    } else {
      lines.push('| Step | Name | Duration | Status |');
      lines.push('|------|------|----------|--------|');
    }

    for (const step of scenario.steps) {
      const base = baseline?.scenarios[scenario.scenarioName]?.[step.stepId];
      const row = [
        step.stepId,
        step.stepName,
        step.status === 'skip' ? '—' : formatMs(step.durationMs),
        statusIcon(step.status),
      ];
      if (hasBaseline) {
        row.push(base ? formatMs(base.durationMs) : '—');
        row.push(
          step.status === 'skip'
            ? '—'
            : deltaStr(step.durationMs, base?.durationMs),
        );
      }
      lines.push(`| ${row.join(' | ')} |`);
    }

    lines.push('');
  }

  // Summary
  const totalSteps = results.reduce((n, s) => n + s.steps.length, 0);
  const passed = results.reduce(
    (n, s) => n + s.steps.filter((st) => st.status === 'pass').length,
    0,
  );
  const failed = results.reduce(
    (n, s) => n + s.steps.filter((st) => st.status === 'fail').length,
    0,
  );
  const skipped = results.reduce(
    (n, s) => n + s.steps.filter((st) => st.status === 'skip').length,
    0,
  );

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total steps:** ${totalSteps}`);
  lines.push(`- **Passed:** ${passed}`);
  lines.push(`- **Failed:** ${failed}`);
  lines.push(`- **Skipped:** ${skipped}`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// JSON persistence
// ---------------------------------------------------------------------------

export function writeResults(results: ScenarioResults[]): void {
  const output: ResultsFile = {
    timestamp: new Date().toISOString(),
    label: 'latest',
    scenarios: {},
  };

  for (const scenario of results) {
    const steps: Record<string, { durationMs: number; status: string }> = {};
    for (const step of scenario.steps) {
      steps[step.stepId] = {
        durationMs: step.durationMs,
        status: step.status,
      };
    }
    output.scenarios[scenario.scenarioName] = steps;
  }

  writeFileSync(RESULTS_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate reports: write JSON to disk and return markdown string.
 */
export function report(results: ScenarioResults[]): string {
  writeResults(results);
  const md = generateMarkdown(results);
  console.log(md);
  return md;
}
