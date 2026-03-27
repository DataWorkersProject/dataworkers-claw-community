/**
 * IDataPlatformConnector — Base interface for all data platform connectors.
 * Defines common operations that all connectors must implement.
 * Connector-specific operations extend this base.
 */
export interface TableMetadata {
    name: string;
    namespace: string[];
    schema: ColumnMetadata[];
    properties: Record<string, string>;
    createdAt?: number;
    updatedAt?: number;
}
export interface ColumnMetadata {
    name: string;
    type: string;
    nullable: boolean;
    comment?: string;
}
export interface NamespaceInfo {
    name: string[];
    properties: Record<string, string>;
}
export interface ConnectorHealthStatus {
    healthy: boolean;
    latencyMs: number;
    details?: Record<string, unknown>;
}
export interface IDataPlatformConnector {
    /** Unique connector identifier (e.g., 'iceberg', 'polaris', 'snowflake') */
    readonly connectorType: string;
    /** Establish connection to the data platform */
    connect(...args: unknown[]): void | Promise<unknown>;
    /** Disconnect from the data platform */
    disconnect(): void;
    /** Check connector health */
    healthCheck(): ConnectorHealthStatus | Promise<ConnectorHealthStatus>;
    /** List all namespaces (databases/schemas/catalogs) */
    listNamespaces(): NamespaceInfo[] | Promise<NamespaceInfo[]>;
    /** List tables within a namespace */
    listTables(namespace: string): TableMetadata[] | Promise<TableMetadata[]>;
    /** Get detailed metadata for a specific table */
    getTableMetadata(namespace: string, table: string): TableMetadata | Promise<TableMetadata>;
}
/** Type-safe connector factory */
export type ConnectorFactory = (config: Record<string, unknown>) => IDataPlatformConnector;
/** Registry of available connectors */
export interface ConnectorRegistry {
    register(type: string, factory: ConnectorFactory): void;
    create(type: string, config: Record<string, unknown>): IDataPlatformConnector;
    list(): string[];
}
export type CatalogCapability = 'discovery' | 'lineage' | 'governance' | 'quality' | 'search' | 'versioning';
export interface TableInfo {
    name: string;
    namespace: string[];
    tableType?: string;
    properties?: Record<string, string>;
}
export interface LineageNode {
    entityId: string;
    entityType: string;
    name: string;
    namespace?: string[];
}
export interface LineageEdge {
    source: string;
    target: string;
    transformationType?: string;
}
export interface LineageGraph {
    nodes: LineageNode[];
    edges: LineageEdge[];
}
export interface Permission {
    principal: string;
    resource: string;
    privilege: string;
    granted: boolean;
}
export interface Tag {
    key: string;
    value: string;
    resource: string;
}
export interface ICatalogProvider extends IDataPlatformConnector {
    readonly providerType: string;
    readonly capabilities: CatalogCapability[];
    searchTables?(query: string): Promise<TableInfo[]> | TableInfo[];
    getLineage?(entityId: string, direction: 'upstream' | 'downstream', depth?: number): Promise<LineageGraph> | LineageGraph;
    getPermissions?(resource: string): Promise<Permission[]> | Permission[];
    getTags?(resource: string): Promise<Tag[]> | Tag[];
}
export interface CatalogProviderRegistry extends ConnectorRegistry {
    registerProvider(type: string, factory: () => ICatalogProvider): void;
    getProvider(type: string): ICatalogProvider | undefined;
    getAllProviders(): ICatalogProvider[];
    getProvidersByCapability(capability: CatalogCapability): ICatalogProvider[];
}
//# sourceMappingURL=types.d.ts.map