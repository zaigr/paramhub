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
import type { Item, Provider, ProviderFactory } from '../index.js';

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

    // Probed inside each test rather than at describe level: capabilities are
    // only readable after init, which happens in beforeAll — i.e. *after* every
    // describe body has already run.
    const searchable = (): boolean =>
      Boolean(provider.getCapabilities().canSearch && provider.search);
    const browsable = (): boolean =>
      Boolean(provider.getCapabilities().hierarchy && provider.browse);

    /** Any one item — browse-only providers have no `search()` to pull one from. */
    async function anyItem(): Promise<Item | undefined> {
      if (provider.search) {
        const result = await provider.search({ query: '', maxResults: 1 });
        if (result.items[0]) {
          return result.items[0];
        }
      }
      if (!provider.browse) {
        return undefined;
      }
      let path = provider.getCapabilities().hierarchy?.rootPath;
      // Bounded so a provider returning branches forever cannot hang the suite.
      for (let depth = 0; depth < 16; depth++) {
        const result = await provider.browse({ path });
        const leaf = result.nodes.find((node) => node.kind === 'leaf');
        if (leaf?.kind === 'leaf') {
          return leaf.item;
        }
        const branch = result.nodes.find((node) => node.kind === 'branch');
        if (branch?.kind !== 'branch') {
          return undefined;
        }
        path = branch.path;
      }
      return undefined;
    }

    // ── Listing contract ──

    describe('Listing', () => {
      it('should implement search, browse, or both', () => {
        expect(Boolean(provider.search) || Boolean(provider.browse)).toBe(true);
      });

      it('should declare canSearch consistently with search()', () => {
        expect(provider.getCapabilities().canSearch).toBe(Boolean(provider.search));
      });

      it('should declare hierarchy consistently with browse()', () => {
        const hasHierarchy = provider.getCapabilities().hierarchy !== undefined;
        expect(hasHierarchy).toBe(Boolean(provider.browse));
      });
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
        if (!searchable()) return;
        const result = await provider.search!({ query: '' });
        expect(result).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
      });

      it('should return items with required fields', async () => {
        if (!searchable()) return;
        const result = await provider.search!({ query: '' });
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
        if (!searchable()) return;
        const result = await provider.search!({ query: '' });
        for (const item of result.items) {
          expect(item.value).toBeUndefined();
        }
      });

      it('should respect maxResults', async () => {
        if (!searchable()) return;
        const result = await provider.search!({ query: '', maxResults: 2 });
        expect(result.items.length).toBeLessThanOrEqual(2);
      });

      it('should support pagination', async () => {
        if (!searchable()) return;
        // Get first page
        const page1 = await provider.search!({ query: '', maxResults: 3 });

        if (page1.nextToken) {
          // Get second page
          const page2 = await provider.search!({
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
        if (!searchable()) return;
        // Search for something specific
        const allResult = await provider.search!({ query: '' });
        if (allResult.items.length > 0) {
          // Use the name of the first item as a query
          const targetName = allResult.items[0]!.name;
          const filtered = await provider.search!({ query: targetName });
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

    // ── Browse ──

    describe('Browse', () => {
      it('should describe a usable hierarchy', () => {
        if (!browsable()) return;
        const hierarchy = provider.getCapabilities().hierarchy!;
        expect(typeof hierarchy.delimiter).toBe('string');
        expect(hierarchy.delimiter.length).toBeGreaterThan(0);
        expect(typeof hierarchy.rootPath).toBe('string');
      });

      it('should return valid nodes at the root', async () => {
        if (!browsable()) return;
        const result = await provider.browse!({});
        expect(Array.isArray(result.nodes)).toBe(true);

        for (const node of result.nodes) {
          expect(['branch', 'leaf']).toContain(node.kind);
          if (node.kind === 'branch') {
            expect(typeof node.path).toBe('string');
            expect(node.path.length).toBeGreaterThan(0);
            expect(typeof node.name).toBe('string');
            expect(node.name.length).toBeGreaterThan(0);
          } else {
            const { item } = node;
            expect(typeof item.id).toBe('string');
            expect(typeof item.path).toBe('string');
            expect(typeof item.name).toBe('string');
            expect(['string', 'secure', 'binary', 'json', 'list']).toContain(item.type);
            expect(typeof item.metadata).toBe('object');
            expect(item.value).toBeUndefined();
          }
        }
      });

      it('should accept a branch path back verbatim', async () => {
        if (!browsable()) return;
        const root = await provider.browse!({});
        const branch = root.nodes.find((node) => node.kind === 'branch');
        if (branch?.kind !== 'branch') return;

        // Normalizing the path (trailing delimiter, leading slash) is the
        // classic way to break BranchNode.path's round-trip contract.
        const child = await provider.browse!({ path: branch.path });
        expect(Array.isArray(child.nodes)).toBe(true);
      });

      it('should return direct children only, never descendants', async () => {
        if (!browsable()) return;
        const { delimiter } = provider.getCapabilities().hierarchy!;
        const root = await provider.browse!({});
        const branch = root.nodes.find((node) => node.kind === 'branch');
        if (branch?.kind !== 'branch') return;

        const child = await provider.browse!({ path: branch.path });
        for (const node of child.nodes) {
          if (node.kind !== 'leaf') continue;
          const rest = node.item.path.slice(branch.path.length);
          // Allow one leading delimiter when the branch path is not itself
          // delimiter-terminated; anything beyond that means a deeper level leaked.
          const tail = rest.startsWith(delimiter) ? rest.slice(delimiter.length) : rest;
          expect(tail.includes(delimiter)).toBe(false);
        }
      });

      it('should respect maxResults', async () => {
        if (!browsable()) return;
        const result = await provider.browse!({ maxResults: 2 });
        expect(result.nodes.length).toBeLessThanOrEqual(2);
      });

      it('should support pagination', async () => {
        if (!browsable()) return;
        const page1 = await provider.browse!({ maxResults: 2 });
        if (!page1.nextToken) return;

        const page2 = await provider.browse!({
          maxResults: 2,
          nextToken: page1.nextToken,
        });
        expect(Array.isArray(page2.nodes)).toBe(true);

        const seen = new Set(
          page1.nodes.map((node) => (node.kind === 'branch' ? node.path : node.item.id)),
        );
        for (const node of page2.nodes) {
          const key = node.kind === 'branch' ? node.path : node.item.id;
          expect(seen.has(key)).toBe(false);
        }
      });
    });

    // ── Get Item & Value ──

    describe('Get Item & Value', () => {
      it('should get a single item by ID', async () => {
        const known = await anyItem();
        if (known) {
          const item = await provider.getItem(known.id);
          expect(item).toBeDefined();
          expect(item.id).toBe(known.id);
          expect(item.path).toBe(known.path);
          expect(item.name).toBe(known.name);
          expect(item.type).toBe(known.type);
        }
      });

      it('should throw for non-existent item', async () => {
        await expect(
          provider.getItem('__non_existent_item_id__'),
        ).rejects.toThrow();
      });

      it('should get a value by ID', async () => {
        const known = await anyItem();
        if (known) {
          const value = await provider.getValue(known.id);
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
        const known = await anyItem();
        if (known) {
          const item = await provider.getItem(known.id);
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
