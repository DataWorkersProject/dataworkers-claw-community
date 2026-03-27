/**
 * CatalogRegistry — Registry for ICatalogProvider instances.
 *
 * Provides factory-based registration, lazy instantiation,
 * and capability-based provider lookup.
 */
import type { ICatalogProvider, CatalogCapability, CatalogProviderRegistry } from './types.js';
export declare class CatalogRegistry implements CatalogProviderRegistry {
    private providers;
    private factories;
    /** Register a provider factory (ConnectorRegistry compat). */
    register(type: string, factory: (config: Record<string, unknown>) => ICatalogProvider): void;
    /** Register a provider factory (CatalogProviderRegistry). */
    registerProvider(type: string, factory: () => ICatalogProvider): void;
    /**
     * Create (or return cached) provider instance.
     * Config is accepted for ConnectorRegistry compatibility but
     * the factory is invoked without arguments.
     */
    create(type: string, _config?: Record<string, unknown>): ICatalogProvider;
    /** List all registered provider type names. */
    list(): string[];
    /** Get a cached provider instance by type, or undefined. */
    getProvider(type: string): ICatalogProvider | undefined;
    /** Get all instantiated provider instances. */
    getAllProviders(): ICatalogProvider[];
    /** Filter instantiated providers by a specific capability. */
    getProvidersByCapability(capability: CatalogCapability): ICatalogProvider[];
}
//# sourceMappingURL=catalog-registry.d.ts.map