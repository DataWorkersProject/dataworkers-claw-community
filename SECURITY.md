# Security Policy

The Data Workers team takes security seriously. We appreciate your efforts to responsibly disclose vulnerabilities and will make every effort to acknowledge your contributions.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: (current pre-release) |

Once Data Workers reaches 1.0, this table will be updated to reflect the long-term support policy.

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities by emailing **[security@dataworkers.io](mailto:security@dataworkers.io)**.

Include as much of the following as possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- The version(s) affected
- Any suggested remediation

### What to Expect

| Step                  | Timeline      |
| --------------------- | ------------- |
| Acknowledgment        | 48 hours      |
| Initial assessment    | 7 days        |
| Fix development       | Depends on severity |
| Public disclosure     | Coordinated with reporter |

### Credit

We believe in recognizing the security community. With your consent, we will acknowledge reporters in the relevant release notes. If you prefer to remain anonymous, we will respect that.

## Security Model

Data Workers is an autonomous agent swarm for data engineering. The following security modules are available as opt-in components. They exist as standalone modules in the codebase but are **not active by default** -- each must be explicitly configured and integrated into your deployment.

### Multi-Tenant Isolation

A `customerId` scoping mechanism is available as an opt-in module. When enabled, agents, pipelines, and data artifacts are isolated per tenant. **Note:** This is not enforced by default and must be explicitly configured in your deployment.

### PII Middleware

A PII detection and masking module is available that can scan data flowing through agents. It supports regex-based, value-based, and LLM-assisted detection of sensitive fields (emails, SSNs, phone numbers, etc.). **Note:** This module must be explicitly enabled and configured -- it does not automatically intercept all data flows out of the box.

### Role-Based Access Control (RBAC)

The governance agent includes a policy engine capable of enforcing RBAC policies. **Note:** This is available as an opt-in module. By default, no access control is enforced on agent operations.

### Audit Trail

An audit logging module using SHA-256 hash-chain records is available for tracking agent actions with full context (actor, action, resource, timestamp). **Note:** This is available as an opt-in module and must be explicitly wired into your deployment to capture events.

### Safe Development Defaults

InMemory stubs are used by default for all infrastructure interfaces (key-value store, message queue, graph database, etc.). Real infrastructure (Redis, Kafka, PostgreSQL, etc.) is only activated when explicit environment variables are configured. This ensures developers never accidentally connect to production systems.

## Dependency Security

- **npm audit**: We run `npm audit` as part of CI and address critical/high vulnerabilities before releases.
- **Snyk**: Integration with Snyk for continuous dependency monitoring is planned.
- **Lock files**: `package-lock.json` is committed and used for deterministic installs.

We encourage users to run `npm audit` in their own deployments and report any findings that may affect Data Workers specifically.

## Data Handling

### What Data Agents Process

Data Workers agents operate on metadata and data from your configured sources (Snowflake, BigQuery, Databricks, PostgreSQL, and others). The agents read schemas, profile data quality, manage pipelines, and generate insights.

### LLM Provider Disclosure

When LLM-powered features are enabled, the following data may be sent to your configured LLM provider (Anthropic, OpenAI, Azure OpenAI, AWS Bedrock, Google Vertex, or Ollama):

- Table and column names (schema metadata)
- Data quality summaries and aggregated statistics
- Agent reasoning context and tool call parameters
- Error messages for diagnostic purposes

**Raw row-level data is not sent to LLM providers by default.** The PII middleware provides an additional layer of protection by masking sensitive fields before they reach any external service.

Users are responsible for reviewing their LLM provider's data handling policies and ensuring compliance with their organization's requirements.

## Known Limitations

- **Pre-release software**: Data Workers is in 0.x pre-release. APIs, security controls, and default behaviors may change between versions.
- **InMemory stubs are not production-grade**: The default InMemory implementations are designed for development and testing. They do not provide durability, encryption at rest, or access controls. Always configure real infrastructure for production deployments.
- **Connector credentials**: Data Workers does not manage secrets for external systems (Snowflake, BigQuery, etc.). Users must secure these credentials using their own secrets management solution (e.g., HashiCorp Vault, AWS Secrets Manager, environment variable encryption).
- **Network security**: Data Workers does not enforce TLS or network-level controls. Deployments should use standard infrastructure practices (TLS termination, network policies, firewall rules).

## Contact

For security-related questions that are not vulnerability reports, you can reach the team at [security@dataworkers.io](mailto:security@dataworkers.io).
