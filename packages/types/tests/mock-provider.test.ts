/**
 * Conformance tests for the MockProvider.
 *
 * This verifies that our mock provider correctly implements the
 * Provider interface contract, and also serves as a demonstration
 * of how other providers should use the conformance test suite.
 */

import { describe, it, expect } from 'vitest';
import { MockProviderFactory, MockProvider } from '../src/testing/index.js';
import { runProviderConformanceTests } from '../src/testing/index.js';

// Run the shared conformance test suite against the mock provider
runProviderConformanceTests(MockProviderFactory);

// Additional mock-specific tests
describe('MockProvider — Specific Behavior', () => {
  it('should initialize with default mock data', async () => {
    const provider = new MockProvider();
    await provider.init({});

    const result = await provider.search({ query: '' });
    expect(result.items.length).toBe(10);
  });

  it('should respect defaultRegion config', async () => {
    const provider = new MockProvider();
    await provider.init({ defaultRegion: 'eu-west-1' });

    const ctx = await provider.getCurrentContext();
    expect(ctx.region).toBe('eu-west-1');
  });

  it('should respect defaultProfile config', async () => {
    const provider = new MockProvider();
    await provider.init({ defaultProfile: 'production' });

    const ctx = await provider.getCurrentContext();
    expect(ctx.profile).toBe('production');
  });

  it('should filter by path prefix', async () => {
    const provider = new MockProvider();
    await provider.init({});

    const result = await provider.search({
      query: '',
      pathPrefix: '/app/production/',
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.path.startsWith('/app/production/')).toBe(true);
    }
  });

  it('should browse the root level without leaking descendants', async () => {
    const provider = new MockProvider();
    await provider.init({});

    const root = await provider.browse({});
    expect(root.nodes.map((n) => n.kind === 'branch' && n.path).sort()).toEqual([
      '/app',
      '/shared',
    ]);
  });

  it('should descend a branch path returned by browse', async () => {
    const provider = new MockProvider();
    await provider.init({});

    const root = await provider.browse({});
    const app = root.nodes.find((n) => n.kind === 'branch' && n.path === '/app');
    expect(app?.kind).toBe('branch');

    const level1 = await provider.browse({ path: (app as { path: string }).path });
    expect(level1.nodes.map((n) => n.kind === 'branch' && n.path).sort()).toEqual([
      '/app/production',
      '/app/staging',
    ]);
  });

  it('should mix branches and leaves at a level that has both', async () => {
    const provider = new MockProvider();
    await provider.init({});

    const result = await provider.browse({ path: '/app/staging' });
    const branches = result.nodes.filter((n) => n.kind === 'branch');
    const leaves = result.nodes.filter((n) => n.kind === 'leaf');

    expect(branches.map((n) => (n as { path: string }).path)).toEqual([
      '/app/staging/database',
    ]);
    expect(leaves.map((n) => (n as { item: { path: string } }).item.path)).toEqual([
      '/app/staging/feature-flags',
    ]);
    for (const leaf of leaves) {
      expect((leaf as { item: { value?: string } }).item.value).toBeUndefined();
    }
  });

  it('should paginate browse results', async () => {
    const provider = new MockProvider();
    await provider.init({});

    const page1 = await provider.browse({ path: '/app/production/database', maxResults: 2 });
    expect(page1.nodes.length).toBe(2);
    expect(page1.nextToken).toBeDefined();

    const page2 = await provider.browse({
      path: '/app/production/database',
      maxResults: 2,
      nextToken: page1.nextToken,
    });
    expect(page2.nodes.length).toBe(1);
    expect(page2.nextToken).toBeUndefined();
  });

  it('should return 3 commands', async () => {
    const provider = new MockProvider();
    await provider.init({});

    const commands = provider.getCommands();
    expect(commands.length).toBe(3);
    expect(commands.map((c) => c.id)).toEqual([
      'mock:copy-path',
      'mock:show-type',
      'mock:refresh',
    ]);
  });

  it('should have command isEnabled that checks for selected item', async () => {
    const provider = new MockProvider();
    await provider.init({});

    const commands = provider.getCommands();
    const copyPath = commands.find((c) => c.id === 'mock:copy-path')!;

    // Should be disabled when no item is selected
    expect(
      copyPath.isEnabled!({
        activeProviderId: 'mock',
        view: 'list',
        selectedItem: null,
        searchQuery: '',
      }),
    ).toBe(false);

    // Should be enabled when an item is selected
    const searchResult = await provider.search({ query: '', maxResults: 1 });
    expect(
      copyPath.isEnabled!({
        activeProviderId: 'mock',
        view: 'detail',
        selectedItem: searchResult.items[0]!,
        searchQuery: '',
      }),
    ).toBe(true);
  });

  it('should fail connection test if not initialized', async () => {
    const provider = new MockProvider();
    // Don't call init
    const result = await provider.testConnection();
    expect(result.ok).toBe(false);
  });

  it('should properly dispose and clear data', async () => {
    const provider = new MockProvider();
    await provider.init({});

    const before = await provider.search({ query: '' });
    expect(before.items.length).toBeGreaterThan(0);

    await provider.dispose();

    // After dispose, testConnection should fail
    const result = await provider.testConnection();
    expect(result.ok).toBe(false);
  });
});
