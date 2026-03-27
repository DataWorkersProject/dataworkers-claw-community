/**
 * ConnectorBridge — STRIPPED (OSS).
 *
 * Connector integration requires Data Workers Pro.
 * Visit https://dataworkers.dev/pricing
 */

import type { ConnectorContext } from '../types.js';

const PRO_MESSAGE = 'Connector integration requires Data Workers Pro. Visit https://dataworkers.dev/pricing';

export class ConnectorBridge {
  setMessageBus(_bus: unknown): void {}

  async resolveTableViaBus(
    _platform: string,
    _table: string,
    _customerId: string,
  ): Promise<ConnectorContext | null> {
    return null;
  }

  async resolveTable(
    _connectorType: 'iceberg' | 'polaris',
    _catalog: string | undefined,
    _namespace: string,
    _table: string,
  ): Promise<ConnectorContext | null> {
    return null;
  }

  async checkPolarisAccess(
    _principal: string,
    _catalog: string,
    _namespace: string,
    _table: string,
    _privilege: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    return { allowed: false, reason: PRO_MESSAGE };
  }

  getAvailableConnectors(): string[] {
    return [];
  }
}
