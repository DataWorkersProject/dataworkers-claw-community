/**
 * Persona-based AI Eval Benchmark -- Scenario Barrel
 *
 * Re-exports the full set of persona scenarios from the per-persona
 * definition files in ./personas/.
 */

export { allPersonaScenarios as SCENARIOS } from './personas/index.js';

// Also re-export per-persona collections for targeted runs
export {
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
} from './personas/index.js';
