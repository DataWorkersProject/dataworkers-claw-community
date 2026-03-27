#!/bin/bash
# Start a Data Workers MCP agent via stdio transport.
# Usage: ./start-agent.sh <agent-name>
# Example: ./start-agent.sh dw-governance
#
# This script ensures the working directory is the repo root,
# which is required for tsx to resolve workspace dependencies.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

AGENT="$1"
if [ -z "$AGENT" ]; then
  echo "Usage: $0 <agent-name>" >&2
  echo "Available agents:" >&2
  ls -d agents/dw-*/ 2>/dev/null | sed 's|agents/||;s|/||' >&2
  exit 1
fi

if [ ! -d "agents/$AGENT/src" ]; then
  echo "Error: agent '$AGENT' not found in agents/" >&2
  exit 1
fi

exec npx tsx "agents/$AGENT/src/index.ts"
