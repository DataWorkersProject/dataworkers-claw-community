import type {
  ContextEntry,
  RedisConfig,
  AgentCheckpoint,
  RedisConnectionState,
  BufferedOperation,
} from './types.js';

/**
 * Redis Cluster-based context store for cross-agent state sharing.
 *
 * Features:
 * - Customer_id keyspace prefixing for tenant isolation (REQ-CTX-004)
 * - 24-hour default TTL (REQ-CTX-001)
 * - 30-second checkpointing (REQ-CTX-002)
 * - Failover buffering: SUSPENDED -> 60s -> DEGRADED (REQ-CTX-003)
 * - Supports ioredis Cluster client
 */
export class RedisContextStore {
  private config: RedisConfig;
  private connectionState: RedisConnectionState = 'disconnected';
  private buffer: BufferedOperation[] = [];
  private suspendedAt: number | null = null;

  constructor(config: Partial<RedisConfig> & { nodes: RedisConfig['nodes'] }) {
    this.config = {
      keyPrefix: config.keyPrefix ?? 'customer',
      ttlSeconds: config.ttlSeconds ?? 86_400,
      checkpointIntervalMs: config.checkpointIntervalMs ?? 30_000,
      failoverBufferMs: config.failoverBufferMs ?? 60_000,
      ...config,
    };
  }

  // ── Connection Management ──

  getConnectionState(): RedisConnectionState {
    return this.connectionState;
  }

  /**
   * Connect to Redis Cluster.
   */
  async connect(): Promise<void> {
    // In production: new Redis.Cluster(this.config.nodes, { redisOptions: { password } })
    this.connectionState = 'connected';
  }

  /**
   * Disconnect from Redis.
   */
  async disconnect(): Promise<void> {
    this.connectionState = 'disconnected';
  }

  // ── Key Management (REQ-CTX-004) ──

  /**
   * Build a tenant-isolated key: {prefix}:{customerId}:{key}
   * Per REQ-CTX-004, all keys MUST be prefixed with customer_id.
   */
  buildKey(customerId: string, key: string): string {
    return `${this.config.keyPrefix}:${customerId}:${key}`;
  }

  /**
   * Validate that a key belongs to the expected customer.
   */
  validateKeyOwnership(key: string, customerId: string): boolean {
    const prefix = `${this.config.keyPrefix}:${customerId}:`;
    return key.startsWith(prefix);
  }

  // ── Context Operations ──

  /**
   * Store a context entry with tenant-scoped key and TTL.
   */
  async set(entry: ContextEntry): Promise<void> {
    const key = this.buildKey(entry.customerId, entry.key);
    const ttl = entry.ttlSeconds ?? this.config.ttlSeconds;
    const value = JSON.stringify(entry);

    if (this.connectionState === 'suspended') {
      this.buffer.push({ type: 'set', key, value, ttlSeconds: ttl, timestamp: Date.now() });
      return;
    }

    if (this.connectionState === 'degraded') {
      throw new Error('Redis in DEGRADED mode: write operations unavailable');
    }

    // In production: await this.client.setex(key, ttl, value);
    void key;
    void ttl;
    void value;
  }

  /**
   * Retrieve a context entry by customer and key.
   */
  async get(customerId: string, key: string): Promise<ContextEntry | null> {
    const fullKey = this.buildKey(customerId, key);

    if (this.connectionState === 'degraded') {
      // REQ-CTX-003: Fall back to PostgreSQL for reads
      return this.readFromPostgresFallback(fullKey);
    }

    // In production: const raw = await this.client.get(fullKey);
    void fullKey;
    return null;
  }

  /**
   * Delete a context entry.
   */
  async delete(customerId: string, key: string): Promise<boolean> {
    const fullKey = this.buildKey(customerId, key);

    if (this.connectionState === 'suspended') {
      this.buffer.push({ type: 'delete', key: fullKey, timestamp: Date.now() });
      return true;
    }

    if (this.connectionState === 'degraded') {
      throw new Error('Redis in DEGRADED mode: delete operations unavailable');
    }

    // In production: return (await this.client.del(fullKey)) > 0;
    void fullKey;
    return false;
  }

  /**
   * List all keys for a customer (pattern scan).
   */
  async listKeys(customerId: string, pattern = '*'): Promise<string[]> {
    const scanPattern = this.buildKey(customerId, pattern);
    // In production: use SCAN with pattern
    void scanPattern;
    return [];
  }

  // ── Checkpointing (REQ-CTX-002) ──

  /**
   * Save an agent checkpoint. Checkpoints use a dedicated key pattern
   * and shorter TTL (1 hour) for cleanup.
   */
  async saveCheckpoint(checkpoint: AgentCheckpoint): Promise<void> {
    const key = this.buildKey(
      checkpoint.customerId,
      `checkpoint:${checkpoint.agentId}:${checkpoint.version}`,
    );
    const value = JSON.stringify(checkpoint);
    // 1-hour TTL for checkpoints
    const ttl = 3600;

    if (this.connectionState !== 'connected') {
      // Buffer checkpoint during failover
      this.buffer.push({ type: 'set', key, value, ttlSeconds: ttl, timestamp: Date.now() });
      return;
    }

    // In production: await this.client.setex(key, ttl, value);
    void key;
    void value;
    void ttl;
  }

  /**
   * Restore the latest checkpoint for an agent.
   */
  async restoreCheckpoint(customerId: string, agentId: string): Promise<AgentCheckpoint | null> {
    // In production: scan for checkpoint keys, find latest version
    void customerId;
    void agentId;
    return null;
  }

  // ── Failover Management (REQ-CTX-002, REQ-CTX-003) ──

  /**
   * Handle Redis disconnection. Enters SUSPENDED state with buffering.
   * After 60 seconds, transitions to DEGRADED (read-only via PostgreSQL).
   */
  handleDisconnect(): void {
    this.connectionState = 'suspended';
    this.suspendedAt = Date.now();
  }

  /**
   * Check if the SUSPENDED timeout has elapsed and transition to DEGRADED.
   */
  checkFailoverTimeout(): boolean {
    if (this.connectionState !== 'suspended' || !this.suspendedAt) {
      return false;
    }

    if (Date.now() - this.suspendedAt >= this.config.failoverBufferMs) {
      this.connectionState = 'degraded';
      return true;
    }

    return false;
  }

  /**
   * Handle Redis reconnection. Replays buffered operations.
   */
  async handleReconnect(): Promise<number> {
    const bufferedCount = this.buffer.length;
    this.connectionState = 'connected';
    this.suspendedAt = null;

    // Replay buffered operations in order
    for (const op of this.buffer) {
      if (op.type === 'set' && op.value) {
        // In production: await this.client.setex(op.key, op.ttlSeconds ?? this.config.ttlSeconds, op.value);
        void op;
      } else if (op.type === 'delete') {
        // In production: await this.client.del(op.key);
        void op;
      }
    }

    this.buffer = [];
    return bufferedCount;
  }

  /**
   * Get the current buffer size.
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  // ── Distributed Locking ──

  /**
   * Acquire a distributed lock using SETNX.
   * Foundation for Redlock implementation in .
   */
  async acquireLock(
    customerId: string,
    lockName: string,
    ttlSeconds = 300,
  ): Promise<{ acquired: boolean; token: string }> {
    const key = this.buildKey(customerId, `lock:${lockName}`);
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // In production: const result = await this.client.set(key, token, 'NX', 'EX', ttlSeconds);
    void key;
    void token;
    void ttlSeconds;
    return { acquired: false, token };
  }

  /**
   * Release a distributed lock (only if we hold it).
   */
  async releaseLock(
    customerId: string,
    lockName: string,
    token: string,
  ): Promise<boolean> {
    const key = this.buildKey(customerId, `lock:${lockName}`);
    // In production: Lua script to check token and delete atomically
    void key;
    void token;
    return false;
  }

  // ── Internal ──

  /**
   * PostgreSQL fallback for reads during DEGRADED mode.
   */
  private async readFromPostgresFallback(_key: string): Promise<ContextEntry | null> {
    // TODO: Implement PostgreSQL read fallback for degraded mode
    return null;
  }
}
