import type { Provider, ProviderFactory } from '@paramhub/types';
import type { ProviderEntry } from '../config/schema.js';

export interface FailedProvider {
  package: string;
  error: Error;
}

export class ProviderManager {
  private loaded: Map<string, Provider> = new Map();
  private failures: FailedProvider[] = [];

  async loadAll(entries: ProviderEntry[]): Promise<void> {
    for (const entry of entries.filter((e) => e.enabled)) {
      try {
        const mod = (await import(entry.package)) as Record<string, unknown>;
        const factory = resolveFactory(mod, entry.package);
        const provider = factory.create();
        await provider.init(entry.config);
        const conn = await provider.testConnection();
        if (conn.ok) {
          this.loaded.set(provider.id, provider);
        } else {
          this.failures.push({
            package: entry.package,
            error: new Error(conn.message ?? 'Connection test failed'),
          });
        }
      } catch (err) {
        this.failures.push({
          package: entry.package,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }
  }

  getAll(): Provider[] {
    return Array.from(this.loaded.values());
  }

  getById(id: string): Provider | undefined {
    return this.loaded.get(id);
  }

  getFailures(): FailedProvider[] {
    return this.failures;
  }

  async disposeAll(): Promise<void> {
    for (const provider of this.loaded.values()) {
      try {
        await provider.dispose();
      } catch {
        // ignore dispose errors
      }
    }
    this.loaded.clear();
  }
}

function resolveFactory(mod: Record<string, unknown>, packageName: string): ProviderFactory {
  // Priority 1: default export is a factory
  if (isFactory(mod.default)) return mod.default;

  // Priority 2: scan named exports for first factory-shaped object
  for (const val of Object.values(mod)) {
    if (isFactory(val)) return val;
  }

  throw new Error(`No ProviderFactory found in module ${packageName}`);
}

function isFactory(val: unknown): val is ProviderFactory {
  return (
    val !== null &&
    typeof val === 'object' &&
    'create' in val &&
    typeof (val as ProviderFactory).create === 'function'
  );
}
