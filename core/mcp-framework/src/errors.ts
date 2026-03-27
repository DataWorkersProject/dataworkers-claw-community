/**
 * Structured error hierarchy for Data Workers.
 *
 * Follows the dbt-mcp pattern of separating client errors (bad input,
 * missing assets) from server errors (backend failures, timeouts).
 *
 * All errors extend `DataWorkersError` which carries:
 * - `code`      – machine-readable error code (e.g. 'ASSET_NOT_FOUND')
 * - `type`      – 'client' | 'server'
 * - `retryable` – hint to callers whether retrying may succeed
 *
 * Specific subclasses provide sensible defaults so call-sites stay concise:
 *   throw new AssetNotFoundError('orders_raw');
 *   throw new ConnectorUnavailableError('Snowflake connector timed out');
 */

// ── Base ──

export class DataWorkersError extends Error {
  readonly code: string;
  readonly type: 'client' | 'server';
  readonly retryable: boolean;

  constructor(message: string, code: string, type: 'client' | 'server', retryable: boolean) {
    super(message);
    this.name = 'DataWorkersError';
    this.code = code;
    this.type = type;
    this.retryable = retryable;
  }
}

// ── Client Errors (caller's fault — bad input, missing asset) ──

export class ClientToolCallError extends DataWorkersError {
  constructor(message: string, code: string = 'INVALID_INPUT') {
    super(message, code, 'client', false);
    this.name = 'ClientToolCallError';
  }
}

export class AssetNotFoundError extends ClientToolCallError {
  constructor(assetId: string) {
    super(`Asset '${assetId}' not found in the catalog.`, 'ASSET_NOT_FOUND');
    this.name = 'AssetNotFoundError';
  }
}

export class InvalidParameterError extends ClientToolCallError {
  constructor(message: string) {
    super(message, 'INVALID_PARAMETER');
    this.name = 'InvalidParameterError';
  }
}

// ── Server Errors (our fault — backend failure, timeout) ──

export class ServerToolCallError extends DataWorkersError {
  constructor(message: string, code: string = 'INTERNAL_ERROR', retryable: boolean = true) {
    super(message, code, 'server', retryable);
    this.name = 'ServerToolCallError';
  }
}

export class ConnectorUnavailableError extends ServerToolCallError {
  constructor(message: string) {
    super(message, 'CONNECTOR_UNAVAILABLE', true);
    this.name = 'ConnectorUnavailableError';
  }
}

export class TimeoutError extends ServerToolCallError {
  constructor(message: string) {
    super(message, 'TIMEOUT', true);
    this.name = 'TimeoutError';
  }
}
