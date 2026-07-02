# Data Workers — Agent Instructions

This file is read as project memory by Codex CLI, OpenCode, Gemini CLI, and other
AGENTS.md-aware coding agents.

## What this repository is

Data Workers Community Edition: an open-source (Apache-2.0) swarm of autonomous AI
agents for data engineering. Each agent is an MCP server; the `dw-claw` package also
serves every Community Edition tool through one unified MCP server:

```bash
npx -y dw-claw            # unified MCP server on stdio (160+ tools)
npx dw-claw init          # auto-detect your MCP client and write its config
npx dw-claw setup         # connect Snowflake / BigQuery / Databricks credentials
```

Pre-wired client configs ship in this repo: `.mcp.json` (Claude Code),
`opencode.json` (OpenCode), `.codex/config.toml` (Codex CLI — loads once you trust
the project). Everything runs locally with in-memory seed data until you connect a
real data source, so it is safe to explore.

## The agents

- **dw-pipelines** — NL-to-pipeline generation, validation, deployment
- **dw-incidents** — anomaly detection, root-cause analysis, remediation
- **dw-context-catalog** — cross-catalog search, lineage, classification
- **dw-quality** — profiling, quality scoring, anomaly detection
- **dw-schema** — schema diffing, evolution, snapshots, compatibility
- **dw-governance** — compliance checks, classification, policy enforcement
- **dw-observability** — metrics, SLA monitoring, pipeline tracing
- **dw-connectors** — catalog and warehouse connector management
- **dw-usage-intelligence** — usage analysis, query tracking, index recommendations
- **dw-ml** — model registry, feature pipelines, drift detection

## Working in this codebase

- TypeScript, npm workspaces (`agents/*`, `core/*`, `connectors/*`, `packages/*`).
- Build: `npm run build` · Typecheck: `npm run typecheck` · Tests: `npx vitest run <path>`.
- Node 20+.
- Data is in-memory-stubbed by default (`core/infrastructure-stubs`); real warehouse
  clients live in `connectors/*` behind env-var credentials. Never commit credentials
  — CI runs secret-leak and enterprise-leak scans on every PR.
- The Pro-tier agents (dw-cost, dw-migration, dw-insights, dw-streaming) are NOT part
  of this repository; do not add imports or references to them.

## Working with your data (as an agent using these tools)

1. Start with discovery: catalog search and lineage tools first.
2. Chain across agents: search catalog → check quality → propose schema changes.
3. Surface quality or cost issues proactively, and explain trade-offs when
   recommending changes.
