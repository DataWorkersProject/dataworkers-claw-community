/**
 * Pipeline-related evaluation scenarios.
 */
import type { EvalScenario } from '../llm-eval-framework.js';

export const pipelineScenarios: EvalScenario[] = [
  {
    name: 'parse simple ETL pipeline',
    category: 'pipeline',
    input: 'parse pipeline description: daily ETL from Snowflake orders to BigQuery',
    expectedOutput: /pipelineName/,
    agent: 'dw-pipelines',
    difficulty: 'easy',
  },
  {
    name: 'parse pipeline with schedule',
    category: 'pipeline',
    input: 'parse the following pipeline: hourly sync of customer data from PostgreSQL to Snowflake',
    expectedOutput: /schedule|frequency/i,
    agent: 'dw-pipelines',
    difficulty: 'medium',
  },
  {
    name: 'parse streaming pipeline',
    category: 'pipeline',
    input: 'parse pipeline: real-time event stream from Kafka to S3 with Avro encoding',
    expectedOutput: /pipelineName/,
    agent: 'dw-pipelines',
    difficulty: 'hard',
  },
  {
    name: 'generate pipeline code',
    category: 'pipeline',
    input: 'generate SQL pipeline code for loading orders data',
    expectedOutput: /SELECT/i,
    agent: 'dw-pipelines',
    difficulty: 'easy',
  },
  {
    name: 'pipeline with quality checks',
    category: 'pipeline',
    input: 'parse pipeline description: ETL with schema validation and row count checks',
    expectedOutput: /qualityChecks/,
    agent: 'dw-pipelines',
    difficulty: 'medium',
  },
];
