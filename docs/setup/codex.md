# Codex CLI Setup — Community Edition

> Getting started with Data Workers Community Edition in [OpenAI Codex CLI](https://developers.openai.com/codex).

## Prerequisites

- **Codex CLI** — installed and signed in (`npm i -g @openai/codex` or `brew install codex`).
- **Node.js 20+** — Check with `node --version`.

## Quick Start (60 seconds)

### Option 1: One-liner (global)

```bash
codex mcp add data-workers -- npx -y dw-claw
```

This registers the unified Data Workers MCP server (160+ tools) in your global
`~/.codex/config.toml`. It is available in every project.

### Option 2: Project-scoped config

```bash
npx dw-claw init --client codex
```

This writes `.codex/config.toml` in the current project:

```toml
[mcp_servers.data-workers]
command = "npx"
args = ["-y", "dw-claw"]
```

Codex loads project configs additively once you trust the project, so teammates who
clone the repo get Data Workers pre-loaded with zero setup.

### Option 3: Clone this repo

This repository ships its own `.codex/config.toml` and `AGENTS.md`. Clone it, open
Codex inside it, trust the project, and the `data-workers` server is available
immediately.

## Verify Setup

Start `codex` and run `/mcp` — the `data-workers` server should be listed. Then ask:

```
Search the data catalog for customer tables and trace the lineage of the most used one.
```

Codex tool names are namespaced as `mcp__data-workers__<tool>`.

## AGENTS.md

Codex reads `AGENTS.md` as project memory. This repo's `AGENTS.md` describes the
agent roster and how to chain tools (catalog → quality → schema). If you add
Data Workers to your own project, consider copying that section into your
`AGENTS.md` so Codex knows when to reach for each agent.

## InMemory Stubs

All agents run against in-memory seed data by default — no credentials needed. Every
tool works instantly so you can evaluate the full workflow before connecting
anything real.

## Connect Real Data Platforms

```bash
npx dw-claw setup
```

The wizard writes credentials for Snowflake, BigQuery, or Databricks to a local
`.env` (never committed). Agents auto-detect them on next startup.

## Limiting tools

Codex supports per-server tool allow/deny lists in `config.toml` if you want a
smaller surface:

```toml
[mcp_servers.data-workers]
command = "npx"
args = ["-y", "dw-claw"]
enabled_tools = ["search_catalog", "get_lineage", "run_quality_check"]
```

## Troubleshooting

- **Server not listed in `/mcp`** — project configs load only after you trust the
  project; run `codex` from the project root and accept the trust prompt.
- **`npx` not found** — Codex spawns the server with your shell PATH; ensure Node 20+
  is on it (`node --version`).
- **Slow first start** — the first `npx -y dw-claw` downloads the package; subsequent
  starts use the npm cache.
