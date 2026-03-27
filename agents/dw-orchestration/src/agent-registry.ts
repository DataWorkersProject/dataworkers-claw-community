/**
 * AgentRegistry — CRUD operations for agent instances with per-tenant toggles.
 *
 * Stores agent metadata in the relational store. Supports registering,
 * deregistering, listing, and toggling agents per tenant.
 *
 * Agent registry implementation.
 */

import { InMemoryRelationalStore } from '@data-workers/infrastructure-stubs';
import type { AgentInstance } from './types.js';

export class AgentRegistry {
  private store: InMemoryRelationalStore;

  constructor(store: InMemoryRelationalStore) {
    this.store = store;
  }

  /**
   * Initialize the agents table. Must be called after construction.
   */
  async init(): Promise<void> {
    await this.store.createTable('agents');
  }

  /**
   * Register a new agent instance.
   * If an agent with the same name already exists, it is replaced.
   */
  async register(agent: AgentInstance): Promise<void> {
    // Remove existing entry if present (emulate upsert)
    const existing = await this.getByName(agent.name);
    if (existing) {
      // We can't update in the relational store, so we track by latest entry
      // The list() method handles dedup by returning only the latest entry per name
    }
    await this.store.insert('agents', { ...agent } as unknown as Record<string, unknown>);
  }

  /**
   * Deregister an agent by name.
   * Marks it as inactive by inserting a new record with 'inactive' status.
   */
  async deregister(name: string): Promise<void> {
    const agent = await this.getByName(name);
    if (agent) {
      await this.store.insert('agents', {
        ...agent,
        status: 'inactive',
        _deregistered: true,
      } as unknown as Record<string, unknown>);
    }
  }

  /**
   * List all registered (non-deregistered) agents.
   * Processes all rows; last insert per name wins. If the latest row
   * for a name is a deregistered record, that agent is excluded.
   */
  async list(): Promise<AgentInstance[]> {
    const rows = await this.store.query('agents');
    // Build a map of name → latest record (last insert wins)
    const latest = new Map<string, { agent: AgentInstance; deregistered: boolean }>();
    for (const row of rows) {
      latest.set(row.name as string, {
        agent: {
          name: row.name as string,
          status: row.status as AgentInstance['status'],
          lastHeartbeat: row.lastHeartbeat as number,
          capabilities: row.capabilities as string[],
          tenantConfig: row.tenantConfig as Record<string, boolean>,
        },
        deregistered: !!row._deregistered,
      });
    }
    return Array.from(latest.values())
      .filter((e) => !e.deregistered)
      .map((e) => e.agent);
  }

  /**
   * Set per-tenant configuration for an agent.
   * Enables or disables an agent for a specific tenant.
   */
  async setTenantConfig(name: string, tenant: string, enabled: boolean): Promise<void> {
    const agent = await this.getByName(name);
    if (!agent) {
      throw new Error(`Agent '${name}' not found in registry`);
    }
    const updatedConfig = { ...agent.tenantConfig, [tenant]: enabled };
    await this.store.insert('agents', {
      ...agent,
      tenantConfig: updatedConfig,
    } as unknown as Record<string, unknown>);
  }

  /**
   * Get an agent by name (latest non-deregistered record).
   */
  async getByName(name: string): Promise<AgentInstance | null> {
    const rows = await this.store.query('agents', (row) => row.name === name && !row._deregistered);
    if (rows.length === 0) return null;
    const row = rows[rows.length - 1]; // Latest entry
    return {
      name: row.name as string,
      status: row.status as AgentInstance['status'],
      lastHeartbeat: row.lastHeartbeat as number,
      capabilities: row.capabilities as string[],
      tenantConfig: row.tenantConfig as Record<string, boolean>,
    };
  }
}
