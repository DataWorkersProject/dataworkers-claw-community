/**
 * CatalogRegistry — Registry for ICatalogProvider instances.
 *
 * Provides factory-based registration, lazy instantiation,
 * and capability-based provider lookup.
 */

import type { ICatalogProvider, CatalogCapability, CatalogProviderRegistry } from './types.js';

export class CatalogRegistry implements CatalogProviderRegistry {
  private providers = new Map<string, ICatalogProvider>();
  private factories = new Map<string, () => ICatalogProvider>();

  /** Register a provider factory (ConnectorRegistry compat). */
  register(type: string, factory: (config: Record<string, unknown>) => ICatalogProvider): void {
    this.factories.set(type, () => factory({}));
  }

  /** Register a provider factory (CatalogProviderRegistry). */
  registerProvider(type: string, factory: () => ICatalogProvider): void {
    this.factories.set(type, factory);
  }

  /**
   * Create (or return cached) provider instance.
   * Config is accepted for ConnectorRegistry compatibility but
   * the factory is invoked without arguments.
   */
  create(type: string, _config: Record<string, unknown> = {}): ICatalogProvider {
    let provider = this.providers.get(type);
    if (provider) return provider;

    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`No provider registered for type: ${type}`);
    }
    provider = factory();
    this.providers.set(type, provider);
    return provider;
  }

  /** List all registered provider type names. */
  list(): string[] {
    return Array.from(this.factories.keys());
  }

  /** Get a cached provider instance by type, or undefined. */
  getProvider(type: string): ICatalogProvider | undefined {
    return this.providers.get(type);
  }

  /** Get all instantiated provider instances. */
  getAllProviders(): ICatalogProvider[] {
    return Array.from(this.providers.values());
  }

  /** Filter instantiated providers by a specific capability. */
  getProvidersByCapability(capability: CatalogCapability): ICatalogProvider[] {
    return this.getAllProviders().filter((p) => p.capabilities.includes(capability));
  }
}
