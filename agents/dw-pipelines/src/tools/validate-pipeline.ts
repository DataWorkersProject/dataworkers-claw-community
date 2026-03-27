import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { ValidatePipelineInput } from '../types.js';
import { PipelineValidator } from '../validation/pipeline-validator.js';

export const validatePipelineDefinition: ToolDefinition = {
  name: 'validate_pipeline',
  description: 'Validate a pipeline specification. Runs syntax checks on all generated code (SQL, Python, YAML), semantic layer validation when available, and optional sandbox execution against production data samples.',
  inputSchema: {
    type: 'object',
    properties: {
      pipelineSpec: {
        type: 'object',
        description: 'The pipeline specification to validate.',
      },
      customerId: {
        type: 'string',
        description: 'Customer ID for tenant context.',
      },
      validateSemanticLayer: {
        type: 'boolean',
        description: 'Whether to validate against the semantic layer. Defaults to true.',
      },
      sandboxExecution: {
        type: 'boolean',
        description: 'Whether to run in sandbox. Defaults to true.',
      },
    },
    required: ['pipelineSpec', 'customerId'],
  },
};

const validator = new PipelineValidator();

/**
 * Pipeline validation handler.
 * Implements REQ-PIPE-005: sandbox validation + semantic layer check.
 * Delegates to PipelineValidator for multi-gate validation.
 */
export const validatePipelineHandler: ToolHandler = async (args) => {
  const input = args as unknown as ValidatePipelineInput;

  const report = await validator.validate(input.pipelineSpec, {
    validateSemanticLayer: input.validateSemanticLayer,
    sandboxExecution: input.sandboxExecution,
    customerId: input.customerId,
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
  };
};
