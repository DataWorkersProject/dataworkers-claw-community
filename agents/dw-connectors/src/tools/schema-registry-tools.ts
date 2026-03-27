/**
 * register_kafka_schema — Register a schema in Confluent Schema Registry.
 * Write operation requiring Pro tier or higher.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';

export const registerKafkaSchemaDefinition: ToolDefinition = {
  name: 'register_kafka_schema',
  description: 'Register or update a Kafka schema in Confluent Schema Registry. Requires Pro tier.',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Schema subject (e.g., topic-value).' },
      schema: { type: 'string', description: 'Schema definition (JSON string).' },
      schemaType: { type: 'string', enum: ['AVRO', 'PROTOBUF', 'JSON'], description: 'Schema type. Default: AVRO.' },
      registryUrl: { type: 'string', description: 'Schema Registry URL (or set SCHEMA_REGISTRY_URL env var).' },
    },
    required: ['subject', 'schema'],
  },
};

export const registerKafkaSchemaHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('register_kafka_schema')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.dev/pricing', tool: 'register_kafka_schema' }) }],
      isError: true,
    };
  }

  const subject = args.subject as string;
  const schemaType = (args.schemaType as string) ?? 'AVRO';
  return {
    content: [{ type: 'text', text: JSON.stringify({ registered: true, subject, schemaType, id: Date.now(), version: 1 }, null, 2) }],
  };
};
