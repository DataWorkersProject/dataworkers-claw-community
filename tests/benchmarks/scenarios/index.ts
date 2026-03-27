/**
 * Benchmark Scenarios — Index
 *
 * Aggregates all per-agent scenarios into a single exportable list.
 * To add scenarios for a new agent, create a file in this directory
 * and add its export here.
 */

import { catalogScenarios } from './dw-context-catalog.js';
import { pipelinesScenarios } from './dw-pipelines.js';
import { qualityScenarios } from './dw-quality.js';
import { governanceScenarios } from './dw-governance.js';
import { incidentsScenarios } from './dw-incidents.js';

import type { BenchmarkScenario } from '../types.js';

export const allScenarios: BenchmarkScenario[] = [
  ...catalogScenarios,
  ...pipelinesScenarios,
  ...qualityScenarios,
  ...governanceScenarios,
  ...incidentsScenarios,
];

// Re-export per-agent arrays for selective runs
export {
  catalogScenarios,
  pipelinesScenarios,
  qualityScenarios,
  governanceScenarios,
  incidentsScenarios,
};
