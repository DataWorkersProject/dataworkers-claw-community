/**
 * verify_global_hash_chain — Global hash chain verification spanning all agents.
 *
 * Verifies the per-agent hash chains and computes a global chain hash
 * by hashing together the last hash from each agent's chain.
 *
 * NO LLM calls — purely deterministic.
 */

import { createHash } from 'crypto';
import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { GlobalHashChainResult } from '../types.js';
import { relationalStore } from '../backends.js';

export const verifyGlobalHashChainDefinition: ToolDefinition = {
  name: 'verify_global_hash_chain',
  description:
    'Verify the integrity of the global hash chain spanning all agents\' usage events. Checks per-agent chains and computes a composite global chain hash.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const verifyGlobalHashChainHandler: ToolHandler = async () => {
  try {
    const rows = await relationalStore.query('usage_events');

    // Group by agentName
    const byAgent: Record<string, typeof rows> = {};
    for (const row of rows) {
      const agent = row.agentName as string;
      if (!byAgent[agent]) byAgent[agent] = [];
      byAgent[agent].push(row);
    }

    const agentChains: { agentName: string; eventCount: number; integrity: 'valid' | 'broken' }[] = [];
    const agentLastHashes: string[] = [];
    let globalIntegrity: 'valid' | 'broken' = 'valid';

    for (const [agentName, agentRows] of Object.entries(byAgent).sort((a, b) => a[0].localeCompare(b[0]))) {
      // Sort by timestamp to get chain order
      agentRows.sort((a, b) => (a.timestamp as number) - (b.timestamp as number));

      let chainValid = true;
      for (let i = 1; i < agentRows.length; i++) {
        // Verify that each event's previousHash matches prior event's hash
        if (agentRows[i].previousHash !== agentRows[i - 1].hash) {
          chainValid = false;
          break;
        }
      }

      if (!chainValid) globalIntegrity = 'broken';

      const lastHash = agentRows[agentRows.length - 1]?.hash as string ?? '0'.repeat(64);
      agentLastHashes.push(`${agentName}:${lastHash}`);

      agentChains.push({
        agentName,
        eventCount: agentRows.length,
        integrity: chainValid ? 'valid' : 'broken',
      });
    }

    // Compute global chain hash from all agents' last hashes
    const globalChainHash = createHash('sha256')
      .update(agentLastHashes.join('|'))
      .digest('hex');

    const result: GlobalHashChainResult = {
      integrity: globalIntegrity,
      totalEvents: rows.length,
      agentChains,
      globalChainHash,
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
