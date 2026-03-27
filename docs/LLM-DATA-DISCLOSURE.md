# What Data Is Sent to Your LLM

**Document ID:** CLAW-010
**Last updated:** 2026-03-24

This document describes exactly what data the data-workers agent swarm sends to LLM providers, what it does not send, and how you can control data flow.

---

## 1. Supported LLM Providers

data-workers uses a unified `ILLMProvider` interface (`core/llm-provider/`) that supports:

| Provider | Env Variable | Data Destination |
|---|---|---|
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | Anthropic API |
| OpenAI | `OPENAI_API_KEY` | OpenAI API |
| AWS Bedrock | `AWS_BEDROCK_REGION` | Your AWS account |
| Google Vertex AI | `GOOGLE_CLOUD_PROJECT` | Your GCP project |
| Azure OpenAI | `AZURE_OPENAI_ENDPOINT` | Your Azure tenant |
| Ollama (local) | `OLLAMA_HOST` | Local machine only |

Provider selection is automatic based on which environment variable is set (checked in the order above). If none are configured, an in-memory stub is used and no data leaves the process.

## 2. What IS Sent to LLM Providers

The following data may be included in LLM requests, depending on which agent tool is invoked:

### Table and schema metadata
- Table names, column names, and column types are sent when agents need to generate SQL or understand data structure (e.g., `query_data_nl` sends schema like `revenue_daily(date, amount, product_category, region)`).
- Database and namespace identifiers may appear in pipeline generation prompts.

### Natural-language descriptions
- User-provided pipeline descriptions (e.g., "Extract daily sales from Snowflake, transform with dbt, load into BigQuery") are sent to the LLM when the local NL parser confidence falls below 0.8.
- User-provided data questions are sent to the LLM when pattern matching fails to produce SQL.

### SQL statements
- Source SQL is sent to the LLM for dialect translation (e.g., Oracle to Snowflake) when rule-based translation confidence drops below 0.7 (`translate_sql` tool).

### Error messages and diagnostics
- Error text from failed operations may be included in LLM prompts when agents request diagnostic assistance.

### Pipeline configurations (structural only)
- Orchestrator type (Airflow/Dagster/Prefect), code language, and task dependency graphs. These are structural metadata, not data contents.

## 3. What is NOT Sent

### Row-level data
Actual data values from your tables are **not** sent to LLM providers. Agents query data locally (via the in-memory relational store or your warehouse) and return results directly to you. The LLM is used only for generating or translating SQL, not for processing query results.

### Credentials and connection strings
API keys, database passwords, connection strings, and authentication tokens are never included in LLM prompts. Provider API keys are read from environment variables and used only for authenticating with that provider's API.

### Customer-specific PII
Data sent to LLM providers does not include customer-specific PII. For advanced PII detection and redaction middleware that scans and redacts sensitive data before it can reach LLM calls, see Data Workers Pro (enterprise edition).

## 4. PII Protection

To protect against accidental PII exposure in LLM prompts, consider these strategies:

- Use the self-hosted Ollama provider to keep all data on-premise (see Section 6).
- Use AWS Bedrock, Azure OpenAI, or Google Vertex AI to keep data within your cloud tenant.
- Implement custom input sanitization in your MCP client layer.

> **Note:** An advanced 3-pass PII detection and redaction middleware (regex patterns, name detection, and value validation) is available in Data Workers Pro (enterprise edition). It supports configurable redaction strategies (mask, hash, or remove) and custom regex patterns for domain-specific identifiers.

## 5. Configuration Options

### Provider selection
Set exactly one provider env variable to control where LLM requests are routed. If no variable is set, the in-memory stub handles all requests locally with no external calls.

### Cost controls
- The pipeline agent enforces a per-request budget (`LLM_BUDGET_LIMIT = $0.10`) and checks cumulative spend before making LLM calls.
- The `ModelRouter` supports `maxCostPerRequest` on routing rules to cap spend per call.
- Token usage and cost are tracked per provider and per model via `ProviderUsage`.

### LLM fallback thresholds
LLM calls are only made when local processing is insufficient:
- Pipeline NL parsing: LLM called only when parser confidence < 0.8
- SQL translation: LLM called only when rule-based confidence < 0.7
- NL-to-SQL: LLM called only when pattern matching returns no result

## 6. Self-Hosted LLM Option

To keep all data on-premise, use the Ollama provider:

```bash
# Install and start Ollama locally
ollama pull llama3

# Configure data-workers to use it
export OLLAMA_HOST=http://localhost:11434
```

With Ollama configured, all LLM requests are routed to your local machine. No data leaves your network. The Ollama provider supports models including `llama3`, `mistral`, and `codellama`, with zero API cost.

For AWS-hosted deployments, AWS Bedrock keeps data within your AWS account and VPC. Similarly, Azure OpenAI and Google Vertex AI keep data within your respective cloud tenants.

## 7. Provider Data Policies

Review your chosen provider's data handling policies:

| Provider | Data Policy |
|---|---|
| Anthropic | [Usage Policy](https://www.anthropic.com/policies/usage-policy) — API inputs are not used for training |
| OpenAI | [API Data Usage](https://openai.com/enterprise-privacy/) — API data not used for training by default |
| AWS Bedrock | [Data Protection](https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html) — data stays in your AWS account |
| Google Vertex AI | [Data Governance](https://cloud.google.com/vertex-ai/docs/generative-ai/data-governance) — data stays in your GCP project |
| Azure OpenAI | [Data Privacy](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/data-privacy) — data stays in your Azure tenant |
| Ollama | Fully local — no data leaves your machine |

---

**Summary:** data-workers sends structural metadata (schema names, SQL text, NL descriptions) to your configured LLM provider only when local processing is insufficient. It never sends row-level data or credentials. You can eliminate all external data transmission by using Ollama or by not setting any provider API key.
