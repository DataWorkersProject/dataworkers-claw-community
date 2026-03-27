#!/usr/bin/env node
/**
 * @data-workers/cli entry point.
 *
 * Usage:
 *   npx @data-workers/cli init     - Generate .mcp.json for all agents
 *   npx @data-workers/cli list     - List available agents and tools
 *   npx @data-workers/cli status   - Check agent health
 *   npx @data-workers/cli help     - Show usage
 */

import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { statusCommand } from './commands/status.js';

const COMMANDS: Record<string, (args: string[]) => Promise<void> | void> = {
  init: initCommand,
  list: listCommand,
  status: statusCommand,
};

function showHelp(): void {
  console.log(`
  data-workers CLI v0.1.0

  Usage: npx @data-workers/cli <command>

  Commands:
    init      Initialize data-workers MCP config (.mcp.json)
    list      List all available agents and their tools
    status    Check which agents are currently running
    help      Show this help message

  Examples:
    npx @data-workers/cli init
    npx @data-workers/cli list
    npx @data-workers/cli status
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  try {
    await handler(args.slice(1));
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();

export { COMMANDS, showHelp };
