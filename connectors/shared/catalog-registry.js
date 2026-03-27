/**
 * CatalogRegistry — Registry for ICatalogProvider instances.
 *
 * Provides factory-based registration, lazy instantiation,
 * and capability-based provider lookup.
 */
export class CatalogRegistry {
    providers = new Map();
    factories = new Map();
    /** Register a provider factory (ConnectorRegistry compat). */
    register(type, factory) {
        this.factories.set(type, () => factory({}));
    }
    /** Register a provider factory (CatalogProviderRegistry). */
    registerProvider(type, factory) {
        this.factories.set(type, factory);
    }
    /**
     * Create (or return cached) provider instance.
     * Config is accepted for ConnectorRegistry compatibility but
     * the factory is invoked without arguments.
     */
    create(type, _config = {}) {
        let provider = this.providers.get(type);
        if (provider)
            return provider;
        const factory = this.factories.get(type);
        if (!factory) {
            throw new Error(`No provider registered for type: ${type}`);
        }
        provider = factory();
        this.providers.set(type, provider);
        return provider;
    }
    /** List all registered provider type names. */
    list() {
        return Array.from(this.factories.keys());
    }
    /** Get a cached provider instance by type, or undefined. */
    getProvider(type) {
        return this.providers.get(type);
    }
    /** Get all instantiated provider instances. */
    getAllProviders() {
        return Array.from(this.providers.values());
    }
    /** Filter instantiated providers by a specific capability. */
    getProvidersByCapability(capability) {
        return this.getAllProviders().filter((p) => p.capabilities.includes(capability));
    }
}
//# sourceMappingURL=catalog-registry.js.map