# MCP Agent Startup Bug Report

**Date:** 2026-03-27
**Status:** All issues resolved
**Affected:** All 11 agents in the OSS repo

---

## Summary

After the OSS launch, all MCP agents failed to start when configured as MCP servers in Claude Code, Cursor, or any MCP client. Six distinct root causes were identified and fixed.

---

## Bug 1: `"main": "dist/index.js"` but dist directories empty

**Severity:** Critical — blocks all agents
**Root cause:** All 39 `package.json` files had `"main": "src/index.ts"` pointing to TypeScript source. This was changed to `"main": "dist/index.js"` to support `node dist/index.js` runtime. However:
- The `dist/` directories were deleted during a build cleanup
- Even when built, `node dist/index.js` doesn't work because the compiled output is CJS but the source uses top-level `await` (ESM-only feature)
- The ONLY working runtime is `tsx` which loads TypeScript source directly

**Fix:** Reverted all `"main"` fields back to `"src/index.ts"`. The `tsx` runtime resolves workspace dependencies via `main` field, so this must point to source.

**Files:** 39 `package.json` files across `agents/`, `core/`, `connectors/`, `packages/`

---

## Bug 2: tsx module resolution fails from non-repo directories

**Severity:** Critical — blocks all agents when used via MCP clients
**Root cause:** `tsx` relies on the working directory to resolve TypeScript path mappings and workspace symlinks. When Claude Code spawns an agent process, the CWD is the user's project directory (e.g., `~/my-project/`), not the Data Workers repo root. This causes `@data-workers/*` package imports to fail with:
```
SyntaxError: The requested module '@data-workers/infrastructure-stubs' does not provide an export named 'InMemoryRelationalStore'
```

**Fix:** Created `start-agent.sh` wrapper script that `cd`s to the repo root before launching tsx:
```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
exec npx tsx "agents/$1/src/index.ts"
```

**File:** `start-agent.sh` (new)

---

## Bug 3: Claude Code `.mcp.json` doesn't support `cwd` field

**Severity:** Critical — initial fix attempt used unsupported config
**Root cause:** The `.mcp.json` format only supports `command`, `args`, and `env` fields. The `cwd` field was used in early fix attempts but is silently ignored, causing agents to start in the wrong directory.

**Fix:** Switched to using the `start-agent.sh` wrapper (which handles CWD internally) as the `command` in `.mcp.json`.

**Files:** README.md, playground `.mcp.json`

---

## Bug 4: dw-ml missing `startStdioTransport`

**Severity:** Critical — dw-ml agent exits immediately with no output
**Root cause:** The `agents/dw-ml/src/index.ts` file registers all 16 tools and calls `captureCapabilities()` but never calls `startStdioTransport(server)`. Without this, the agent has no stdin/stdout transport and exits immediately.

**Fix:** Added the standard stdio transport block:
```typescript
import { DataWorkersMCPServer, startStdioTransport } from '@data-workers/mcp-framework';
// ... tool registration ...
if (process.env.DW_STDIO === '1' || !process.env.DW_HEALTH_PORT) {
  startStdioTransport(server);
}
```

**File:** `agents/dw-ml/src/index.ts`

---

## Bug 5: Polaris connector type-only re-export causes ESM error

**Severity:** Medium — blocks dw-connectors agent only
**Root cause:** `connectors/polaris/src/index.ts` re-exports interfaces using value export syntax:
```typescript
export { PolarisAuthToken } from './types.js';  // BAD
```
With `"type": "module"` set, esbuild/tsx strips type-only content from `types.ts`, leaving an empty module. The value re-export then fails at runtime because the export doesn't exist.

**Fix:** Changed to type-only re-export:
```typescript
export type { PolarisAuthToken } from './types.js';  // GOOD
```

**File:** `connectors/polaris/src/index.ts`

---

## Bug 6: dw-orchestration listed as MCP agent but is internal service

**Severity:** Low — causes one failed connection in MCP client
**Root cause:** `agents/dw-orchestration/` is an internal TypeScript library (task scheduler, heartbeat monitor, agent registry), NOT an MCP server. It has no `DataWorkersMCPServer`, no `registerTool` calls, and no `startStdioTransport`. Its own header comment says: "This is an internal service, NOT an MCP agent."

**Fix:** Removed dw-orchestration from all MCP setup instructions. The agent count is now 10 MCP agents + 1 internal service.

**Files:** README.md, playground `.mcp.json`

---

## Additional issues found during investigation

### Stale `.js` files in `src/` directories
With `"type": "module"` set in `package.json`, Node treats `.js` files as ESM. Stale compiled `.js` files in `src/` directories (left over from previous builds) contain CJS code (`exports is not defined in ES module scope`). These were cleaned from:
- `core/infrastructure-stubs/src/*.js` (14 files)
- `core/license/src/tool-gate.js`
- `connectors/iceberg/src/*.js` (3 files)
- `connectors/shared/types.js`

### Missing `tsconfig.json` files
- `core/enterprise/tsconfig.json` — missing entirely, preventing compilation
- `core/medallion/tsconfig.json` — missing entirely
- `core/infrastructure-stubs/tsconfig.json` — missing `"composite": true`
- `core/mcp-framework/tsconfig.json` — missing project reference to `core/license`

### npm packages not functional standalone
The published npm packages (`dw-claw`, `@data-workers/cli`, `data-context-mcp`) depend on workspace packages that aren't published individually. `npx dw-claw pipelines` only works from within the cloned repo, not as a standalone install. This is a known limitation for v1.

---

## Verification

After all fixes:
- **All 10 MCP agents** start successfully from any directory via `start-agent.sh`
- **153 test files** pass (2,701 individual tests)
- **0 test regressions** from the changes
- Tested from `/tmp`, from `~/Desktop/dataworkers-playground/`, and from repo root

---

## Recommended setup (users)

```bash
git clone https://github.com/DataWorkersProject/dataworkers-claw-community.git
cd dataworkers-claw-community
npm install
claude mcp add dw-catalog -- "$(pwd)/start-agent.sh" dw-context-catalog
```
