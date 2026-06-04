/**
 * Provider conformance test suite.
 *
 * Any provider can import and run this suite to verify it correctly
 * implements the Provider interface contract.
 *
 * Usage:
 * ```ts
 * import { runProviderConformanceTests } from '@paramhub/types/testing';
 * import { MyProviderFactory } from '../src/index.js';
 *
 * runProviderConformanceTests(MyProviderFactory);
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Provider, ProviderFactory } from '../index.js';

/**
 * Runs the full provider conformance test suite against a provider factory.
 *
 * @param factory - A ProviderFactory that creates provider instances
 * @param config - Optional config to pass to provider.init()
 */
export function runProviderConformanceTests(
  factory: ProviderFactory,
  config: Record<string, unknown> = {},
): void {
  describe('Provider Conformance Tests', () => {
    let provider: Provider;

    beforeAll(async () => {
      provider = factory.create();
      await provider.init(config);
    });

    afterAll(async () => {
      await provider.dispose();
    });

    // ── Identity ──

    describe('Identity', () => {
      it('should have a non-empty id', () => {
        expect(provider.id).toBeDefined();
        expect(typeof provider.id).toBe('string');
        expect(provider.id.length).toBeGreaterThan(0);
      });

      it('should have a non-empty displayName', () => {
        expect(provider.displayName).toBeDefined();
        expect(typeof provider.displayName).toBe('string');
        expect(provider.displayName.length).toBeGreaterThan(0);
      });
    });

    // ── Lifecycle ──

    describe('Lifecycle', () => {
      it('should return config schema as an array', () => {
        const schema = provider.getConfigSchema();
        expect(Array.isArray(schema)).toBe(true);
        for (const field of schema) {
          expect(field.key).toBeDefined();
          expect(typeof field.key).toBe('string');
          expect(field.label).toBeDefined();
          expect(typeof field.label).toBe('string');
          expect(['string', 'select', 'boolean']).toContain(field.type);
          expect(typeof field.required).toBe('boolean');
        }
      });

      it('should pass connection test after init', async () => {
        const result = await provider.testConnection();
        expect(result).toBeDefined();
        expect(typeof result.ok).toBe('boolean');
        expect(result.ok).toBe(true);
      });
    });

    // ── Capabilities ──

    describe('Capabilities', () => {
      it('should return valid capabilities object', () => {
        const caps = provider.getCapabilities();
        expect(caps).toBeDefined();
        expect(typeof caps.canEdit).toBe('boolean');
        expect(typeof caps.canDelete).toBe('boolean');
        expect(typeof caps.canCreate).toBe('boolean');
        expect(typeof caps.canSearch).toBe('boolean');
        expect(typeof caps.canSwitchRegion).toBe('boolean');
        expect(typeof caps.canSwitchAccount).toBe('boolean');
        expect(Array.isArray(caps.supportedItemTypes)).toBe(true);
        expect(caps.supportedItemTypes.length).toBeGreaterThan(0);
        expect(Array.isArray(caps.customActions)).toBe(true);
        expect(Array.isArray(caps.customTabs)).toBe(true);
      });

      it('should have valid custom actions', () => {
        const caps = provider.getCapabilities();
        for (const action of caps.customActions) {
          expect(action.id).toBeDefined();
          expect(typeof action.id).toBe('string');
          expect(action.label).toBeDefined();
          expect(typeof action.label).toBe('string');
          expect(typeof action.execute).toBe('function');
        }
      });
    });

    // ── Commands ──

    describe('Commands', () => {
      it('should return commands as an array', () => {
        const commands = provider.getCommands();
        expect(Array.isArray(commands)).toBe(true);
      });

      it('should have valid command structure', () => {
        const commands = provider.getCommands();
        for (const cmd of commands) {
          expect(cmd.id).toBeDefined();
          expect(typeof cmd.id).toBe('string');
          expect(cmd.id.length).toBeGreaterThan(0);

          expect(cmd.label).toBeDefined();
          expect(typeof cmd.label).toBe('string');
          expect(cmd.label.length).toBeGreaterThan(0);

          expect(cmd.category).toBeDefined();
          expect([
            'navigation',
            'search',
            'item',
            'provider',
            'bookmarks',
            'view',
            'system',
          ]).toContain(cmd.category);

          expect(typeof cmd.execute).toBe('function');

          if (cmd.hotkey !== undefined) {
            expect(typeof cmd.hotkey).toBe('string');
          }
          if (cmd.description !== undefined) {
            expect(typeof cmd.description).toBe('string');
          }
          if (cmd.isEnabled !== undefined) {
            expect(typeof cmd.isEnabled).toBe('function');
          }
          if (cmd.isVisible !== undefined) {
            expect(typeof cmd.isVisible).toBe('function');
          }
        }
      });

      it('should have unique command IDs', () => {
        const commands = provider.getCommands();
        const ids = commands.map((cmd) => cmd.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });
    });

    // ── Context ──

    describe('Context', () => {
      it('should return a valid context', async () => {
        const ctx = await provider.getCurrentContext();
        expect(ctx).toBeDefined();
        expect(typeof ctx.displayLabel).toBe('string');
        expect(ctx.displayLabel.length).toBeGreaterThan(0);
      });

      it('should support region switching if capable', async () => {
        const caps = provider.getCapabilities();
        if (caps.canSwitchRegion && provider.getAvailableRegions) {
          const regions = await provider.getAvailableRegions();
          expect(Array.isArray(regions)).toBe(true);
          expect(regions.length).toBeGreaterThan(0);

          if (provider.switchRegion && regions.length > 0) {
            const targetRegion = regions[0]!;
            await provider.switchRegion(targetRegion);
            const ctx = await provider.getCurrentContext();
            expect(ctx.region).toBe(targetRegion);
          }
        }
      });
    });

    // ── Search ──

    describe('Search', () => {
      it('should return a valid search result for empty query', async () => {
        const result = await provider.search({ query: '' });
        expect(result).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
      });

      it('should return items with required fields', async () => {
        const result = await provider.search({ query: '' });
        for (const item of result.items) {
          expect(item.id).toBeDefined();
          expect(typeof item.id).toBe('string');
          expect(item.path).toBeDefined();
          expect(typeof item.path).toBe('string');
          expect(item.name).toBeDefined();
          expect(typeof item.name).toBe('string');
          expect(item.type).toBeDefined();
          expect([
            'string',
            'secure',
            'binary',
            'json',
            'list',
          ]).toContain(item.type);
          expect(item.metadata).toBeDefined();
          expect(typeof item.metadata).toBe('object');
        }
      });

      it('should not include values in search results', async () => {
        const result = await provider.search({ query: '' });
        for (const item of result.items) {
          expect(item.value).toBeUndefined();
        }
      });

      it('should respect maxResults', async () => {
        const result = await provider.search({ query: '', maxResults: 2 });
        expect(result.items.length).toBeLessThanOrEqual(2);
      });

      it('should support pagination', async () => {
        // Get first page
        const page1 = await provider.search({ query: '', maxResults: 3 });

        if (page1.nextToken) {
          // Get second page
          const page2 = await provider.search({
            query: '',
            maxResults: 3,
            nextToken: page1.nextToken,
          });
          expect(Array.isArray(page2.items)).toBe(true);

          // Pages should not overlap
          const page1Ids = new Set(page1.items.map((i) => i.id));
          for (const item of page2.items) {
            expect(page1Ids.has(item.id)).toBe(false);
          }
        }
      });

      it('should filter results based on query', async () => {
        // Search for something specific
        const allResult = await provider.search({ query: '' });
        if (allResult.items.length > 0) {
          // Use the name of the first item as a query
          const targetName = allResult.items[0]!.name;
          const filtered = await provider.search({ query: targetName });
          expect(filtered.items.length).toBeGreaterThan(0);
          // All results should match the query
          for (const item of filtered.items) {
            const matches =
              item.path.toLowerCase().includes(targetName.toLowerCase()) ||
              item.name.toLowerCase().includes(targetName.toLowerCase());
            expect(matches).toBe(true);
          }
        }
      });
    });

    // ── Get Item & Value ──

    describe('Get Item & Value', () => {
      it('should get a single item by ID', async () => {
        const searchResult = await provider.search({ query: '', maxResults: 1 });
        if (searchResult.items.length > 0) {
          const firstItem = searchResult.items[0]!;
          const item = await provider.getItem(firstItem.id);
          expect(item).toBeDefined();
          expect(item.id).toBe(firstItem.id);
          expect(item.path).toBe(firstItem.path);
          expect(item.name).toBe(firstItem.name);
          expect(item.type).toBe(firstItem.type);
        }
      });

      it('should throw for non-existent item', async () => {
        await expect(
          provider.getItem('__non_existent_item_id__'),
        ).rejects.toThrow();
      });

      it('should get a value by ID', async () => {
        const searchResult = await provider.search({ query: '', maxResults: 1 });
        if (searchResult.items.length > 0) {
          const firstItem = searchResult.items[0]!;
          const value = await provider.getValue(firstItem.id);
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
        }
      });

      it('should throw for non-existent value', async () => {
        await expect(
          provider.getValue('__non_existent_item_id__'),
        ).rejects.toThrow();
      });
    });

    // ── Item Details ──

    describe('Item Details', () => {
      it('should return detail fields for an item', async () => {
        const searchResult = await provider.search({ query: '', maxResults: 1 });
        if (searchResult.items.length > 0) {
          const item = await provider.getItem(searchResult.items[0]!.id);
          const details = provider.getItemDetails(item);
          expect(Array.isArray(details)).toBe(true);
          expect(details.length).toBeGreaterThan(0);

          for (const field of details) {
            expect(field.label).toBeDefined();
            expect(typeof field.label).toBe('string');
            expect(field.value).toBeDefined();
            expect(typeof field.value).toBe('string');
          }
        }
      });
    });

    // ── Mutations ──

    describe('Mutations', () => {
      it('should support create if capable', async () => {
        const caps = provider.getCapabilities();
        if (caps.canCreate && provider.createItem) {
          const newItem = await provider.createItem(
            '/__test__/conformance/new-item',
            'test-value',
            'string',
          );
          expect(newItem).toBeDefined();
          expect(newItem.path).toBe('/__test__/conformance/new-item');
          expect(newItem.type).toBe('string');

          // Clean up
          if (provider.deleteItem) {
            await provider.deleteItem(newItem.id);
          }
        }
      });

      it('should support update if capable', async () => {
        const caps = provider.getCapabilities();
        if (caps.canEdit && provider.updateValue && provider.createItem) {
          // Create a test item
          const item = await provider.createItem(
            '/__test__/conformance/update-item',
            'original-value',
            'string',
          );

          // Update it
          await provider.updateValue(item.id, 'updated-value');

          // Verify
          const value = await provider.getValue(item.id);
          expect(value).toBe('updated-value');

          // Clean up
          if (provider.deleteItem) {
            await provider.deleteItem(item.id);
          }
        }
      });

      it('should support delete if capable', async () => {
        const caps = provider.getCapabilities();
        if (caps.canDelete && provider.deleteItem && provider.createItem) {
          // Create a test item
          const item = await provider.createItem(
            '/__test__/conformance/delete-item',
            'to-be-deleted',
            'string',
          );

          // Delete it
          await provider.deleteItem(item.id);

          // Verify it's gone
          await expect(provider.getItem(item.id)).rejects.toThrow();
        }
      });
    });
  });
}
