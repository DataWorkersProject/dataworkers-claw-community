#!/usr/bin/env bash
set -euo pipefail

# Setup script for Data Workers + OpenCode integration
# Installs or merges the Data Workers MCP config into opencode.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_CONFIG="$REPO_ROOT/configs/opencode.json"
TARGET_CONFIG="./opencode.json"

echo "=== Data Workers — OpenCode Setup ==="
echo ""

# Step 1: Check if opencode is installed
if command -v opencode &>/dev/null; then
  echo "[ok] opencode found: $(which opencode)"
else
  echo "[warn] opencode not found in PATH"
  echo "       Install it from https://opencode.ai and re-run, or continue to generate config only."
  echo ""
fi

# Verify source config exists
if [ ! -f "$SOURCE_CONFIG" ]; then
  echo "[error] Source config not found at $SOURCE_CONFIG"
  echo "        Are you running this from inside the dw-claw-oss repo?"
  exit 1
fi

# Step 2: Check if opencode.json already exists in current directory
if [ -f "$TARGET_CONFIG" ]; then
  echo "[info] Existing opencode.json found in current directory."
  echo ""

  # Step 3: Attempt to merge
  if command -v jq &>/dev/null; then
    echo "[info] jq detected — merging Data Workers MCP entries into existing config..."
    # Extract .mcp from source and merge into target
    MERGED=$(jq -s '.[0] * { mcp: (.[0].mcp // {} ) * .[1].mcp }' "$TARGET_CONFIG" "$SOURCE_CONFIG")

    if [ -z "$MERGED" ]; then
      echo "[error] jq merge failed. Please merge manually."
      exit 1
    fi

    # Back up existing config
    cp "$TARGET_CONFIG" "${TARGET_CONFIG}.bak"
    echo "[info] Backup saved to ${TARGET_CONFIG}.bak"

    echo "$MERGED" | jq '.' > "$TARGET_CONFIG"
    echo "[ok] Merged 13 Data Workers MCP agents into opencode.json"
  else
    echo "[warn] jq not installed — cannot auto-merge."
    echo ""
    echo "       Option 1: Install jq (brew install jq) and re-run this script"
    echo "       Option 2: Manually copy the \"mcp\" entries from:"
    echo "                 $SOURCE_CONFIG"
    echo "                 into your existing opencode.json"
    echo ""
    exit 0
  fi
else
  # Step 4: No existing config — just copy
  echo "[info] No opencode.json found. Creating from Data Workers template..."
  cp "$SOURCE_CONFIG" "$TARGET_CONFIG"
  echo "[ok] Created opencode.json with 13 Data Workers MCP agents"
fi

# Step 5: Validate JSON
echo ""
if command -v jq &>/dev/null; then
  if jq empty "$TARGET_CONFIG" 2>/dev/null; then
    echo "[ok] JSON validation passed"
  else
    echo "[error] opencode.json contains invalid JSON!"
    exit 1
  fi
elif command -v python3 &>/dev/null; then
  if python3 -c "import json; json.load(open('$TARGET_CONFIG'))" 2>/dev/null; then
    echo "[ok] JSON validation passed"
  else
    echo "[error] opencode.json contains invalid JSON!"
    exit 1
  fi
else
  echo "[warn] No JSON validator available (install jq or python3). Skipping validation."
fi

# Step 6: Success message
AGENT_COUNT=$(grep -c '"type": "local"' "$TARGET_CONFIG" || true)
echo ""
echo "=== Setup Complete ==="
echo ""
echo "  Config:  $TARGET_CONFIG"
echo "  Agents:  $AGENT_COUNT MCP server(s) configured"
echo ""
echo "Next steps:"
echo "  1. Run 'opencode' in this directory to start"
echo "  2. All agents use InMemory stubs by default (no external services needed)"
echo "  3. Set env vars (SNOWFLAKE_ACCOUNT, etc.) to connect to real platforms"
echo "  4. See configs/opencode-starter.json for a minimal single-agent config"
echo ""
