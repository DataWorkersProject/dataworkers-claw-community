# Gemini CLI Setup — Community Edition

> Getting started with Data Workers Community Edition in [Gemini CLI](https://github.com/google-gemini/gemini-cli).

## Prerequisites

- **Gemini CLI** — installed (`npm i -g @google/gemini-cli`).
- **Node.js 20+** — Check with `node --version`.

## Quick Start (60 seconds)

### Option 1: Auto-generate project config

```bash
npx dw-claw init --client gemini
```

This writes `.gemini/settings.json` in the current project:

```json
{
  "mcpServers": {
    "data-workers": {
      "command": "npx",
      "args": ["-y", "dw-claw"]
    }
  }
}
```

### Option 2: Global config

Add the same `mcpServers` block to `~/.gemini/settings.json` to make Data Workers
available in every project.

## Verify Setup

Start `gemini` and run `/mcp` — the `data-workers` server should be listed with its
tools. Then ask:

```
Profile the orders table and show me its quality score.
```

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

## Troubleshooting

- **Server not listed in `/mcp`** — Gemini CLI reads `.gemini/settings.json` from the
  project root; restart the CLI after writing the config.
- **Tool confirmations** — set `"trust": true` on the server entry in
  `settings.json` to skip per-call confirmation prompts (only for servers you trust).
- **`npx` not found** — ensure Node 20+ is on your PATH (`node --version`).
