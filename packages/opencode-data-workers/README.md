# opencode-data-workers

OpenCode plugin for [Data Workers](https://github.com/DhanushAShetty/dw-claw-community) — 11 autonomous AI agents for data engineering.

## Install

Add to your `opencode.json`:

```json
{
  "plugins": ["opencode-data-workers"]
}
```

This registers the top 3 Data Workers agents (catalog, quality, pipelines) by default.

## Enable All Agents

To enable all 11 agents (160+ tools), set each agent's `enabled` field to `true` in your `opencode.json` MCP config, or use:

```bash
npx dw-claw opencode
```

## What You Get

| Agent | Tools | Domain |
|-------|-------|--------|
| dw-catalog | 8 | Cross-catalog search, lineage, asset classification |
| dw-quality | 4 | Data profiling, quality scoring, anomaly detection |
| dw-pipelines | 4 | NL-to-pipeline generation, validation, deployment |
| dw-incidents | 4 | Anomaly detection, root cause analysis, remediation |
| dw-schema | 4 | Schema diffing, evolution, snapshots |
| dw-governance | 5 | Compliance, classification, policy enforcement |
| dw-observability | 6 | Metrics, SLA monitoring, pipeline tracing |
| dw-connectors | 139 | 49 platform connectors |
| dw-usage-intelligence | 13 | Usage analysis, query tracking |

## Links

- [Setup Guide](https://dataworkers.dev/docs/setup/opencode)
- [GitHub](https://github.com/DhanushAShetty/dw-claw-community)
- [Discord](https://discord.com/invite/b8DR5J53)
