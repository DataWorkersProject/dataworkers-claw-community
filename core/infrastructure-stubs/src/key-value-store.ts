/**
 * In-memory key-value store stub for development and testing.
 * Simulates Redis-like semantics with optional TTL support.
 */

import type { IKeyValueStore } from './interfaces/index.js';

interface StoredEntry {
  value: string;
  expiresAt?: number;
}

export class InMemoryKeyValueStore implements IKeyValueStore {
  private store: Map<string, StoredEntry> = new Map();

  /**
   * Get a value by key. Returns null if the key does not exist or has expired.
   */
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Set a key-value pair with optional TTL in milliseconds.
   */
  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    const entry: StoredEntry = { value };
    if (ttlMs !== undefined) {
      entry.expiresAt = Date.now() + ttlMs;
    }
    this.store.set(key, entry);
  }

  /**
   * Delete a key from the store.
   */
  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  /**
   * Check if a key exists and has not expired.
   */
  async exists(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  /**
   * List keys, optionally filtered by a prefix pattern.
   * If pattern ends with '*', matches keys starting with the prefix.
   * Otherwise, returns keys that exactly match the pattern.
   */
  async keys(pattern?: string): Promise<string[]> {
    const result: string[] = [];
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      // Skip expired entries and clean them up
      if (entry.expiresAt !== undefined && now >= entry.expiresAt) {
        this.store.delete(key);
        continue;
      }

      if (!pattern) {
        result.push(key);
        continue;
      }

      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (key.startsWith(prefix)) {
          result.push(key);
        }
      } else if (key === pattern) {
        result.push(key);
      }
    }

    return result;
  }

  /**
   * No-op seed for interface conformance.
   */
  seed(): void {
    // No seed data required for key-value store
  }
}
