/**
 * Type definitions for the Apache Polaris Catalog Integration connector.
 */

export interface PolarisCatalog {
  name: string;
  type: 'INTERNAL' | 'EXTERNAL';
  properties: Record<string, string>;
  storageConfigInfo?: {
    storageType: string;
    allowedLocations: string[];
  };
}

export interface PolarisPrincipal {
  name: string;
  type: 'SERVICE' | 'USER';
  clientId: string;
  properties: Record<string, string>;
}

export interface PolarisPrivilege {
  type:
    | 'TABLE_READ'
    | 'TABLE_WRITE'
    | 'TABLE_CREATE'
    | 'TABLE_DROP'
    | 'NAMESPACE_CREATE'
    | 'CATALOG_MANAGE';
  catalogName: string;
  namespaceName?: string;
  tableName?: string;
}

export interface PolarisPermission {
  principal: string;
  privileges: PolarisPrivilege[];
}

export interface PolarisAuthToken {
  accessToken: string;
  tokenType: 'bearer';
  expiresIn: number;
  issuedAt: number;
}
