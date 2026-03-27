/**
 * Persona Scenarios -- Barrel Export
 *
 * Combines all persona scenarios across 8 personas + multi-step + negative tests.
 */

export { dataEngineerScenarios } from './data-engineer.js';
export { analyticsEngineerScenarios } from './analytics-engineer.js';
export { dataPlatformLeadScenarios } from './data-platform-lead.js';
export { dataScientistScenarios } from './data-scientist.js';
export { mlEngineerScenarios } from './ml-engineer.js';
export { openclawUserScenarios } from './openclaw-user.js';
export { governanceOfficerScenarios } from './governance-officer.js';
export { dataPractitionerScenarios } from './data-practitioner.js';
export { multiStepScenarios } from './multi-step.js';
export { negativeTestScenarios } from './negative-tests.js';

import { dataEngineerScenarios } from './data-engineer.js';
import { analyticsEngineerScenarios } from './analytics-engineer.js';
import { dataPlatformLeadScenarios } from './data-platform-lead.js';
import { dataScientistScenarios } from './data-scientist.js';
import { mlEngineerScenarios } from './ml-engineer.js';
import { openclawUserScenarios } from './openclaw-user.js';
import { governanceOfficerScenarios } from './governance-officer.js';
import { dataPractitionerScenarios } from './data-practitioner.js';
import { multiStepScenarios } from './multi-step.js';
import { negativeTestScenarios } from './negative-tests.js';
import type { PersonaScenario } from '../types.js';

/** All persona scenarios in a single array. */
export const allPersonaScenarios: PersonaScenario[] = [
  ...dataEngineerScenarios,
  ...analyticsEngineerScenarios,
  ...dataPlatformLeadScenarios,
  ...dataScientistScenarios,
  ...mlEngineerScenarios,
  ...openclawUserScenarios,
  ...governanceOfficerScenarios,
  ...dataPractitionerScenarios,
  ...multiStepScenarios,
  ...negativeTestScenarios,
];
