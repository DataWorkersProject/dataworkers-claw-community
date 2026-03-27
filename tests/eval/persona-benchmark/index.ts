/**
 * Persona-based AI Eval Benchmark -- Public API
 */

export type {
  Persona,
  SeedDataset,
  ToolRoute,
  MultiStepRoute,
  DynamicInput,
  ExpectedResponse,
  PersonaScenario,
  PersonaScore,
  PersonaResult,
  PersonaReport,
} from './types.js';

export { SEED_ENTITIES, getAllEntityNames, isKnownEntity } from './seed-configs.js';

export {
  SCENARIOS,
  dataEngineerScenarios,
  analyticsEngineerScenarios,
  dataPlatformLeadScenarios,
  dataScientistScenarios,
  mlEngineerScenarios,
  openclawUserScenarios,
  governanceOfficerScenarios,
  dataPractitionerScenarios,
  multiStepScenarios,
  negativeTestScenarios,
} from './scenarios.js';

export {
  scoreCompleteness,
  scoreFactualGrounding,
  scoreActionability,
  scoreSeedSpecificity,
  scoreNegativeHandling,
  scoreResponseStructure,
  scoreLatencyCompliance,
  jaccardSimilarity,
  computeComposite,
  getDifficultyWeight,
} from './scoring.js';

export { runPersonaBenchmark, getDefaultServers } from './runner.js';
export { generatePersonaReport, buildPersonaReport } from './report.js';
