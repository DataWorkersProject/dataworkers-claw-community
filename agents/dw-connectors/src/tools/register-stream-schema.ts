/**
 * register_stream_schema — Register or update a schema in Confluent Schema Registry.
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import { isToolAllowed } from '@data-workers/license';

export const registerStreamSchemaDefinition: ToolDefinition = {
  name: 'register_stream_schema',
  description: 'Register or update a schema in Confluent Schema Registry for a Kafka topic.',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Schema subject (typically topic-value or topic-key).' },
      schema: { type: 'string', description: 'Schema definition (Avro JSON string).' },
      registryUrl: { type: 'string', description: 'Schema Registry URL. Defaults to SCHEMA_REGISTRY_URL env var.' },
      schemaType: { type: 'string', enum: ['AVRO', 'PROTOBUF', 'JSON'], description: 'Schema type. Default: AVRO.' },
    },
    required: ['subject', 'schema'],
  },
};

export const registerStreamSchemaHandler: ToolHandler = async (args) => {
  if (!isToolAllowed('register_stream_schema')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'pro_feature', message: 'This feature requires Data Workers Pro. Visit https://dataworkers.io/pricing', tool: 'register_stream_schema' }) }],
      isError: true,
    };
  }

  const subject = args.subject as string;
  const schema = args.schema as string;
  const registryUrl = (args.registryUrl as string) ?? process.env.SCHEMA_REGISTRY_URL;
  const schemaType = (args.schemaType as string) ?? 'AVRO';

  if (!registryUrl) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        subject, registered: false, error: 'No SCHEMA_REGISTRY_URL configured.',
        stubFallback: true,
      }, null, 2) }],
    };
  }

  try {
    const res = await fetch(`${registryUrl}/subjects/${subject}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.schemaregistry.v1+json' },
      body: JSON.stringify({ schema, schemaType }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { content: [{ type: 'text', text: JSON.stringify({ subject, registered: true, ...data }, null, 2) }] };
  } catch (e) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        subject, registered: false, error: e instanceof Error ? e.message : String(e),
      }, null, 2) }],
    };
  }
};
