# Contributing to Data Workers

Welcome! We are glad you want to help build the open-source autonomous agent swarm for data engineering. Whether you are fixing a typo, adding a connector, or building a new agent, every contribution matters.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/dw-claw-community.git
   cd data-workers
   ```
3. **Install** dependencies (Node.js >= 20 required):
   ```bash
   npm install
   ```
4. **Run the tests** -- no external services needed thanks to InMemory stubs:
   ```bash
   npm test
   ```
5. **Verify linting and types**:
   ```bash
   npm run lint
   npm run typecheck
   ```

## Development Workflow

### Branch naming

Use a descriptive prefix: `feat/`, `fix/`, `docs/`, `refactor/`, or `test/`.

```bash
git checkout -b feat/add-redshift-connector
```

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Redshift catalog connector
fix: correct schema drift detection for Iceberg tables
docs: improve CatalogRegistry usage examples
test: add contract tests for IGraphDB
```

### Pull request process

1. Keep PRs focused -- one logical change per PR.
2. Ensure `npm test`, `npm run lint`, and `npm run typecheck` all pass.
3. Fill in the PR template with a summary, test plan, and any breaking changes.
4. A maintainer will review your PR. Please be patient and responsive to feedback.

## Adding a New Connector

Catalog connectors implement the `ICatalogProvider` interface so they work with the `CatalogRegistry` for cross-catalog discovery.

1. **Create the directory** under `connectors/`:
   ```
   connectors/your-platform/
   ├── src/
   │   ├── index.ts          # Exports the connector class
   │   ├── client.ts         # Real API client
   │   ├── stub-client.ts    # Stub with seed data for testing
   │   ├── types.ts          # Platform-specific types
   │   └── __tests__/
   │       └── connector.test.ts
   └── package.json
   ```
2. **Implement `ICatalogProvider`** from `connectors/shared/types.ts`. At minimum you need: `connect()`, `disconnect()`, `healthCheck()`, `listNamespaces()`, `listTables()`, and `getTableMetadata()`.
3. **Add a StubClient** that returns realistic seed data so tests run without credentials.
4. **Write tests** covering each interface method using your StubClient.
5. **Register in CatalogRegistry** -- add your connector to `connectors/shared/catalog-registry.ts` so agents can discover it.
6. **Add a workspace entry** in the root `package.json` if needed.

## Adding a New Agent

Each agent is an MCP server that follows a standard structure.

1. **Create the directory** under `agents/`:
   ```
   agents/dw-your-agent/
   ├── src/
   │   ├── index.ts          # MCP server setup + tool registration
   │   ├── tools/            # One file per MCP tool
   │   ├── backends.ts       # Business logic and data access
   │   ├── types.ts          # Type definitions
   │   └── __tests__/
   │       └── tools.test.ts
   └── package.json
   ```
2. **Extend `DataWorkersMCPServer`** from `core/mcp-framework`.
3. **Register tools** with `server.registerTool(definition, handler)`. Each tool needs a JSON schema describing its inputs.
4. **Use factory functions** (`createKeyValueStore()`, `createMessageBus()`, etc.) for infrastructure dependencies -- never import concrete adapters directly.
5. **Write tests** for every tool. Tests will automatically use InMemory stubs.
6. **Add a Dockerfile** in `docker/` if the agent will be deployed independently.

## Code Standards

- **TypeScript only** -- all source files use `.ts`.
- **Strict mode** -- `strict: true` in tsconfig. No `any` unless absolutely unavoidable (and documented why).
- **No `eslint-disable`** comments. Fix the lint issue or discuss it in your PR.
- **Named exports** preferred over default exports.
- **Use the infrastructure interfaces** (`IKeyValueStore`, `IMessageBus`, etc.) rather than importing concrete implementations.
- **Keep functions small** -- if a function exceeds ~50 lines, consider splitting it.

## Testing

### Running tests

```bash
npm test                    # All tests (Vitest)
npm test -- --watch         # Watch mode
npm test -- agents/dw-pipelines  # Single workspace
```

### Test locations

| Layer | Location | Purpose |
|-------|----------|---------|
| Unit | `agents/*/src/__tests__/`, `core/*/src/__tests__/` | Individual tools, backends, connectors |
| Contract | `tests/contracts/` | Verify implementations match interface contracts |
| Integration | `tests/integration/` | Cross-agent and cross-connector flows |
| E2E | `tests/e2e/` | Full system smoke tests |

### What constitutes adequate coverage

- Every MCP tool must have at least one happy-path and one error-path test.
- New connectors must test all `ICatalogProvider` methods.
- New infrastructure adapters must pass the existing contract test suite.
- If you fix a bug, add a regression test that would have caught it.

## Contributor License Agreement (CLA)

All external contributions require signing our [Contributor License Agreement](https://cla.dataworkers.io). The CLA bot will automatically prompt you on your first pull request. Your PR cannot be merged until the CLA is signed.

## Getting Help

- **GitHub Issues** -- Search [existing issues](https://github.com/DhanushAShetty/dw-claw-community/issues) or open a new one. Use labels like `good first issue` to find beginner-friendly tasks.
- **Discord** -- Join the [Data Workers Community](https://discord.com/invite/b8DR5J53) to ask questions, share ideas, and connect with other contributors.
- **Architecture Guide** -- Read [ARCHITECTURE.md](ARCHITECTURE.md) for a deep dive into how the system is designed.

Thank you for contributing to Data Workers!
