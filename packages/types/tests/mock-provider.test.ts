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
