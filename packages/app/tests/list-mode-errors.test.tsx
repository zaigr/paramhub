/**
 * A mode that cannot list a store must say so.
 *
 * Covers the toggle path specifically: switching with "t" goes through
 * TOGGLE_LIST_MODE → resetListing → refetch, which is a different code path
 * from booting straight into a mode, and is where an empty screen with no
 * explanation is most confusing (the user just had a working list).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import type {
  BrowseOptions,
  BrowseResult,
  Item,
  Provider,
  ProviderCapabilities,
} from '@paramhub/types';
import App from '../src/app.js';
import { AppConfigSchema } from '../src/config/schema.js';
import { commandRegistry } from '../src/commands/registry.js';
import { clearListCache } from '../src/hooks/use-list.js';

const FLAT_UNAVAILABLE = 'needs "buckets" configured';

/**
 * Stands in for AWS S3 with no `buckets` set: browsable, and `search()` exists
 * (so the tree/flat toggle is offered) but cannot be served without a bucket.
 */
class BucketlessProvider implements Provider {
  readonly id = 'fake-s3';
  readonly displayName = 'Fake S3';

  getConfigSchema() {
    return [];
  }
  async init() {}
  async testConnection() {
    return { ok: true };
  }
  async dispose() {}
  getCapabilities(): ProviderCapabilities {
    return {
      canEdit: false,
      canDelete: false,
      canCreate: false,
      canSearch: true,
      canSwitchRegion: false,
      canSwitchAccount: false,
      hierarchy: { delimiter: '/', rootPath: '' },
      supportedItemTypes: ['string'],
      customActions: [],
      customTabs: [],
    };
  }
  getCommands() {
    return [];
  }
  async getCurrentContext() {
    return { displayLabel: 'fake' };
  }
  async browse(options: BrowseOptions): Promise<BrowseResult> {
    if (!options.path) {
      return { nodes: [{ kind: 'branch', path: 'my-bucket/', name: 'my-bucket' }] };
    }
    return { nodes: [] };
  }
  async search(): Promise<never> {
    throw new Error(`Fake S3 flat mode ${FLAT_UNAVAILABLE} — press t to browse as a tree`);
  }
  async getItem(): Promise<Item> {
    throw new Error('not used');
  }
  async getValue(): Promise<string> {
    throw new Error('not used');
  }
  getItemDetails() {
    return [];
  }
}

type RenderResult = ReturnType<typeof render>;
let active: RenderResult | null = null;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  commandRegistry.clear();
  commandRegistry.setOverrides({});
  clearListCache();
});

afterEach(() => {
  active?.unmount();
  active = null;
});

describe('a mode that cannot list the store explains itself', () => {
  it('shows the reason and the way out after toggling to flat with "t"', async () => {
    const provider = new BucketlessProvider();
    const instance = render(
      React.createElement(App, {
        providers: [provider],
        config: AppConfigSchema.parse({}),
        configPath: '/tmp/paramhub-list-mode-unused/config.yaml',
        firstRun: false,
      }),
    );
    active = instance;

    // Tree mode lists fine — this is the state the user is toggling away from.
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('▸ my-bucket');
    });
    await delay(150);

    instance.stdin.write('t');

    await vi.waitFor(() => {
      const frame = instance.lastFrame()!;
      // The provider's reason, not a blank screen.
      expect(frame).toContain(FLAT_UNAVAILABLE);
      // And the generic way back.
      expect(frame).toContain('Press t for tree view.');
    });
  });

  it('clears the error when toggling back to a mode that works', async () => {
    const provider = new BucketlessProvider();
    const instance = render(
      React.createElement(App, {
        providers: [provider],
        config: AppConfigSchema.parse({}),
        configPath: '/tmp/paramhub-list-mode-unused/config.yaml',
        firstRun: false,
      }),
    );
    active = instance;

    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('▸ my-bucket');
    });
    await delay(150);

    instance.stdin.write('t');
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain(FLAT_UNAVAILABLE);
    });
    await delay(150);

    instance.stdin.write('t');
    await vi.waitFor(() => {
      const frame = instance.lastFrame()!;
      expect(frame).toContain('▸ my-bucket');
      // The level is served from cache on the way back, so LIST_SUCCESS arrives
      // with no preceding SEARCH_START — the error must still be gone.
      expect(frame).not.toContain(FLAT_UNAVAILABLE);
      expect(frame).not.toContain('Error:');
    });
  });
});
